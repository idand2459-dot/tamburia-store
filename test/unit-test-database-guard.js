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
check('כתובת מקומית — מתקבלת כמסד נפרד', ok.result && ok.result.separate === true, ok);
check('היא גוברת על DATABASE_URL מרוחק שנשאר בסביבה', applied.DATABASE_URL === LOCAL_URL, applied.DATABASE_URL);

const remoteTest = guard({ TEST_DATABASE_URL: REMOTE_URL });
check('כתובת מרוחקת — מסרב ונוקב בשם המשתנה', remoteTest.error && remoteTest.error.includes('TEST_DATABASE_URL'), remoteTest);
check('ההודעה אינה מדפיסה סיסמה או כתובת', remoteTest.error && !remoteTest.error.includes('pw-remote-123') && !remoteTest.error.includes('db.example.test'), remoteTest);

const garbage = guard({ TEST_DATABASE_URL: 'not a url, secret-token-9' });
check('כתובת לא תקינה — מסרב בלי להדפיס את הערך', garbage.error && !garbage.error.includes('secret-token-9'), garbage);

console.log('\n── בלי TEST_DATABASE_URL');
const dbHostRemote = guard({ DB_HOST: 'db.example.test' });
check('DB_HOST מרוחק — מסרב', dbHostRemote.error && dbHostRemote.error.includes('DB_HOST'), dbHostRemote);

const urlRemote = guard({ DATABASE_URL: REMOTE_URL });
check('DATABASE_URL מרוחק — מסרב', urlRemote.error && urlRemote.error.includes('DATABASE_URL'), urlRemote);

const urlLocal = guard({ DATABASE_URL: LOCAL_URL });
check('DATABASE_URL מקומי — מתקבל, אך לא כמסד נפרד', urlLocal.result && urlLocal.result.separate === false, urlLocal);

const devDb = guard({ DB_HOST: 'localhost' });
check('DB_HOST מקומי — מתקבל, אך לא כמסד נפרד', devDb.result && devDb.result.separate === false, devDb);

const unset = guard({});
check('בלי שום הגדרה — מקומי כברירת מחדל', unset.result && unset.result.host === 'localhost', unset);

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

const remoteRun = runAll({ TEST_DATABASE_URL: REMOTE_URL });
check('TEST_DATABASE_URL מרוחק — run-all נכשל לפני כל חבילה', remoteRun.status !== 0 && !remoteRun.output.includes('═══'), remoteRun);
check('ואינו מדפיס את הסיסמה', !remoteRun.output.includes('pw-remote-123'));

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
