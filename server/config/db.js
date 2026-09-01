/**
 * מנהל את החיבור היחיד ל-PostgreSQL ומספק את הממשק שדרכו כל
 * המודלים ניגשים למסד: שאילתה, טרנזקציה, בדיקת חיבור וסגירה.
 */
const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('שגיאת Pool:', err.message));

/** מריץ שאילתה בודדת ומודד את זמנה. */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (config.db.logQueries) {
    const firstLine = text.trim().split('\n')[0].trim();
    console.log(`  SQL ${Date.now() - start}ms — ${firstLine}`);
  }
  return result;
}

/** מריץ סדרת פעולות בטרנזקציה אחת, עם ROLLBACK אוטומטי בכישלון. */
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
    client.release();
  }
}

/** מאמת שהחיבור למסד עובד ומחזיר את שם מסד הנתונים וגרסתו. */
async function assertConnection() {
  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  return rows[0];
}

/** סוגר את כל החיבורים. */
async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, assertConnection, close };
