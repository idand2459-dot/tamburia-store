const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 10,                          // מקסימום חיבורים במקביל
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,   // לא תולה בקשה לנצח אם ה-DB למטה
});

// חיבור שנפל ברקע לא מפיל את התהליך
pool.on('error', (err) => console.error('שגיאת Pool:', err.message));

/**
 * כל שאילתה בפרויקט עוברת דרך כאן — נקודה אחת ללוגים ולמדידת זמנים.
 * מודלים קוראים ל-query, לא ל-pool.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (config.db.logQueries) {
    const firstLine = text.trim().split('\n')[0].trim();
    console.log(`  SQL ${Date.now() - start}ms — ${firstLine}`);
  }
  return result;
}

/**
 * לפעולות שחייבות להצליח או להיכשל ביחד.
 * הפונקציה מקבלת client ומחויבת להשתמש בו — לא ב-query הגלובלי,
 * אחרת הפעולה תרוץ מחוץ לטרנזקציה.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();   // חובה — אחרת ה-pool נגמר
  }
}

/** בדיקת חיבור בעלייה — עדיף להיכשל מיד מאשר על הבקשה הראשונה */
async function assertConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  return rows[0];
}

/** סגירה מסודרת ב-shutdown */
async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, assertConnection, close };
