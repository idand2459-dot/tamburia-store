/**
 * מטפל בהתחברות, בניתוק ובבדיקת מצב ההתחברות של האדמין.
 * האסימון נשלח כעוגיית httpOnly ואינו מוחזר בגוף התשובה.
 */
const config = require('../config/env');
const { createToken, passwordMatches, cookieOptions } = require('../services/auth.service');
const { parseLogin } = require('../validators/auth.validator');
const { AppError } = require('../utils/AppError');

/** POST /api/auth/login — מאמת סיסמה ומנפיק עוגיית התחברות. */
async function login(req, res) {
  const password = parseLogin(req.body);

  if (!passwordMatches(password)) {
    throw new AppError(401, 'סיסמה שגויה');
  }

  req.resetRateLimit?.();

  res.cookie(config.auth.cookieName, createToken(), cookieOptions());
  res.json({ authenticated: true, expiresInHours: config.auth.ttlHours });
}

/** POST /api/auth/logout — מבטל את עוגיית ההתחברות. */
async function logout(req, res) {
  res.clearCookie(config.auth.cookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ authenticated: false });
}

/** GET /api/auth/me — מאשר שההתחברות עדיין בתוקף. */
async function me(req, res) {
  res.json({ authenticated: true, expiresAt: req.admin.exp });
}

module.exports = { login, logout, me };
