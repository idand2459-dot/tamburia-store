/**
 * Checks scripts/lib/demoTarget.js: which databases the demo scripts may touch. Fake URLs only, no
 * connection. Every refusal names the variable or flag at fault and never quotes the URL.
 */
const { resolveDemoTarget, applyDemoTarget, parseDatabaseUrl, parseArgs } = require('../scripts/lib/demoTarget');

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

const PASSWORD = 'fake-demo-password-123';
const REMOTE = `postgresql://demo_user:${PASSWORD}@ep-fake-1.example.neon.tech:5432/demo_db`;
const LOCAL = `postgresql://demo_user:${PASSWORD}@localhost:5432/scratch_demo`;
const DEV_ENV = { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'tamburia_dev' };

/** Runs resolveDemoTarget and returns { target } or { message }. */
function resolve(overrides = {}) {
  try {
    return {
      target: resolveDemoTarget({
        env: { DEMO_DATABASE_URL: REMOTE, ...DEV_ENV, ...overrides.env },
        confirmHost: 'ep-fake-1.example.neon.tech',
        confirmDatabase: 'demo_db',
        allowLocal: false,
        ...overrides.args,
      }),
    };
  } catch (err) {
    return { message: err.message };
  }
}

/** Whether the refusal names `key` and never quotes the password or the host. */
const refusesNaming = (result, key) => Boolean(result.message) && result.message.includes(key)
  && !result.message.includes(PASSWORD) && !result.message.includes('ep-fake-1');

console.log('\n── כתובת תקינה');
{
  const ok = resolve();
  check('כתובת מרוחקת עם אישורים תואמים — מתקבלת', ok.target && ok.target.host === 'ep-fake-1.example.neon.tech'
    && ok.target.name === 'demo_db' && ok.target.local === false, ok);
  const upper = resolve({ args: { confirmHost: 'EP-FAKE-1.example.neon.tech' } });
  check('אישור המארח אינו תלוי באותיות גדולות', Boolean(upper.target), upper);
}

console.log('\n── סירובים');
{
  check('בלי DEMO_DATABASE_URL — מסרב ונוקב בשם', refusesNaming(resolve({ env: { DEMO_DATABASE_URL: '' } }), 'DEMO_DATABASE_URL'));
  for (const [name, url] of [
    ['לא כתובת', 'not a url'],
    ['פרוטוקול שגוי', 'mysql://u:p@host:3306/db'],
    ['עם פרמטרים', `${REMOTE}?sslmode=require`],
    ['בלי סיסמה', 'postgresql://demo_user@ep-fake-1.example.neon.tech/demo_db'],
    ['בלי שם מסד', `postgresql://demo_user:${PASSWORD}@ep-fake-1.example.neon.tech/`],
    ['בלי משתמש', `postgresql://:${PASSWORD}@ep-fake-1.example.neon.tech/demo_db`],
  ]) {
    check(`${name} — מסרב ונוקב בשם המשתנה, בלי סיסמה`, refusesNaming(resolve({ env: { DEMO_DATABASE_URL: url } }), 'DEMO_DATABASE_URL'), resolve({ env: { DEMO_DATABASE_URL: url } }));
  }
  check('בלי --confirm-host — מסרב', refusesNaming(resolve({ args: { confirmHost: undefined } }), '--confirm-host'));
  check('בלי --confirm-database — מסרב', refusesNaming(resolve({ args: { confirmDatabase: undefined } }), '--confirm-database'));
  check('--confirm-host שונה — מסרב', refusesNaming(resolve({ args: { confirmHost: 'other.example.com' } }), '--confirm-host'));
  check('--confirm-database שונה — מסרב', refusesNaming(resolve({ args: { confirmDatabase: 'other_db' } }), '--confirm-database'));
}

console.log('\n── מארח מקומי, מסד פיתוח ומסד בדיקות');
{
  const localEnv = { env: { DEMO_DATABASE_URL: LOCAL } };
  const noFlag = resolve({ ...localEnv, args: { confirmHost: 'localhost', confirmDatabase: 'scratch_demo' } });
  check('מארח מקומי בלי --allow-local — מסרב', refusesNaming(noFlag, '--allow-local'), noFlag);
  const withFlag = resolve({ ...localEnv, args: { confirmHost: 'localhost', confirmDatabase: 'scratch_demo', allowLocal: true } });
  check('מארח מקומי עם --allow-local — מתקבל', withFlag.target && withFlag.target.local === true, withFlag);
  const remoteFlag = resolve({ args: { allowLocal: true } });
  check('--allow-local עם מארח מרוחק — מסרב', refusesNaming(remoteFlag, '--allow-local'), remoteFlag);

  const dev = resolve({
    env: { DEMO_DATABASE_URL: `postgresql://u:${PASSWORD}@127.0.0.1:5432/tamburia_dev` },
    args: { confirmHost: '127.0.0.1', confirmDatabase: 'tamburia_dev', allowLocal: true },
  });
  check('מסד הפיתוח (localhost מול 127.0.0.1) — מסרב ונוקב ב-DB_*', refusesNaming(dev, 'DB_*'), dev);
  const devDefault = resolve({
    env: { DEMO_DATABASE_URL: `postgresql://u:${PASSWORD}@localhost:5432/tamburia`, DB_HOST: '', DB_PORT: '', DB_NAME: '' },
    args: { confirmHost: 'localhost', confirmDatabase: 'tamburia', allowLocal: true },
  });
  check('מסד הפיתוח לפי ברירות המחדל — מסרב', refusesNaming(devDefault, 'DB_*'), devDefault);
  const sameNameOtherServer = resolve({ env: { DEMO_DATABASE_URL: REMOTE.replace('/demo_db', '/tamburia_dev') }, args: { confirmDatabase: 'tamburia_dev' } });
  check('אותו שם מסד בשרת אחר — מותר', Boolean(sameNameOtherServer.target), sameNameOtherServer);

  const test = resolve({
    env: { TEST_DATABASE_URL: `postgresql://t:${PASSWORD}@localhost:5432/scratch_test`, DEMO_DATABASE_URL: `postgresql://u:${PASSWORD}@localhost:5432/scratch_test` },
    args: { confirmHost: 'localhost', confirmDatabase: 'scratch_test', allowLocal: true },
  });
  check('מסד הבדיקות — מסרב ונוקב ב-TEST_DATABASE_URL', refusesNaming(test, 'TEST_DATABASE_URL'), test);
  const badTestUrl = resolve({ env: { TEST_DATABASE_URL: 'garbage' } });
  check('TEST_DATABASE_URL פגום אינו מפיל את הבדיקה', Boolean(badTestUrl.target), badTestUrl);
}

console.log('\n── החלת היעד על הסביבה');
{
  const env = { DATABASE_URL: 'x' };
  const target = resolve().target;
  applyDemoTarget(env, target);
  check('DB_* מועתק מהיעד', env.DB_HOST === target.host && env.DB_NAME === 'demo_db' && env.DB_USER === 'demo_user'
    && env.DB_PASSWORD === PASSWORD && env.DB_PORT === '5432');
  check('יעד מרוחק: DB_SSL=true', env.DB_SSL === 'true');
  check('פיתוח, בלי מייל ובלי מצב הדגמה', env.NODE_ENV === 'development' && env.MAIL_ENABLED === 'false' && env.DEMO_MODE === 'false');
  check('DATABASE_URL נמחק', env.DATABASE_URL === undefined);
  const localEnv = {};
  applyDemoTarget(localEnv, { ...target, local: true });
  check('יעד מקומי: DB_SSL=false', localEnv.DB_SSL === 'false');
}

console.log('\n── פענוח כתובת ודגלים');
{
  const parsed = parseDatabaseUrl('postgres://us%40er:p%23ss@HOST.example.com/db%20x', 'DEMO_DATABASE_URL');
  check('רכיבים מקודדים מפוענחים, המארח באותיות קטנות', parsed.user === 'us@er' && parsed.password === 'p#ss'
    && parsed.name === 'db x' && parsed.host === 'host.example.com' && parsed.port === 5432, parsed);
  const args = parseArgs(['--allow-local', '--confirm-host', 'h', '--database-id', 'abc'], {
    flags: ['allow-local'], values: ['confirm-host', 'database-id'],
  });
  check('דגלים וערכים מפוענחים', args['allow-local'] === true && args['confirm-host'] === 'h' && args['database-id'] === 'abc', args);
  for (const bad of [['--unknown'], ['stray'], ['--confirm-host'], ['--confirm-host', '--allow-local']]) {
    let message = '';
    try {
      parseArgs(bad, { flags: ['allow-local'], values: ['confirm-host'] });
    } catch (err) {
      message = err.message;
    }
    check(`ארגומנט שגוי ${JSON.stringify(bad)} — נדחה`, message !== '', message);
  }
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
