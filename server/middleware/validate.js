/**
 * מאמת פרמטרים בנתיב לפני שהם מגיעים למודל.
 */
const { badRequest } = require('../utils/AppError');

/** מוודא ש-:id הוא מספר שלם חיובי ושומר אותו ב-req.id. */
function idParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return next(badRequest(`מזהה לא תקין: "${raw}"`));
  }
  req.id = id;
  next();
}

module.exports = { idParam };
