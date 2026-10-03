/**
 * שכפול חדש של הפרויקט מגיע למסד עובד: יוצר מסד ריק וזמני, מריץ עליו
 * את כל המיגרציות, ומשווה את הסכמה שהתקבלה — עמודה אחר עמודה, בכל
 * הטבלאות — לסכמה של המסד האמיתי.
 *
 * הבדיקה הזו קיימת כי במשך חודשים 001 התחילה ב-ALTER TABLE products על
 * טבלה שנוצרה ביד, ושום בדיקה לא ראתה את זה: כולן רצו על מסד שכבר היה
 * בו הכל. ההשוואה מול המסד האמיתי היא גם מה שתופס מיגרציה עתידית
 * שהורצה ביד ולא נכנסה לתיקייה.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');
const config = require('../server/config/env');

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

const FRESH = `tamburia_fresh_${process.pid}`;
const TABLES = ['products', 'orders', 'reviews', 'pigment_formulas', 'settings', 'schema_migrations'];

const poolFor = (database) => new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database,
});

/** עמודות הטבלאות, כמחרוזת אחת לכל עמודה: שם, סוג, ברירת מחדל, NULL. */
async function schemaOf(pool) {
  const { rows } = await pool.query(
    `SELECT table_name, column_name, data_type, character_maximum_length,
            numeric_precision, numeric_scale, column_default, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name, column_name`,
    [TABLES],
  );
  return rows.map((r) => [
    r.table_name, r.column_name, r.data_type, r.character_maximum_length,
    r.numeric_precision, r.numeric_scale, r.column_default, r.is_nullable,
  ].join(' | '));
}

async function main() {
  const admin = poolFor(config.db.name);
  await admin.query(`CREATE DATABASE ${FRESH}`);

  try {
    console.log('\n── מיגרציות על מסד ריק');
    const run = spawnSync(process.execPath, [path.join(__dirname, '../server/db/migrate.js')], {
      env: { ...process.env, DB_NAME: FRESH, DB_LOG_QUERIES: 'false' },
      encoding: 'utf8',
    });
    check('כל המיגרציות עוברות על מסד ריק', run.status === 0, (run.stderr || run.stdout).trim().split('\n').pop());

    const fresh = poolFor(FRESH);
    try {
      const real = await schemaOf(admin);
      const got = await schemaOf(fresh);

      console.log('\n── הסכמה שהתקבלה מול המסד האמיתי');
      for (const table of TABLES) {
        const want = real.filter((c) => c.startsWith(`${table} |`));
        const have = got.filter((c) => c.startsWith(`${table} |`));
        const missing = want.filter((c) => !have.includes(c));
        const extra = have.filter((c) => !want.includes(c));
        check(`${table}: אותן עמודות, סוגים וברירות מחדל`, missing.length === 0 && extra.length === 0, { missing, extra });
      }

      const { rows } = await fresh.query('SELECT count(*)::int AS n FROM pigment_formulas');
      check('גווני הפיגמנט נזרעו (005)', rows[0].n === 20, rows[0].n);

      // הקטלוג: npm run products:import הוא מה ששכפול חדש מריץ אחרי
      // המיגרציות. הוא נכתב לפני 008 והמשיך לכתוב צבעים כ-TEXT[] לעמודת
      // JSONB — כל מוצר עם צבע נכשל, ובלי שום בדיקה שתראה.
      console.log('\n── ייבוא הקטלוג למסד הריק');
      const imported = spawnSync(process.execPath, [path.join(__dirname, '../scripts/import-products.js')], {
        env: { ...process.env, DB_NAME: FRESH, DB_LOG_QUERIES: 'false' },
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      });
      const log = `${imported.stdout}${imported.stderr}`;
      check('הייבוא מסתיים בהצלחה', imported.status === 0, log.trim().split('\n').pop());
      check('בלי שורות שנכשלו', !log.includes('❌'), log.split('\n').filter((l) => l.includes('❌')).slice(0, 3));

      const catalog = await fresh.query(`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE jsonb_typeof(colors) <> 'array')::int AS bad_colors,
               count(*) FILTER (WHERE jsonb_array_length(CASE WHEN jsonb_typeof(colors) = 'array' THEN colors ELSE '[]' END) > 0)::int AS with_colors
          FROM products`);
      const { n, bad_colors: badColors, with_colors: withColors } = catalog.rows[0];
      check('הקטלוג נטען (מאות מוצרים)', n >= 300, n);
      check('colors תמיד מערך JSON', badColors === 0, badColors);
      check('מוצרים עם צבעים נשמרו ({ name, hex })', withColors > 0, withColors);
    } finally {
      await fresh.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${FRESH}`);
    await admin.end();
  }
}

main()
  .catch((err) => {
    failed++;
    console.log(`  ✗ ${err.message}`);
  })
  .finally(() => {
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
