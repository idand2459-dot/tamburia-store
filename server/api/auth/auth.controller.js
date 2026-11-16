/**
 * מטפל בהתחברות, בניתוק ובבדיקת מצב ההתחברות של האדמין.
 * האסימון נשלח כעוגיית httpOnly ואינו מוחזר בגוף התשובה.
 */
const config = require('../../config/env');
const { createToken, passwordMatches, cookieOptions, ttlHoursFor } = require('./auth.service');
const { parseLogin } = require('./auth.validator');
const { AppError } = require('../../utils/AppError');

/** POST /api/auth/login — מאמת סיסמה ומנפיק עוגיית התחברות. */
async function login(req, res) {
  const password = parseLogin(req.body);

  if (!passwordMatches(password)) {
    throw new AppError(401, 'סיסמה שגויה');
  }

  req.resetRateLimit?.();

  res.cookie(config.auth.cookieName, createToken('owner'), cookieOptions('owner'));
  res.json({ authenticated: true, expiresInHours: config.auth.ttlHours });
}

/**
 * POST /api/auth/demo-login — issues the read-only viewer session with no password. Mounted only
 * when DEMO_MODE is on (auth.routes.js), so a normal server has no such route. It does not reset the
 * login limiter: that would let someone clear the owner-password guess counter by calling it.
 */
async function demoLogin(req, res) {
  res.cookie(config.auth.cookieName, createToken('viewer'), cookieOptions('viewer'));
  res.json({ authenticated: true, role: 'viewer', expiresInHours: ttlHoursFor('viewer') });
}

/** POST /api/auth/logout — מבטל את עוגיית ההתחברות. */
async function logout(req, res) {
  res.clearCookie(config.auth.cookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ authenticated: false });
}

/** GET /api/auth/me — מאשר שההתחברות עדיין בתוקף, ומחזיר את התפקיד. הקליינט משתמש בו רק לבחירת מה להציג. */
async function me(req, res) {
  res.json({ authenticated: true, role: req.admin.role, expiresAt: req.admin.exp });
}

module.exports = { login, demoLogin, logout, me };
