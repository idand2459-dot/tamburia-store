/**
 * אחראי על אימות האדמין: יצירת אסימוני התחברות חתומים ואימותם,
 * השוואת סיסמאות בזמן קבוע, ואפשרויות עוגיית ההתחברות. את קריאת העוגייה
 * עושה cookie-parser (server/app.js), ואימות האסימון נשאר כאן.
 *
 * האסימון בנוי כ-base64url(payload).base64url(HMAC-SHA256) — חתום ולא
 * מוצפן, ובלי בחירת אלגוריתם מתוכו, כך שאין את חולשת "alg: none".
 */
const crypto = require('crypto');
const config = require('../../config/env');

const SEPARATOR = '.';

/** מקודד מחרוזת או buffer ל-base64url. */
function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

/** חותם מחרוזת בעזרת סוד השרת ומחזיר את החתימה כ-buffer. */
function sign(payloadPart) {
  return crypto
    .createHmac('sha256', config.auth.sessionSecret)
    .update(payloadPart)
    .digest();
}

/**
 * The two admin roles. `owner` edits everything; `viewer` is the public read-only demo admin and
 * exists only when DEMO_MODE is on (POST /api/auth/demo-login). The role is a signed claim: a client
 * cannot change it without SESSION_SECRET, because the signature covers the payload.
 */
const ROLES = ['owner', 'viewer'];

/** How long a viewer login lasts. A constant and not a setting: a stolen viewer token only reads demo data. */
const VIEWER_TTL_HOURS = 4;

/** The login lifetime of a role, in hours. */
function ttlHoursFor(role) {
  return role === 'viewer' ? VIEWER_TTL_HOURS : config.auth.ttlHours;
}

/** יוצר אסימון אדמין חדש עם תוקף לפי התפקיד: owner לפי הקונפיגורציה, viewer ארבע שעות. */
function createToken(role) {
  if (!ROLES.includes(role)) throw new Error('createToken דורש תפקיד: owner או viewer.');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'admin',
    role,
    iat: now,
    exp: now + ttlHoursFor(role) * 3600,
  };
  const payloadPart = base64url(JSON.stringify(payload));
  return `${payloadPart}${SEPARATOR}${base64url(sign(payloadPart))}`;
}

/** מאמת אסימון ומחזיר את תוכנו, או null אם הוא פסול או פג. */
function verifyToken(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return null;

  const [payloadPart, signaturePart] = parts;

  let provided;
  let expected;
  try {
    provided = Buffer.from(signaturePart, 'base64url');
    expected = sign(payloadPart);
  } catch {
    return null;
  }

  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (payload.sub !== 'admin') return null;
  // A token without a role (issued before roles existed) is invalid: the owner logs in again once.
  if (!ROLES.includes(payload.role)) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/** משווה סיסמה לזו שבקונפיגורציה בזמן קבוע, כדי לא להדליף אותה. */
function passwordMatches(attempt) {
  if (typeof attempt !== 'string') return false;

  const digestA = crypto.createHash('sha256').update(attempt, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(config.auth.password, 'utf8').digest();

  return crypto.timingSafeEqual(digestA, digestB);
}

/** מחזיר את אפשרויות עוגיית ההתחברות; ה-maxAge לפי התפקיד (owner כברירת מחדל), ושאר הערכים זהים בהתחברות ובניתוק. */
function cookieOptions(role = 'owner') {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
    maxAge: ttlHoursFor(role) * 3600 * 1000,
  };
}

module.exports = { ROLES, VIEWER_TTL_HOURS, createToken, verifyToken, passwordMatches, cookieOptions, ttlHoursFor };
