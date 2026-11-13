/**
 * מריץ את כל חבילות הבדיקה עבור npm test, כתהליכים נפרדים, ברצף.
 * This file only orchestrates: it opens no database connection and starts no HTTP
 * server. Each HTTP suite starts its own server on a port the operating system picks,
 * on the separate test database (TEST_DATABASE_URL, see test/lib/testDatabase.js and
 * test/lib/testServer.js); the suites create temporary records and delete them at the end.
 *
 * חלון הגבלת ההתחברות מקוצר בכל שרת בדיקות, כי כל חבילה מתחברת פעם אחת
 * ואחרת המכסה הייתה נגמרת באמצע הריצה. smoke-auth רץ אחרון
 * מפני שהוא ממצה את המכסה בכוונה.
 */
process.env.MAIL_ENABLED = 'false';
process.env.DB_LOG_QUERIES = 'false';

const path = require('path');
const { spawn } = require('child_process');
const { resolveTestDatabase, publicTarget, describeTestDatabase } = require('./lib/testDatabase');

// בדיקות ה-unit רצות ראשונות: הן אינן נוגעות ברשת או במסד, ולכן נותנות
// את סימן הכישלון המהיר ביותר אם משהו בסיסי שבור — ובראשן השמירה
// שאף סוד לא נכנס לגיט.
const SUITES = ['unit-repo-hygiene', 'unit-config', 'unit-test-database-guard', 'unit-no-private-phone', 'unit-auth-cookie', 'unit-order-service', 'unit-email-delivery', 'unit-product-service', 'unit-review-service', 'unit-money', 'unit-originals', 'smoke-fresh-db', 'smoke-static', 'smoke-orders', 'smoke-products', 'smoke-settings', 'smoke-reviews', 'smoke-pigments', 'smoke-contract', 'smoke-auth'];

/** The environment a suite inherits: ours, without anything that could point it at a server. */
function suiteEnv() {
  const env = { ...process.env };
  delete env.NEW_URL;
  return env;
}

/** מריץ חבילה אחת כתהליך נפרד ומחזיר את קוד היציאה. */
function runSuite(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, `${name}.js`)], {
      stdio: 'inherit',
      env: suiteEnv(),
    });
    child.on('close', resolve);
  });
}

/** מריץ את כל החבילות ומסכם את התוצאות. */
async function main() {
  // Validates only, and changes nothing: each suite that needs the database runs the whole
  // guard again for itself. This stops the run before the first suite on a bad setup.
  console.log(describeTestDatabase(publicTarget(resolveTestDatabase())));

  const results = [];
  for (const suite of SUITES) {
    console.log(`\n═══ ${suite} ═══`);
    results.push([suite, await runSuite(suite)]);
  }

  console.log('\n═══ סיכום ═══');
  for (const [suite, code] of results) {
    console.log(`  ${code === 0 ? '✓' : '✗'} ${suite}`);
  }

  const failed = results.filter(([, code]) => code !== 0);
  console.log(failed.length === 0 ? '\n✓ הכל עבר' : `\n✗ ${failed.length} חבילות נכשלו`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('הרצת הבדיקות נכשלה:', err.message);
  process.exit(1);
});
