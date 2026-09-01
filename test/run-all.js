/**
 * מריץ את כל חבילות הבדיקה מקצה לקצה.
 *
 *   npm test
 *
 * מרים את השרת בעצמו על פורט נפרד (3100 כברירת מחדל), כדי שאפשר
 * יהיה להריץ גם כשהשרת האמיתי עובד על 3000.
 *
 * שים לב: הבדיקות פונות למסד הנתונים האמיתי. הן יוצרות רשומות
 * זמניות ומוחקות אותן בסוף, ואינן נוגעות בנתונים קיימים —
 * חבילת הגוונים אף מאמתת במפורש ש-20 הגוונים לא זזו.
 */
process.env.MAIL_ENABLED = 'false';        // לא שולחים מיילים אמיתיים בבדיקות
process.env.DB_LOG_QUERIES = 'false';      // בלי רעש SQL בפלט
process.env.PORT = process.env.TEST_PORT || '3100';

const path = require('path');
const { spawn } = require('child_process');

const SUITES = ['smoke-static', 'smoke-orders', 'smoke-reviews', 'smoke-pigments'];

/** מריץ חבילה אחת כתהליך נפרד ומחזיר את קוד היציאה */
function runSuite(name, baseUrl) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, `${name}.js`)], {
      stdio: 'inherit',
      env: { ...process.env, NEW_URL: baseUrl },
    });
    child.on('close', resolve);
  });
}

async function main() {
  const db = require('../server/config/db');
  const { runMigrations } = require('../server/db/migrate');
  const { createApp } = require('../server/app');

  await db.assertConnection();
  await runMigrations();

  const port = Number(process.env.PORT);
  const server = createApp().listen(port);
  await new Promise((resolve) => server.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`שרת בדיקות על ${baseUrl}`);

  const results = [];
  for (const suite of SUITES) {
    console.log(`\n═══ ${suite} ═══`);
    results.push([suite, await runSuite(suite, baseUrl)]);
  }

  await new Promise((resolve) => server.close(resolve));
  await db.close();

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
