/**
 * Tests the guard that keeps the suites away from every database except a separate local
 * one (test/lib/testDatabase.js).
 *
 * Nothing here opens a database connection:
 *   - the first groups run the guard on fake environment objects;
 *   - the child-process groups load the real server/config/env.js and test/run-all.js in
 *     a clean process with `dotenv` (so the real .env file is never read) and `pg` (so a
 *     connection can never be opened) replaced by stubs. A stubbed `pg` that is touched
 *     throws PG_TOUCHED, which a test would report.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const {
  prepareTestDatabase, assertEffectiveDatabase, describeTestDatabase,
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
const sameAsDev = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5432/shop_dev' });
check('the same server and database name as DB_* refuses', sameAsDev.error && sameAsDev.error.includes('DB_*') && !sameAsDev.error.includes('pw-dev'), sameAsDev);
const synonym = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@127.0.0.1:5432/shop_dev' });
check('127.0.0.1 and localhost count as the same server', synonym.error && synonym.error.includes('DB_*'), synonym);
const v6 = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@[::1]:5432/shop_dev' });
check('[::1] counts as the same server', v6.error && v6.error.includes('DB_*'), v6);
const defaults = guard({ TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5432/tamburia' });
check('with DB_* unset, the default development database (tamburia) refuses', defaults.error && defaults.error.includes('DB_*'), defaults);
const otherDb = guard({ ...DEV, TEST_DATABASE_URL: LOCAL_URL });
check('the same server but another database name is accepted', otherDb.result && otherDb.result.name === 'shop_test', otherDb);
const otherPort = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5433/shop_dev' });
check('the same name on another port is accepted', otherPort.result && otherPort.result.port === 5433, otherPort);

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

console.log('\n── child process: test/run-all.js stops before any suite');

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
  ['TEST_DATABASE_URL is the development database', { TEST_DATABASE_URL: 'postgresql://dev:pw-dev@localhost:5432/shop_dev' }, 'DB_*'],
]) {
  const run = runAll(vars);
  check(`${label}: run-all exits non-zero before any suite or connection`,
    run.status !== 0 && !run.output.includes('═══') && !run.output.includes('PG_TOUCHED') && run.output.includes(expected), run);
  check(`${label}: the output prints no secret`,
    !/pw-remote-123|pw-local|pw-dev|secret-token-9/.test(run.output), run.output);
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
