/**
 * Starts the real server (`node server/server.js`) as a child process in demo mode, for the demo
 * suites, on the separate test database only.
 *
 * Why a child process: DEMO_MODE requires NODE_ENV=production (server/config/env.js), while the
 * test guard refuses NODE_ENV=production in the process that runs the suites. The suite process
 * therefore stays a plain test process, runs the whole guard (test/lib/testDatabase.js) and confirms
 * from PostgreSQL itself that it reached the test database; only the child runs in production mode,
 * and it is given nothing but that validated database.
 *
 * The demo database marker is a fixture created here, in the test database, and removed in
 * `finally`. A marker left behind by an earlier crashed run is refused with a clear message instead
 * of being reused.
 */
const crypto = require('crypto');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const {
  resolveTestDatabase, assertServerIdentity, IDENTITY_SQL, describeTestDatabase, publicTarget,
} = require('./testDatabase');

const ROOT = path.join(__dirname, '..', '..');
const STARTED_LINE = 'השרת עובד על פורט';

/** The owner password the child server uses: 24 characters, as the demo configuration requires. */
const DEMO_ADMIN_PASSWORD = 'demo-test-owner-password-24';

/** Runs the guard and returns the full test target, or exits the process when it refuses. */
function guardedTarget() {
  try {
    return resolveTestDatabase(process.env);
  } catch (err) {
    console.error('✗ הבדיקה לא רצה:', err.message);
    process.exit(1);
    return null;
  }
}

/** Opens a connection to the given database (the test database by default) and confirms its identity. */
async function connect(target, { database = target.name, confirm = true } = {}) {
  const client = new Client({
    host: target.host, port: target.port, user: target.user, password: target.password, database,
  });
  await client.connect();
  if (confirm && database === target.name) {
    const { rows } = await client.query(IDENTITY_SQL);
    assertServerIdentity(target, rows[0]);
  }
  return client;
}

/** A free TCP port on this machine. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Whether the demo database marker table exists. */
async function markerExists(client) {
  const { rows } = await client.query("SELECT to_regclass('public.demo_database_marker') AS marker");
  return rows[0].marker !== null;
}

/**
 * Creates the marker fixture (table and row) in the test database and returns its id. Refuses when a
 * marker is already there: it is a leftover of a run that did not clean up, not something to reuse.
 */
async function installMarker(client, state = 'ready', id = crypto.randomUUID()) {
  if (await markerExists(client)) {
    throw new Error('נמצא סימון demo_database_marker שנשאר ממסד הבדיקות. הסירו אותו ידנית (טבלת demo_database_marker בלבד) ונסו שוב.');
  }
  await client.query(`
    CREATE TABLE demo_database_marker (
      singleton  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      id         UUID        NOT NULL,
      state      TEXT        NOT NULL CHECK (state IN ('bootstrapping', 'ready')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('INSERT INTO demo_database_marker (id, state) VALUES ($1, $2)', [id, state]);
  return id;
}

/** Removes the marker fixture. */
async function removeMarker(client) {
  await client.query('DROP TABLE IF EXISTS demo_database_marker');
}

/**
 * Starts `node server/server.js` against `target` with the given environment. Resolves with
 * { ok: true, baseUrl, stop, output } once it listens, or { ok: false, code, output } when it exits
 * first (a refusal at startup). `env` entries override the defaults; a value of undefined removes one.
 */
async function spawnServer(target, env = {}) {
  const port = await freePort();
  const childEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    DB_HOST: target.host,
    DB_PORT: String(target.port),
    DB_NAME: target.name,
    DB_USER: target.user,
    DB_PASSWORD: target.password,
    DB_SSL: 'false',
    DB_LOG_QUERIES: 'false',
    MAIL_ENABLED: 'false',
    ADMIN_PASSWORD: DEMO_ADMIN_PASSWORD,
    SESSION_SECRET: 'a'.repeat(64),
    ADMIN_URL: 'https://demo.example.com/admin',
    SERVE_CLIENT: 'true',
    CORS_ORIGINS: '',
    TRUST_PROXY_HOPS: '1',
    HSTS_ENABLED: 'true',
    LOGIN_WINDOW_MS: '2000',
    LOGIN_MAX_ATTEMPTS: '1000',
    ORDER_RATE_MAX: '100000',
    REVIEW_RATE_MAX: '100000',
    DEMO_MODE: 'false',
    DEMO_DATABASE_ID: '',
    ...env,
  };
  delete childEnv.DATABASE_URL;
  delete childEnv.NEW_URL;
  for (const key of Object.keys(childEnv)) if (childEnv[key] === undefined) delete childEnv[key];

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  const exited = new Promise((resolve) => child.once('close', (code) => resolve(code)));

  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timeout: true }), 30_000);
    const poll = setInterval(() => {
      if (output.includes(STARTED_LINE)) { clearInterval(poll); clearTimeout(timer); resolve({ started: true }); }
    }, 50);
    exited.then((code) => { clearInterval(poll); clearTimeout(timer); resolve({ code }); });
  });

  if (outcome.started) {
    return {
      ok: true,
      baseUrl: `http://127.0.0.1:${port}`,
      output: () => output,
      stop: async () => {
        if (child.exitCode === null) child.kill('SIGTERM');
        await exited;
      },
    };
  }
  if (outcome.timeout) child.kill('SIGKILL');
  return { ok: false, code: outcome.code ?? null, output: () => output };
}

/**
 * Starts the demo server on the test database: the marker fixture (state 'ready' unless told
 * otherwise) is installed first, and `stop()` removes it. Exits the process when the guard refuses.
 * Resolves with { baseUrl, databaseId, db (a pg client), target, stop, output }.
 */
async function startDemoServer({ env = {}, markerState = 'ready' } = {}) {
  const target = guardedTarget();
  console.log(describeTestDatabase(publicTarget(target)));

  const db = await connect(target);
  let databaseId;
  try {
    databaseId = await installMarker(db, markerState);
  } catch (err) {
    await db.end();
    console.error('✗ הבדיקה לא רצה:', err.message);
    process.exit(1);
  }

  const server = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: databaseId, ...env });
  const cleanup = async () => {
    try {
      if (server.ok) await server.stop();
    } finally {
      await removeMarker(db).catch(() => {});
      await db.end().catch(() => {});
    }
  };
  if (!server.ok) {
    await cleanup();
    throw new Error(`שרת ההדגמה לא עלה (קוד ${server.code}): ${server.output().split('\n').slice(-5).join(' | ')}`);
  }
  return { baseUrl: server.baseUrl, databaseId, db, target, stop: cleanup, output: server.output };
}

/** Wraps a demo suite: starts the server, runs `body`, always stops the server and removes the marker. */
async function runDemoSuite(body, options) {
  let server;
  try {
    server = await startDemoServer(options);
  } catch (err) {
    console.error('✗ הבדיקה לא רצה:', err.message);
    process.exit(1);
  }
  try {
    await body(server);
  } catch (err) {
    console.error('הבדיקה קרסה:', err);
    process.exitCode = 1;
  } finally {
    await server.stop().catch((err) => {
      console.error('הניקוי נכשל:', err.message);
      process.exitCode = 1;
    });
  }
  process.exit(process.exitCode || 0);
}

module.exports = {
  DEMO_ADMIN_PASSWORD, guardedTarget, connect, installMarker, removeMarker, markerExists, spawnServer,
  startDemoServer, runDemoSuite, freePort,
};
