/**
 * מתרגם HTTP להגדרות מסך הניהול: קריאה וכתיבה של הגדרה בודדת.
 * המפתח והערך נבדקים בוולידטור; מה ש-null עושה מוכרע בשירות.
 */
const settingService = require('../services/setting.service');
const { resolveKey, parseValue } = require('../validators/setting.validator');

/** GET /api/settings/:key — מחזיר את ערך ההגדרה, או null כשלא נקבעה. */
async function getOne(req, res) {
  const key = resolveKey(req.params.key);
  res.json({ key, value: await settingService.getSetting(key) });
}

/** PUT /api/settings/:key — קובע את ערך ההגדרה; value: null מבטל אותה. */
async function update(req, res) {
  const key = resolveKey(req.params.key);
  const value = parseValue(key, req.body);
  res.json({ key, value: await settingService.saveSetting(key, value) });
}

module.exports = { getOne, update };
