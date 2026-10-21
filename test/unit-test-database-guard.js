/**
 * בודק את השמירה שמונעת מהבדיקות לגעת במסד שאינו מקומי
 * (test/lib/testDatabase.js), ושהמריץ עצמו באמת נעצר לפני שהוא פותח חיבור.
 *
 * המקרים הראשונים רצים על אובייקט סביבה מזויף; האחרונים מריצים את
 * test/run-all.js בתהליך נפרד, כדי להוכיח שהשמירה מחוברת אליו.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { prepareTestDatabase } = require('./lib/testDatabase');

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

/** Runs the guard on a fake environment; returns the result or the error message. */
function guard(env) {
  try {
    return { result: prepareTestDatabase({ ...env }) };
  } catch (err) {
    return { error: err.message };
  }
}

const LOCAL_URL = 'postgresql://tester:pw-local@localhost:5432/shop_test';
const REMOTE_URL = 'postgresql://app:pw-remote-123@db.example.test:5432/shop';

console.log('\n── ייצור');
const prod = guard({ NODE_ENV: 'production', TEST_DATABASE_URL: LOCAL_URL });
check('NODE_ENV=production — מסרב גם עם מסד מקומי', prod.error && prod.error.includes('production'), prod);

console.log('\n── TEST_DATABASE_URL');
const env = { TEST_DATABASE_URL: LOCAL_URL, DATABASE_URL: REMOTE_URL };
const applied = { ...env };
const ok = (() => {
  try {
    return { result: prepareTestDatabase(applied) };
  } catch (err) {
    return { error: err.message };
  }
})();
check('כתובת מקומית — מתקבלת', ok.result && ok.result.source === 'TEST_DATABASE_URL', ok);
check('היא גוברת על DATABASE_URL מרוחק שנשאר בסביבה', applied.DATABASE_URL === LOCAL_URL, applied.DATABASE_URL);

const remoteTest = guard({ TEST_DATABASE_URL: REMOTE_URL });
check('כתובת מרוחקת — מסרב ונוקב בשם המשתנה', remoteTest.error && remoteTest.error.includes('TEST_DATABASE_URL'), remoteTest);
check('ההודעה אינה מדפיסה סיסמה או כתובת', remoteTest.error && !remoteTest.error.includes('pw-remote-123') && !remoteTest.error.includes('db.example.test'), remoteTest);

const garbage = guard({ TEST_DATABASE_URL: 'not a url, secret-token-9' });
check('כתובת לא תקינה — מסרב בלי להדפיס את הערך', garbage.error && !garbage.error.includes('secret-token-9'), garbage);

const DEV = { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'shop_dev' };
const sameAsDev = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://tester:pw@localhost:5432/shop_dev' });
check('מסד הפיתוח עצמו — מסרב', sameAsDev.error && sameAsDev.error.includes('TEST_DATABASE_URL'), sameAsDev);
const sameViaIp = guard({ ...DEV, TEST_DATABASE_URL: 'postgresql://tester:pw@127.0.0.1:5432/shop_dev' });
check('מסד הפיתוח דרך 127.0.0.1 — מסרב', sameViaIp.error && sameViaIp.error.includes('TEST_DATABASE_URL'), sameViaIp);
const otherDb = guard({ ...DEV, TEST_DATABASE_URL: LOCAL_URL });
check('מסד אחר באותו שרת — מתקבל', otherDb.result && otherDb.result.host === 'localhost', otherDb);

console.log('\n── בלי TEST_DATABASE_URL');
for (const [name, extra] of [
  ['בלי שום הגדרה', {}],
  ['DB_HOST מקומי', { DB_HOST: 'localhost' }],
  ['DATABASE_URL מקומי', { DATABASE_URL: LOCAL_URL }],
  ['DATABASE_URL מרוחק', { DATABASE_URL: REMOTE_URL }],
  ['DB_HOST מרוחק', { DB_HOST: 'db.example.test' }],
]) {
  const out = guard(extra);
  check(`${name} — מסרב ונוקב ב-TEST_DATABASE_URL`, out.error && out.error.includes('TEST_DATABASE_URL'), out);
}

console.log('\n── המריץ עצמו');
const RUN_ALL = path.join(__dirname, 'run-all.js');

/** Runs test/run-all.js with the given variables and returns how it ended. */
function runAll(overrides) {
  const run = spawnSync(process.execPath, [RUN_ALL], {
    env: { ...process.env, ...overrides },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

const prodRun = runAll({ NODE_ENV: 'production' });
check('NODE_ENV=production — run-all נכשל לפני כל חבילה', prodRun.status !== 0 && !prodRun.output.includes('═══'), prodRun);

const unsetRun = runAll({ TEST_DATABASE_URL: '' });
check('בלי TEST_DATABASE_URL — run-all נכשל לפני כל חבילה', unsetRun.status !== 0 && !unsetRun.output.includes('═══')
  && unsetRun.output.includes('TEST_DATABASE_URL'), unsetRun);

const remoteRun = runAll({ TEST_DATABASE_URL: REMOTE_URL });
check('TEST_DATABASE_URL מרוחק — run-all נכשל לפני כל חבילה', remoteRun.status !== 0 && !remoteRun.output.includes('═══'), remoteRun);
check('ואינו מדפיס את הסיסמה', !remoteRun.output.includes('pw-remote-123'));

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
