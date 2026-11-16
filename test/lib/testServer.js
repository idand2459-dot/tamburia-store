/**
 * Starts the application for one HTTP test suite, on the separate test database only.
 *
 * Every HTTP suite starts its own server in its own process, through runHttpSuite(); it
 * never talks to a server somebody else started, and an externally supplied address
 * (NEW_URL) is not read at all. In order, and each step before the next:
 *
 *   1. the whole guard (test/lib/testDatabase.js): production, TEST_DATABASE_URL, local
 *      host, not the development database. Nothing is trusted from an earlier run;
 *   2. the configuration the server loads (config.db) is checked against the target.
 *      This happens before any connection; the connection pool is created lazily, so
 *      loading the server code opens none;
 *   3. the first and only thing sent to PostgreSQL is a query for its own identity
 *      (database, user, port, address); a mismatch stops the run before any write;
 *   4. the migrations (safe to repeat: server/db/migrate.js applies each file once, in a
 *      transaction, and records it in schema_migrations);
 *   5. the app listens on 127.0.0.1 with a port the operating system picks.
 *
 * If a step fails, whatever was opened before it is closed, and the error is thrown.
 * One server per process: the server modules read their configuration once, when they load.
 */
const MAIL_AND_LOGGING = {
  MAIL_ENABLED: 'false',
  DB_LOG_QUERIES: 'false',
  // Short, so a suite that logs in once is not locked out; smoke-auth exhausts it on purpose.
  LOGIN_WINDOW_MS: '2000',
};

/**
 * Limits for the public writes (config.rateLimits), set high for every suite: many suites create
 * far more than 10 orders. A value the suite set before starting the server is kept, which is how
 * smoke-rate-limits runs with low ones.
 */
const RATE_LIMIT_DEFAULTS = {
  ORDER_RATE_MAX: '100000',
  REVIEW_RATE_MAX: '100000',
};

/** The server modules whose configuration must not have been loaded before the guard ran. */
const CONFIG_MODULES = ['../../server/config/env', '../../server/config/db'];

/** Opens the listening socket on a port the OS chooses; resolves with the http.Server. */
function listenLocal(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

/** Closes an http.Server, dropping idle and open connections so it cannot hang. */
function closeHttp(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  });
}

/**
 * Runs the steps above and resolves with { baseUrl, target, close }. The port is chosen by
 * the operating system unless a caller (the accessibility audit) asks for one. `close()` stops the
 * server and closes the database connections; it is safe to call more than once.
 */
async function startTestServer(env = process.env, { port = 0 } = {}) {
  const {
    prepareTestDatabase, assertEffectiveDatabase, assertServerIdentity, describeTestDatabase, IDENTITY_SQL,
  } = require('./testDatabase');

  for (const id of CONFIG_MODULES) {
    if (require.cache[require.resolve(id)]) {
      throw new Error('הגדרות השרת כבר נטענו לפני בדיקת מסד הבדיקות. הבדיקות לא רצות.');
    }
  }

  Object.assign(env, MAIL_AND_LOGGING);
  for (const [key, value] of Object.entries(RATE_LIMIT_DEFAULTS)) {
    if (env[key] === undefined) env[key] = value;
  }
  const target = prepareTestDatabase(env);
  console.log(describeTestDatabase(target));
  assertEffectiveDatabase(target, require('../../server/config/env').db);

  const db = require('../../server/config/db');
  let http = null;
  let closed = null;

  const close = () => {
    if (!closed) {
      closed = (async () => {
        try {
          if (http) await closeHttp(http);
        } finally {
          await db.close();
        }
      })();
    }
    return closed;
  };

  try {
    const { rows } = await db.pool.query(IDENTITY_SQL);
    assertServerIdentity(target, rows[0]);

    await require('../../server/db/migrate').runMigrations();

    http = await listenLocal(require('../../server/app').createApp(), port);
  } catch (err) {
    await close().catch(() => {});
    throw err;
  }

  return { baseUrl: `http://127.0.0.1:${http.address().port}`, target, close };
}

/**
 * The frame of an HTTP suite: starts the server (a refusal exits at once, nothing else
 * has run), calls `body(baseUrl)`, and always closes the server and the database
 * connections afterwards, also when the suite throws or the process is interrupted.
 * `onCrash(err)` runs while the server is still up, for the suite's own cleanup.
 * The exit code is whatever the suite set in process.exitCode, or 1 after a crash.
 */
async function runHttpSuite(body, onCrash) {
  let server;
  try {
    server = await startTestServer();
  } catch (err) {
    console.error('✗ הבדיקה לא רצה:', err.message);
    process.exit(1);
  }

  const interrupted = async () => {
    await server.close().catch(() => {});
    process.exit(130);
  };
  process.once('SIGINT', interrupted);
  process.once('SIGTERM', interrupted);

  try {
    await body(server.baseUrl);
  } catch (err) {
    console.error('הבדיקה קרסה:', err);
    process.exitCode = 1;
    if (onCrash) await Promise.resolve(onCrash(err)).catch(() => {});
  } finally {
    await server.close().catch((err) => {
      console.error('סגירת השרת נכשלה:', err.message);
      process.exitCode = 1;
    });
  }
  process.exit(process.exitCode || 0);
}

module.exports = { startTestServer, runHttpSuite };
