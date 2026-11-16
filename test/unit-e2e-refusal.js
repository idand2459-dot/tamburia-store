/**
 * The browser suite (test/e2e/run.js) must refuse to start, with exit code 1 and before any
 * browser, server or fixture exists, whenever the database guard refuses. It runs the real
 * runner in a child process with an environment the guard rejects. Nothing here opens a database
 * connection: the guard throws before the first query, and no value of the real .env is printed.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const RUNNER = path.join(__dirname, 'e2e', 'run.js');
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

/** Runs the E2E runner with `overrides` on top of the current environment. */
function runRunner(overrides) {
  const result = spawnSync(process.execPath, [RUNNER], {
    env: { ...process.env, ...overrides },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const CASES = [
  ['TEST_DATABASE_URL ריק', { TEST_DATABASE_URL: '' }],
  ['NODE_ENV=production', { NODE_ENV: 'production' }],
  ['מארח שאינו מקומי', { TEST_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app_test' }],
  ['מסד שאינו מסד בדיקות (בלי test בשם)', { TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/appdata' }],
];

console.log('\n── הרצת ה-E2E נחסמת כשמסד הבדיקות אינו תקין');
for (const [name, overrides] of CASES) {
  const { code, out } = runRunner(overrides);
  check(`${name} → יציאה 1`, code === 1, code);
  check(`${name} → ההודעה אומרת שהבדיקה לא רצה`, out.includes('הבדיקה לא רצה'), out.slice(0, 80));
  check(`${name} → לא נוצר שרת, דפדפן או נתוני בדיקה`, !out.includes('מסד הנתונים מעודכן') && !out.includes('── '), out.slice(0, 80));
  check(`${name} → הסיסמה אינה מודפסת`, !out.includes(':p@'), null);
}

console.log(`\n✓ עברו ${passed}, נכשלו ${failed}`);
process.exit(failed === 0 ? 0 : 1);
