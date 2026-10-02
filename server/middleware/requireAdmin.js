/**
 * מי מחובר כאדמין: החוסם לנתיבי הניהול, והזיהוי בלבד לנתיבים
 * הציבוריים שמראים לאדמין יותר ממה שהם מראים ללקוח.
 */
const config = require('../config/env');
const { verifyToken, readCookie } = require('../services/auth');
const { AppError } = require('../utils/AppError');

/** מאמת את עוגיית ההתחברות, ומחזיר 401 אם אינה תקפה. */
function requireAdmin(req, res, next) {
  const token = readCookie(req, config.auth.cookieName);
  const payload = verifyToken(token);

  if (!payload) {
    return next(new AppError(401, 'נדרשת התחברות כמנהל'));
  }

  req.admin = payload;
  next();
}

/**
 * מסמן אם הפונה מחובר כאדמין, ותמיד ממשיך הלאה.
 *
 * זה לא שומר אלא זיהוי: נתיבי המוצרים פתוחים לכולם, אבל מוצר מוסתר
 * אינו קיים עבור הלקוח וכן קיים עבור האדמין. בלי זה, מסך הניהול היה
 * צריך נתיב שני משלו לאותם נתונים בדיוק.
 */
function markAdmin(req, res, next) {
  const token = readCookie(req, config.auth.cookieName);
  const payload = verifyToken(token);

  if (payload) req.admin = payload;
  req.isAdmin = Boolean(payload);
  next();
}

module.exports = { requireAdmin, markAdmin };
