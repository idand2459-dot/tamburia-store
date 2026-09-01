const config = require('./config/env');
const db = require('./config/db');
const { runMigrations } = require('./db/migrate');
const { createApp } = require('./app');

async function start() {
  // 1. מאמתים חיבור ל-DB לפני הכל — עדיף להיכשל כאן
  const info = await db.assertConnection();
  console.log(`מחובר ל-PostgreSQL: ${info.db}@${config.db.host}:${config.db.port} ✓`);

  // 2. מריצים מיגרציות ומחכים שיסתיימו — לפני שנפתח את הפורט,
  //    כדי שבקשה לא תגיע לטבלה שעוד לא קיימת
  await runMigrations();

  // 3. רק עכשיו מקבלים בקשות
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`השרת עובד על פורט ${config.port} (${config.nodeEnv}) ✓`);
  });

  // סגירה מסודרת — מפסיקים לקבל בקשות, ואז סוגרים את ה-pool
  const shutdown = (signal) => {
    console.log(`\n${signal} — נסגר...`);
    server.close(async () => {
      await db.close();
      console.log('נסגר בהצלחה ✓');
      process.exit(0);
    });
    // אם משהו נתקע, לא נשארים תלויים לנצח
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('✗ השרת לא הצליח לעלות:', err.message);
  process.exit(1);
});
