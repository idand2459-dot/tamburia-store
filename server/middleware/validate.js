/**
 * מאמת פרמטרים בנתיב לפני שהם מגיעים למודל.
 */
const { badRequest } = require('../utils/AppError');
const { isInt4Id } = require('../utils/ids');

/** מוודא ש-:id הוא מספר שלם חיובי שנכנס ל-INTEGER של המסד ושומר אותו ב-req.id. */
function idParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);
  // Above INT4 no row can match, and PostgreSQL would fail with 22003 (a 500): refuse it here.
  if (!isInt4Id(id)) {
    return next(badRequest(`מזהה לא תקין: "${raw}"`));
  }
  req.id = id;
  next();
}

module.exports = { idParam };
