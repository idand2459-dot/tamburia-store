/**
 * גישה לטבלת settings: קריאת הגדרה, כתיבתה ומחיקתה.
 *
 * ההגדרות הן מפתח/ערך, והמפתחות המוכרים מוגדרים בוולידטור. כאן אין
 * ידיעה מה משמעות הערך — רק שהוא מחרוזת או null.
 */
const { query } = require('../config/db');

/** מחזיר את ערך ההגדרה, או null אם לא נשמרה מעולם. */
async function get(key) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * שומר את ההגדרה ומחזיר את ערכה.
 *
 * UPSERT ולא בדיקה-ואז-כתיבה: שני מסכי ניהול פתוחים יכולים לשמור
 * באותו רגע, ובלי זה אחד מהם היה נכשל על המפתח הראשי.
 */
async function set(key, value) {
  const { rows } = await query(
    `INSERT INTO settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
     RETURNING value`,
    [key, value]
  );
  return rows[0].value;
}

/** מוחק את ההגדרה, כדי שקריאה תחזיר שוב את ברירת המחדל. */
async function remove(key) {
  await query('DELETE FROM settings WHERE key = $1', [key]);
  return null;
}

module.exports = { get, set, remove };
