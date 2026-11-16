/**
 * מי מחובר כאדמין: החוסם לנתיבי הניהול, והזיהוי בלבד לנתיבים
 * הציבוריים שמראים לאדמין יותר ממה שהם מראים ללקוח.
 */
const config = require('../config/env');
const { verifyToken } = require('../api/auth/auth.service');
const { AppError } = require('../utils/AppError');

/** Methods that only read. A viewer is let through nowhere else, whatever the route. */
const READ_METHODS = ['GET', 'HEAD'];

/** The answer a viewer gets on a route that writes, or one that was never opened to a viewer. */
const readOnlyError = () => new AppError(
  403,
  'חשבון הצפייה בהדגמה הוא לקריאה בלבד',
  { reason: 'demo_read_only' }
);

/** Verifies the login cookie: the payload, or null (and nothing is attached to the request). */
function readAdmin(req) {
  // req.cookies is filled by cookie-parser (server/app.js)
  return verifyToken(req.cookies?.[config.auth.cookieName]);
}

/**
 * Owner only: 401 without a valid login, 403 for a viewer. Every route that writes uses this, and so
 * does every route nobody has deliberately opened to a viewer, so access is default-deny.
 */
function requireAdmin(req, res, next) {
  const payload = readAdmin(req);

  if (!payload) {
    return next(new AppError(401, 'נדרשת התחברות כמנהל'));
  }
  if (payload.role !== 'owner') {
    return next(readOnlyError());
  }

  req.admin = payload;
  next();
}

/**
 * Owner or viewer, and only for GET and HEAD (any other method is 403 whatever the role, a second
 * line of defence behind the route table). Used on an explicit list of read routes only
 * (test/unit-admin-routes-covered.js keeps the list honest).
 */
function requireAdminRead(req, res, next) {
  const payload = readAdmin(req);

  if (!payload) {
    return next(new AppError(401, 'נדרשת התחברות כמנהל'));
  }
  if (!READ_METHODS.includes(req.method)) {
    return next(readOnlyError());
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
  const payload = readAdmin(req);

  if (payload) req.admin = payload;
  req.isAdmin = Boolean(payload);
  next();
}

module.exports = { requireAdmin, requireAdminRead, markAdmin };
