/**
 * נקודת הכניסה של השרת: מאמת חיבור למסד, מריץ מיגרציות,
 * פותח את הפורט ודואג לסגירה מסודרת.
 */
const config = require('./config/env');
const db = require('./config/db');
const { runMigrations } = require('./db/migrate');
const { createApp } = require('./app');

/** מעלה את השרת לפי הסדר: מסד, מיגרציות, ואז קבלת בקשות. */
async function start() {
  const info = await db.assertConnection();
  console.log(`מחובר ל-PostgreSQL: ${info.db}@${config.db.host}:${config.db.port} ✓`);

  await runMigrations();

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
