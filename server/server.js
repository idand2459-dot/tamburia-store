/**
 * נקודת הכניסה של השרת: מאמת חיבור למסד, מריץ מיגרציות,
 * פותח את הפורט ודואג לסגירה מסודרת.
 */
const config = require('./config/env');
const db = require('./config/db');
const { runMigrations } = require('./db/migrate');
const { createApp } = require('./app');
const demoService = require('./api/demo/demo.service');

/** מעלה את השרת לפי הסדר: מסד, מיגרציות, ואז קבלת בקשות. */
async function start() {
  const info = await db.assertConnection();
  console.log(`מחובר ל-PostgreSQL: ${info.db}@${config.db.host}:${config.db.port} ✓`);

  // Verifies which database this is, before anything is written (a demo server on the real database,
  // or a normal server on the demo database, stops here). The server never creates the marker.
  await demoService.assertDatabaseIdentity();

  await runMigrations();

  // Visitor orders that expired while the instance slept (bounded; does nothing outside demo mode).
  const removed = await demoService.cleanupExpired({ force: true });
  if (removed > 0) console.log(`נמחקו ${removed} הזמנות הדגמה שפג תוקפן`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`השרת עובד על פורט ${config.port} (${config.nodeEnv}) ✓`);
  });

  /** מפסיק לקבל בקשות, סוגר את החיבורים ויוצא. */
  const shutdown = (signal) => {
    console.log(`\n${signal} — נסגר...`);
    server.close(async () => {
      await db.close();
      console.log('נסגר בהצלחה ✓');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('✗ השרת לא הצליח לעלות:', err.message);
  process.exit(1);
});
