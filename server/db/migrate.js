const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * מריץ את כל קבצי ה-.sql שטרם רצו, לפי סדר שם הקובץ.
 * כל מיגרציה רצה בטרנזקציה משלה ונרשמת בטבלת schema_migrations,
 * כך שהרצה שנייה לא עושה כלום.
 */
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log(`מסד הנתונים מעודכן ✓ (${files.length} מיגרציות)`);
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      // עוצרים כאן — לא מריצים מיגרציות שתלויות באחת שנכשלה
      throw new Error(`המיגרציה ${file} נכשלה: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(`מסד הנתונים מוכן ✓ (${pending.length} מיגרציות חדשות)`);
}

module.exports = { runMigrations };

// אפשר להריץ גם ישירות:  node server/db/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      pool.end().finally(() => process.exit(1));
    });
}
