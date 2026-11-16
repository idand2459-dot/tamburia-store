/**
 * Tests the guard that keeps the suites away from every database except a separate local
 * one (test/lib/testDatabase.js), and the self-managed test server the HTTP suites use
 * (test/lib/testServer.js).
 *
 * Nothing here opens a database connection:
 *   - the first groups run the guard on fake environment objects;
 *   - the child-process groups run the real code in a clean process with `dotenv` (so the
 *     real .env file is never read) and `pg` (so a connection can never be opened)
 *     replaced by stubs. The first stub throws PG_TOUCHED as soon as it is used; the second
 *     is a recording stand-in that answers the identity query from the environment, so the
 *     order of events (guard, identity check, migrations, listen, cleanup) can be asserted.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  prepareTestDatabase, resolveTestDatabase, assertEffectiveDatabase, assertServerIdentity, describeTestDatabase,
} = require('./lib/testDatabase');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

/** רושם תוצאה של בדיקה בודדת. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

/** Runs the guard on a copy of `env`; returns { result, env } or { error }. */
function guard(env) {
  const copy = { ...env };
  try {
    return { result: prepareTestDatabase(copy), env: copy };
  } catch (err) {
    return { error: err.message };
  }
}

const LOCAL_URL = 'postgresql://tester:pw-local@localhost:5432/shop_test';
const REMOTE_URL = 'postgresql://app:pw-remote-123@db.example.test:5432/shop';
const DEV_URL = 'postgresql://dev:pw-dev@localhost:5432/shop_dev';
const DEV = { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'shop_dev', DB_USER: 'dev', DB_PASSWORD: 'pw-dev' };

/** True when an error names TEST_DATABASE_URL and quotes none of the given secrets. */
function refusedQuietly(outcome, ...secrets) {
  return Boolean(outcome.error)
    && outcome.error.includes('TEST_DATABASE_URL')
    && secrets.every((secret) => !outcome.error.includes(secret));
}

console.log('\n── production');
const prod = guard({ ...DEV, NODE_ENV: 'production', TEST_DATABASE_URL: LOCAL_URL });
check('NODE_ENV=production refuses even with a valid local test database', prod.error && prod.error.includes('production'), prod);

console.log('\n── missing configuration (fails closed)');
const missing = guard({ ...DEV });
check('no TEST_DATABASE_URL refuses', refusedQuietly(missing), missing);
const empty = guard({ ...DEV, TEST_DATABASE_URL: '' });
check('empty TEST_DATABASE_URL refuses', refusedQuietly(empty), empty);
const nothing = guard({});
check('no variables at all refuses', refusedQuietly(nothing), nothing);
check('a leftover DB_* or DATABASE_URL is never used as a fallback', !guard({ ...DEV, DATABASE_URL: LOCAL_URL }).result, null);

console.log('\n── malformed URLs');
const malformed = {
  'not a url': 'not a url, secret-token-9',
  'wrong scheme': 'http://tester:secret-token-9@localhost:5432/shop_test',
  'no database name': 'postgresql://tester:secret-token-9@localhost:5432',
  'empty database name': 'postgresql://tester:secret-token-9@localhost:5432/',
  'no user': 'postgresql://:secret-token-9@localhost:5432/shop_test',
  'no password': 'postgresql://tester@localhost:5432/shop_test',
  'no host': 'postgresql://tester:secret-token-9@/shop_test',
  'bad port': 'postgresql://tester:secret-token-9@localhost:abc/shop_test',
  'query parameters': 'postgresql://tester:secret-token-9@localhost:5432/shop_test?host=db.example.test',
  'bad escape': 'postgresql://tester:%E0%A4%A@localhost:5432/shop_test',
};
for (const [label, url] of Object.entries(malformed)) {
  const outcome = guard({ ...DEV, TEST_DATABASE_URL: url });
  check(`${label}: refuses, names the variable, prints no value`, refusedQuietly(outcome, 'secret-token-9', '%E0'), outcome);
}

console.log('\n── remote hosts');
for (const url of [
  REMOTE_URL,
  'postgresql://app:pw-remote-123@10.0.0.5:5432/shop',
  'postgresql://app:pw-remote-123@localhost.example.test:5432/shop',
]) {
  const outcome = guard({ ...DEV, TEST_DATABASE_URL: url });
  check('a non-local host refuses without printing the password or host', refusedQuietly(outcome, 'pw-remote-123', 'example.test', '10.0.0.5'), outcome);
}

console.log('\n── the development database');
const sameAsDev = guard({ ...DEV, TEST_DATABASE_URL: DEV_URL });
check('the same server and database name as DB_* refuses', sameAsDev.error && sameAsDev.error.includes('DB_*') && !sameAsDev.error.includes('pw-dev'), sameAsDev);
const synonym = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@127.0.0.1:5432/shop_dev' });
check('127.0.0.1 and localhost count as the same server', synonym.error && synonym.error.includes('DB_*'), synonym);
const v6 = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@[::1]:5432/shop_dev' });
check('[::1] counts as the same server', v6.error && v6.error.includes('DB_*'), v6);
const defaults = guard({ TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5432/tamburia' });
check('with DB_* unset, the default development database (tamburia) refuses', defaults.error && defaults.error.includes('DB_*'), defaults);
const otherDb = guard({ ...DEV, TEST_DATABASE_URL: LOCAL_URL });
check('the same server but another database name is accepted', otherDb.result && otherDb.result.name === 'shop_test', otherDb);
const otherPort = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5433/shop_dev_test' });
check('another port is accepted by the guard (the identity check covers the instance)', otherPort.result && otherPort.result.port === 5433, otherPort);

console.log('\n── the name of the test database');
for (const name of ['postgres', 'template1', 'shop_dev', 'tamburia', 'shop_prod']) {
  const outcome = guard({ ...DEV, TEST_DATABASE_URL: `postgresql://tester:pw-local@localhost:5432/${name}` });
  check(`"${name}" (no "test" in the name) is refused, naming the variable only`, refusedQuietly(outcome, 'pw-local') && !outcome.error.replace('tamburia_test', '').includes(name), outcome);
}
for (const name of ['shop_test', 'tamburia_test', 'TEST_shop', 'tamburia-Test-2']) {
  const outcome = guard({ ...DEV, TEST_DATABASE_URL: `postgresql://tester:pw-local@localhost:5432/${name}` });
  check(`"${name}" is accepted`, outcome.result && outcome.result.name === name, outcome);
}

console.log('\n── no bypass marker');
const marked = guard({ ...DEV, TEST_DATABASE_URL: DEV_URL, TEST_DATABASE_GUARDED: '1' });
check('a hand-set TEST_DATABASE_GUARDED does not skip the development-database check', marked.error && marked.error.includes('DB_*'), marked);
const markedMissing = guard({ ...DEV, TEST_DATABASE_GUARDED: '1' });
check('it does not skip the missing-URL check either', refusedQuietly(markedMissing), markedMissing);
const markedRemote = guard({ TEST_DATABASE_GUARDED: '1', TEST_DATABASE_URL: REMOTE_URL });
check('nor the local-host check', refusedQuietly(markedRemote, 'pw-remote-123', 'example.test'), markedRemote);
const markedOk = guard({ ...DEV, TEST_DATABASE_URL: LOCAL_URL });
check('a valid run sets no marker', markedOk.env && !('TEST_DATABASE_GUARDED' in markedOk.env), markedOk.env && Object.keys(markedOk.env));
const libSource = fs.readFileSync(path.join(__dirname, 'lib', 'testDatabase.js'), 'utf8');
check('the guard module no longer mentions the marker as code', !/process\.env\.TEST_DATABASE_GUARDED|env\.TEST_DATABASE_GUARDED\s*=/.test(libSource), null);

console.log('\n── resolveTestDatabase changes nothing');
const pure = { ...DEV, DATABASE_URL: REMOTE_URL, TEST_DATABASE_URL: LOCAL_URL };
const before = JSON.stringify(pure);
const resolved = resolveTestDatabase(pure);
check('it validates and returns the target', resolved.name === 'shop_test' && resolved.user === 'tester', resolved);
check('and leaves DB_* and DATABASE_URL exactly as they were', JSON.stringify(pure) === before, pure);

console.log('\n── a valid test database');
const ok = guard({ ...DEV, DATABASE_URL: REMOTE_URL, TEST_DATABASE_URL: LOCAL_URL });
check('accepted', ok.result && ok.result.name === 'shop_test' && ok.result.host === 'localhost', ok);
check('translated into DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD', ok.env
  && ok.env.DB_HOST === 'localhost' && ok.env.DB_PORT === '5432' && ok.env.DB_NAME === 'shop_test'
  && ok.env.DB_USER === 'tester' && ok.env.DB_PASSWORD === 'pw-local', ok.env && { ...ok.env, DB_PASSWORD: '…' });
check('a leftover DATABASE_URL is removed', ok.env && !('DATABASE_URL' in ok.env), ok.env && Object.keys(ok.env));
check('the result carries no password', ok.result && !JSON.stringify(ok.result).includes('pw-local'), ok.result);
check('the log line carries no password', !describeTestDatabase(ok.result).includes('pw-local'), describeTestDatabase(ok.result));
const v6ok = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://tester:pw-local@[::1]:5432/shop_test' });
check('an IPv6 loopback host is accepted and stored without brackets', v6ok.result && v6ok.env.DB_HOST === '::1', v6ok);

console.log('\n── the effective configuration');
const target = ok.result;
const effective = { host: 'localhost', port: 5432, name: 'shop_test', user: 'tester' };
const passes = (() => { try { assertEffectiveDatabase(target, effective); return true; } catch { return false; } })();
check('a matching configuration passes', passes, null);
for (const [label, override] of Object.entries({
  'another database name': { name: 'shop_dev' },
  'another host': { host: 'db.example.test' },
  'another port': { port: 5999 },
  'another user': { user: 'dev' },
})) {
  let message = null;
  try { assertEffectiveDatabase(target, { ...effective, ...override }); } catch (err) { message = err.message; }
  check(`${label} is rejected`, message !== null && !message.includes('db.example.test'), message);
}
let noConfig = null;
try { assertEffectiveDatabase(target, undefined); } catch (err) { noConfig = err.message; }
check('a missing configuration is rejected', noConfig !== null, noConfig);

console.log('\n── the identity PostgreSQL reports (assertServerIdentity)');
const GOOD_IDENTITY = { db: 'shop_test', usr: 'tester', port: 5432, addr: '127.0.0.1' };

/** The message assertServerIdentity throws for `identity`, or null when it accepts it. */
function identityError(identity) {
  try { assertServerIdentity(target, identity); return null; } catch (err) { return err.message; }
}
check('the matching identity is accepted', identityError(GOOD_IDENTITY) === null, identityError(GOOD_IDENTITY));
check('a string port (as some drivers return it) is accepted', identityError({ ...GOOD_IDENTITY, port: '5432' }) === null, null);
check('an IPv6 loopback address is accepted', identityError({ ...GOOD_IDENTITY, addr: '::1' }) === null, null);
check('no reported address (a socket) is tolerated when everything else matches', identityError({ ...GOOD_IDENTITY, addr: null }) === null, null);
for (const [label, identity] of Object.entries({
  'the same name on another instance (another port)': { ...GOOD_IDENTITY, port: 5433 },
  'another database name': { ...GOOD_IDENTITY, db: 'shop_dev' },
  'another user': { ...GOOD_IDENTITY, usr: 'dev' },
  'no reported port': { ...GOOD_IDENTITY, port: null },
  'a server address that is not loopback': { ...GOOD_IDENTITY, addr: '10.1.2.3' },
  'no identity at all': null,
})) {
  const message = identityError(identity);
  check(`${label} is refused without quoting a value`, message !== null && !/10\.1\.2\.3|shop_dev|5433/.test(message), message);
}

console.log('\n── child process: the real server/config/env.js');

// Replaces `dotenv` (the real .env is never read) and `pg` (a connection can never open).
const STUBS = `
  const stub = (name, exports) => {
    const file = require.resolve(name);
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
  };
  stub('dotenv', { config() { return {}; } });
  stub('pg', {
    Pool: function Pool() { throw new Error('PG_TOUCHED'); },
    types: { setTypeParser() {}, builtins: { NUMERIC: 1700 } },
  });
`;

// Replaces `dotenv`, `pg` and the migration runner with recorders: every use is printed, so
// a test can check that something happened (or did not) and in which order. The identity
// the fake server reports comes from STUB_IDENTITY; STUB_FAIL_QUERY and STUB_FAIL_MIGRATE
// make the first query or the migrations fail.
const STUBS_RECORDING = `
  const stub = (name, exports) => {
    const file = require.resolve(name);
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
  };
  stub('dotenv', { config() { return {}; } });
  function Pool() { console.log('PG:pool'); }
  Pool.prototype.on = function on() {};
  Pool.prototype.query = async function query(text) {
    const sql = String(text).trim();
    const kind = sql.includes('current_database') ? 'identity'
      : sql.startsWith('CREATE') ? 'create'
        : sql.startsWith('DROP') ? 'drop'
          : sql.includes('to_regclass') ? 'catalog' : 'other';
    console.log('PG:query:' + kind);
    if (process.env.STUB_FAIL_QUERY) throw new Error('stub: connection refused');
    if (kind === 'create' && process.env.STUB_FAIL_CREATE) throw new Error('stub: create stopped');
    if (kind === 'catalog') return { rows: [{ found: process.env.STUB_MIGRATED ? 'schema_migrations' : null }] };
    return { rows: [JSON.parse(process.env.STUB_IDENTITY || 'null')] };
  };
  Pool.prototype.connect = async function connect() { throw new Error('PG_TOUCHED'); };
  Pool.prototype.end = async function end() { console.log('PG:end'); };
  stub('pg', { Pool, types: { setTypeParser() {}, builtins: { NUMERIC: 1700 } } });
  stub('./server/db/migrate', {
    runMigrations: async () => {
      console.log('MIGRATE');
      if (process.env.STUB_FAIL_MIGRATE) throw new Error('stub: migration failed');
    },
  });
`;

/** A clean environment: only what the interpreter needs, plus `vars`. */
function cleanEnv(vars) {
  const base = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP']) {
    if (process.env[key]) base[key] = process.env[key];
  }
  return { ...base, ...vars };
}

/** Runs `code` in a clean child process with the stubs; returns its status and output. */
function runChild(code, vars) {
  const run = spawnSync(process.execPath, ['-e', STUBS + code], {
    cwd: ROOT, env: cleanEnv(vars), encoding: 'utf8', timeout: 30_000,
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}`, stdout: run.stdout };
}

const BASE_VARS = { ...DEV, ADMIN_PASSWORD: 'admin-pw-for-test', MAIL_ENABLED: 'false' };

const loaded = runChild(`
  const g = require('./test/lib/testDatabase');
  const target = g.prepareTestDatabase();
  const cfg = require('./server/config/env');
  g.assertEffectiveDatabase(target, cfg.db);
  console.log('EFFECTIVE:' + JSON.stringify({
    host: cfg.db.host, port: cfg.db.port, name: cfg.db.name, user: cfg.db.user,
    passwordIsTheTestOne: cfg.db.password === 'pw-local',
  }));
`, { ...BASE_VARS, TEST_DATABASE_URL: LOCAL_URL });
const effectiveLine = (loaded.stdout || '').split('\n').find((line) => line.startsWith('EFFECTIVE:'));
const effectiveConfig = effectiveLine ? JSON.parse(effectiveLine.slice('EFFECTIVE:'.length)) : null;
check('the real env.js loads the test database after the translation',
  effectiveConfig && effectiveConfig.name === 'shop_test' && effectiveConfig.user === 'tester'
  && effectiveConfig.host === 'localhost' && effectiveConfig.port === 5432 && effectiveConfig.passwordIsTheTestOne, loaded);
check('the effective database is not the development database (shop_dev)', effectiveConfig && effectiveConfig.name !== 'shop_dev', effectiveConfig);
check('no database connection was attempted', !loaded.output.includes('PG_TOUCHED'), loaded.output);
check('the output prints no password', !loaded.output.includes('pw-local') && !loaded.output.includes('pw-dev'), loaded.output);

// If the translation did not take effect, the server would still load the development
// database; the effective check must notice, even though TEST_DATABASE_URL is set.
const bypassed = runChild(`
  const g = require('./test/lib/testDatabase');
  const target = g.prepareTestDatabase({ ...process.env });
  const cfg = require('./server/config/env');
  console.log('LOADED:' + cfg.db.name);
  try { g.assertEffectiveDatabase(target, cfg.db); console.log('NO_ERROR'); }
  catch (err) { console.log('THROWN:' + err.message); }
`, { ...BASE_VARS, TEST_DATABASE_URL: LOCAL_URL });
check('an untranslated environment loads the development database', bypassed.output.includes('LOADED:shop_dev'), bypassed.output);
check('and the effective check rejects it, although TEST_DATABASE_URL is set',
  bypassed.output.includes('THROWN:') && !bypassed.output.includes('NO_ERROR'), bypassed.output);

console.log('\n── child process: test/run-all.js is an orchestrator only');

/** Runs test/run-all.js with the given variables; it must end before the first suite. */
function runAll(vars) {
  return runChild("require('./test/run-all.js');", { ...BASE_VARS, ...vars });
}

for (const [label, vars, expected] of [
  ['NODE_ENV=production', { NODE_ENV: 'production', TEST_DATABASE_URL: LOCAL_URL }, 'production'],
  ['TEST_DATABASE_URL missing', {}, 'TEST_DATABASE_URL'],
  ['TEST_DATABASE_URL empty', { TEST_DATABASE_URL: '' }, 'TEST_DATABASE_URL'],
  ['TEST_DATABASE_URL malformed', { TEST_DATABASE_URL: 'not a url, secret-token-9' }, 'TEST_DATABASE_URL'],
  ['TEST_DATABASE_URL remote', { TEST_DATABASE_URL: REMOTE_URL }, 'TEST_DATABASE_URL'],
  ['TEST_DATABASE_URL is the development database', { TEST_DATABASE_URL: DEV_URL }, 'DB_*'],
  ['TEST_DATABASE_URL is the development database and the marker is set', { TEST_DATABASE_URL: DEV_URL, TEST_DATABASE_GUARDED: '1' }, 'DB_*'],
]) {
  const run = runAll(vars);
  check(`${label}: run-all exits non-zero before any suite or connection`,
    run.status !== 0 && !run.output.includes('═══') && !run.output.includes('PG_TOUCHED') && run.output.includes(expected), run);
  check(`${label}: the output prints no secret`,
    !/pw-remote-123|pw-local|pw-dev|secret-token-9/.test(run.output), run.output);
}
const runAllSource = fs.readFileSync(path.join(__dirname, 'run-all.js'), 'utf8');
check('run-all.js neither loads the server nor the database code',
  !/server\/(app|config|db)|createApp|\.listen\(|runMigrations|require\('pg'\)/.test(runAllSource), null);
check('run-all.js hands no server address to the suites (NEW_URL is deleted from their environment)',
  /delete env\.NEW_URL/.test(runAllSource) && !/NEW_URL:/.test(runAllSource), null);

/** Like runChild, but without blocking the event loop, so a fake server can answer meanwhile. */
function runChildAsync(code, vars, stubs = STUBS) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', stubs + code], { cwd: ROOT, env: cleanEnv(vars) });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill(), 30_000);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, output });
    });
  });
}

/** A local HTTP server that counts every request it gets; a suite must never reach it. */
function trapServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', database: 'shop_test' }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

/** Runs `code` against the recording stubs. */
function serverChild(code, vars) {
  return runChildAsync(code, { ...BASE_VARS, ...vars }, STUBS_RECORDING);
}

const GOOD = JSON.stringify(GOOD_IDENTITY);
const START = `
  const t = require('./test/lib/testServer');
  (async () => {
    try {
      const s = await t.startTestServer();
      console.log('STARTED:' + /^http:\\/\\/127\\.0\\.0\\.1:\\d+$/.test(s.baseUrl));
      await s.close();
      await s.close();
      const up = await fetch(s.baseUrl + '/x', { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
      console.log('STILL_UP:' + up);
    } catch (err) {
      console.log('FAILED:' + err.message);
    }
  })();
`;

/** The position of `marker` in the output, or -1. */
const at = (output, marker) => output.indexOf(marker);
const count = (output, marker) => output.split(marker).length - 1;

async function main() {
  console.log('\n── startTestServer: the order of events (recording stubs, no connection)');
  const trap = await trapServer();
  const run = await serverChild(START, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD, NEW_URL: trap.url });
  check('a matching identity starts a server on a local, dynamically chosen port',
    run.output.includes('STARTED:true') && !run.output.includes('FAILED:'), run.output);
  check('the identity is the first thing sent to PostgreSQL, before the migrations',
    at(run.output, 'PG:query:identity') !== -1 && at(run.output, 'PG:query:identity') < at(run.output, 'MIGRATE')
    && !run.output.includes('PG:query:other'), run.output);
  check('close() ends the database pool exactly once, even when called twice', count(run.output, 'PG:end') === 1, run.output);
  check('and the server no longer answers after close()', run.output.includes('STILL_UP:false'), run.output);
  check('a NEW_URL in the environment is never contacted', trap.requests.length === 0, trap.requests);
  check('the output prints no password', !/pw-local|pw-dev/.test(run.output), run.output);

  console.log('\n── startTestServer: refusals before any connection');
  for (const [label, vars, expected] of [
    ['TEST_DATABASE_URL missing', {}, 'TEST_DATABASE_URL'],
    ['NODE_ENV=production', { NODE_ENV: 'production', TEST_DATABASE_URL: LOCAL_URL }, 'production'],
    ['TEST_DATABASE_URL remote', { TEST_DATABASE_URL: REMOTE_URL }, 'TEST_DATABASE_URL'],
    ['TEST_DATABASE_URL is the development database', { TEST_DATABASE_URL: DEV_URL }, 'DB_*'],
    ['the development database with a hand-set TEST_DATABASE_GUARDED', { TEST_DATABASE_URL: DEV_URL, TEST_DATABASE_GUARDED: '1' }, 'DB_*'],
  ]) {
    const refused = await serverChild(START, { STUB_IDENTITY: GOOD, ...vars });
    check(`${label}: refused, no pool created, no server, no secret printed`,
      refused.output.includes('FAILED:') && refused.output.includes(expected) && !refused.output.includes('PG:')
      && !refused.output.includes('STARTED') && !/pw-remote-123|pw-local|pw-dev/.test(refused.output), refused.output);
  }
  const early = await serverChild(`
    require('./server/config/env');
    ${START}
  `, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD });
  check('server configuration that was loaded before the guard ran is refused, before any pool',
    early.output.includes('FAILED:') && !early.output.includes('PG:') && !early.output.includes('STARTED'), early.output);

  console.log('\n── startTestServer: the PostgreSQL identity is verified, and a mismatch cleans up');
  for (const [label, identity] of Object.entries({
    'the same database name on another instance (another port)': { ...GOOD_IDENTITY, port: 5433 },
    'another database name': { ...GOOD_IDENTITY, db: 'shop_dev' },
    'another user': { ...GOOD_IDENTITY, usr: 'dev' },
    'no reported port': { ...GOOD_IDENTITY, port: null },
    'a server address that is not loopback': { ...GOOD_IDENTITY, addr: '10.1.2.3' },
    'no identity at all': null,
  })) {
    const mismatch = await serverChild(START, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: JSON.stringify(identity) });
    check(`${label}: refused before the migrations and before any server`,
      mismatch.output.includes('FAILED:') && !mismatch.output.includes('MIGRATE') && !mismatch.output.includes('STARTED'), mismatch.output);
    check(`${label}: the pool is closed`, count(mismatch.output, 'PG:end') === 1, mismatch.output);
  }

  console.log('\n── startTestServer: a failure half way through leaves nothing open');
  const noConnection = await serverChild(START, { TEST_DATABASE_URL: LOCAL_URL, STUB_FAIL_QUERY: '1' });
  check('the identity query fails: refused, pool closed, no migrations',
    noConnection.output.includes('FAILED:') && count(noConnection.output, 'PG:end') === 1 && !noConnection.output.includes('MIGRATE'), noConnection.output);
  const badMigration = await serverChild(START, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD, STUB_FAIL_MIGRATE: '1' });
  check('a migration fails: refused, pool closed, no server',
    badMigration.output.includes('FAILED:') && count(badMigration.output, 'PG:end') === 1 && !badMigration.output.includes('STARTED'), badMigration.output);
  const busy = await serverChild(`
    const net = require('net');
    const t = require('./test/lib/testServer');
    const blocker = net.createServer().listen(0, '127.0.0.1', async () => {
      try {
        await t.startTestServer(process.env, { port: blocker.address().port });
        console.log('STARTED');
      } catch (err) {
        console.log('FAILED:' + err.code);
      }
      blocker.close();
    });
  `, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD });
  check('the port is taken: refused after the migrations, and the pool is closed',
    busy.output.includes('FAILED:EADDRINUSE') && count(busy.output, 'PG:end') === 1, busy.output);

  console.log('\n── runHttpSuite: the frame every HTTP suite runs in');
  const FRAME = `
    const t = require('./test/lib/testServer');
    t.runHttpSuite(async (url) => {
      console.log('BODY:' + /^http:\\/\\/127\\.0\\.0\\.1:\\d+$/.test(url));
      if (process.env.MODE === 'crash') throw new Error('boom');
      if (process.env.MODE === 'fail') process.exitCode = 1;
    }, () => console.log('ONCRASH'));
  `;
  const passing = await serverChild(FRAME, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD });
  check('a suite that passes exits 0 and the database pool is closed afterwards',
    passing.status === 0 && at(passing.output, 'BODY:true') !== -1 && at(passing.output, 'BODY:true') < at(passing.output, 'PG:end')
    && count(passing.output, 'PG:end') === 1, passing);
  const failing = await serverChild(FRAME, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD, MODE: 'fail' });
  check('a suite that reports failures through process.exitCode keeps its exit code', failing.status === 1 && count(failing.output, 'PG:end') === 1, failing);
  const crashing = await serverChild(FRAME, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD, MODE: 'crash' });
  check('a suite that throws exits 1, runs its own cleanup first, then closes the pool',
    crashing.status === 1 && at(crashing.output, 'ONCRASH') !== -1 && at(crashing.output, 'ONCRASH') < at(crashing.output, 'PG:end')
    && count(crashing.output, 'PG:end') === 1, crashing);
  const refusedFrame = await serverChild(FRAME, { STUB_IDENTITY: GOOD });
  check('a refusal exits 1 without running the suite or creating a pool',
    refusedFrame.status === 1 && !refusedFrame.output.includes('BODY') && !refusedFrame.output.includes('PG:'), refusedFrame);
  const wrongIdentity = await serverChild(FRAME, { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: JSON.stringify({ ...GOOD_IDENTITY, port: 5433 }) });
  check('a wrong PostgreSQL identity exits 1 without running the suite, and closes the pool',
    wrongIdentity.status === 1 && !wrongIdentity.output.includes('BODY') && count(wrongIdentity.output, 'PG:end') === 1, wrongIdentity);

  console.log('\n── every HTTP suite, started directly (node test/<suite>.js)');
  const SMOKE_SUITES = [
    'smoke-auth', 'smoke-orders', 'smoke-pigments', 'smoke-products',
    'smoke-reviews', 'smoke-settings', 'smoke-static',
  ];
  const cases = [
    ['TEST_DATABASE_URL missing', { STUB_IDENTITY: GOOD }, 'TEST_DATABASE_URL', false],
    ['NODE_ENV=production', { NODE_ENV: 'production', TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD }, 'production', false],
    ['TEST_DATABASE_URL is the development database', { TEST_DATABASE_URL: DEV_URL, STUB_IDENTITY: GOOD }, 'DB_*', false],
    ['the PostgreSQL identity does not match', { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: JSON.stringify({ ...GOOD_IDENTITY, db: 'shop_dev' }) }, 'PostgreSQL', true],
  ];
  for (const suite of SMOKE_SUITES) {
    const source = fs.readFileSync(path.join(__dirname, `${suite}.js`), 'utf8');
    check(`${suite}: runs inside runHttpSuite and never reads NEW_URL`, source.includes('runHttpSuite(') && !source.includes('NEW_URL'), null);
    for (const [label, vars, expected, pool] of cases) {
      const outcome = await serverChild(`require('./test/${suite}.js');`, { ...vars, NEW_URL: trap.url });
      check(`${suite}: ${label} → exits non-zero before any test runs, the trap server is never contacted`,
        outcome.status !== 0 && outcome.output.includes(expected) && !outcome.output.includes('MIGRATE')
        && (pool ? count(outcome.output, 'PG:end') === 1 : !outcome.output.includes('PG:')), { status: outcome.status, output: outcome.output });
    }
  }
  check('no suite request reached the trap server, whatever NEW_URL said', trap.requests.length === 0, trap.requests);
  await trap.close();

  console.log('\n── smoke-fresh-db and the accessibility audit, started directly');
  const freshCases = [
    ['TEST_DATABASE_URL missing', {}, 'TEST_DATABASE_URL'],
    ['TEST_DATABASE_URL is the development database', { TEST_DATABASE_URL: DEV_URL }, 'DB_*'],
    ['TEST_DATABASE_URL remote', { TEST_DATABASE_URL: REMOTE_URL }, 'TEST_DATABASE_URL'],
    ['the development database with a hand-set marker', { TEST_DATABASE_URL: DEV_URL, TEST_DATABASE_GUARDED: '1' }, 'DB_*'],
  ];
  for (const [label, vars, expected] of freshCases) {
    const outcome = await runChildAsync("require('./test/smoke-fresh-db.js');", { ...BASE_VARS, ...vars });
    check(`smoke-fresh-db: ${label} → exits non-zero before any database object is created`,
      outcome.status !== 0 && !outcome.output.includes('PG_TOUCHED') && outcome.output.includes(expected), outcome);
    check(`smoke-fresh-db: ${label} → prints no secret`, !/pw-remote-123|pw-local|pw-dev/.test(outcome.output), outcome.output);
  }
  // The recording stubs answer the identity query; STUB_FAIL_CREATE stops the suite when it
  // tries to create its temporary database, so the child processes it would start afterwards
  // (which have no stub) never run.
  const FRESH_CASES = [
    ['the PostgreSQL identity does not match (another port)', { STUB_IDENTITY: JSON.stringify({ ...GOOD_IDENTITY, port: 5433 }), STUB_MIGRATED: '1' }],
    ['the PostgreSQL identity does not match (another database)', { STUB_IDENTITY: JSON.stringify({ ...GOOD_IDENTITY, db: 'shop_dev' }), STUB_MIGRATED: '1' }],
    ['no identity is reported', { STUB_MIGRATED: '1' }],
    ['the test database has no schema yet', { STUB_IDENTITY: GOOD }],
  ];
  for (const [label, extra] of FRESH_CASES) {
    const outcome = await serverChild("require('./test/smoke-fresh-db.js');", { TEST_DATABASE_URL: LOCAL_URL, ...extra });
    check(`smoke-fresh-db: ${label} → exits non-zero, creates nothing, closes its pool`,
      outcome.status !== 0 && !outcome.output.includes('PG:query:create') && !outcome.output.includes('PG:query:drop')
      && count(outcome.output, 'PG:end') === 1, outcome);
  }
  const reachesCreate = await serverChild("require('./test/smoke-fresh-db.js');",
    { TEST_DATABASE_URL: LOCAL_URL, STUB_IDENTITY: GOOD, STUB_MIGRATED: '1', STUB_FAIL_CREATE: '1' });
  check('smoke-fresh-db: only a matching identity on a migrated test database reaches the create step, and the identity is checked first',
    at(reachesCreate.output, 'PG:query:identity') !== -1
    && at(reachesCreate.output, 'PG:query:identity') < at(reachesCreate.output, 'PG:query:catalog')
    && at(reachesCreate.output, 'PG:query:catalog') < at(reachesCreate.output, 'PG:query:create')
    && !reachesCreate.output.includes('PG:query:drop'), reachesCreate.output);
  const passesGuard = await runChildAsync("require('./test/smoke-fresh-db.js');", { ...BASE_VARS, TEST_DATABASE_URL: LOCAL_URL });
  check('smoke-fresh-db: with a valid test database it gets past the guard and stops at the stubbed pg (no connection)',
    passesGuard.output.includes('PG_TOUCHED'), passesGuard.output);
  const auditSource = fs.readFileSync(path.join(ROOT, 'scripts', 'a11y-audit.js'), 'utf8');
  check('the accessibility audit starts its server through startTestServer, not on its own',
    auditSource.includes('startTestServer(') && !/createApp|runMigrations|\.listen\(/.test(auditSource), null);

  console.log('\n── the marker is gone everywhere else');
  const strays = [];
  for (const dir of [__dirname, path.join(__dirname, 'lib'), path.join(ROOT, 'scripts')]) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (!name.endsWith('.js') || file === __filename || !fs.statSync(file).isFile()) continue;
      if (/TEST_DATABASE_GUARDED|ensureTestDatabase|requireTestServer\b/.test(fs.readFileSync(file, 'utf8'))) strays.push(path.relative(ROOT, file));
    }
  }
  check('no other test or script file mentions TEST_DATABASE_GUARDED, ensureTestDatabase or requireTestServer', strays.length === 0, strays);

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
