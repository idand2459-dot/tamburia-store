/**
 * מטפל בבקשות ההגדרות של מסך הניהול: קריאה וכתיבה של הגדרה בודדת.
 *
 * אין שכבת שירות, כמו בדומיין המוצרים וחוות הדעת: אין כאן לוגיקה
 * עסקית מלבד האימות, שיושב בוולידטור.
 */
const Setting = require('../models/setting.model');
const { resolveKey, parseValue } = require('../validators/setting.validator');

/** GET /api/settings/:key — מחזיר את ערך ההגדרה, או null כשלא נקבעה. */
async function getOne(req, res) {
  const key = resolveKey(req.params.key);
  res.json({ key, value: await Setting.get(key) });
}

/**
 * PUT /api/settings/:key — קובע את ערך ההגדרה.
 *
 * value: null מוחק את השורה ולא שומר את המחרוזת "null", כדי שקריאה
 * תחזיר שוב את ברירת המחדל. זה מה שמבטל את איפוס הסטטיסטיקות.
 */
async function update(req, res) {
  const key = resolveKey(req.params.key);
  const value = parseValue(key, req.body);

  const saved = value === null
    ? await Setting.remove(key)
    : await Setting.set(key, value);

  res.json({ key, value: saved });
}

module.exports = { getOne, update };
