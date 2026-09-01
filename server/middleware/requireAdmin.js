/**
 * חוסם נתיבי ניהול בפני מי שאינו מחובר כאדמין.
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

module.exports = { requireAdmin };
