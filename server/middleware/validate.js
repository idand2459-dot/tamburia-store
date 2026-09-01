const { badRequest } = require('../utils/AppError');

/**
 * מאמת ש-:id הוא מספר שלם חיובי, לפני שהוא מגיע ל-DB.
 * בלי זה, /api/products/abc היה מגיע לפוסטגרס וחוזר כשגיאת 500.
 */
function idParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return next(badRequest(`מזהה לא תקין: "${raw}"`));
  }
  req.id = id;   // הקונטרולר משתמש בזה, לא ב-req.params.id
  next();
}

module.exports = { idParam };
