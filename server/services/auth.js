/**
 * אחראי על אימות האדמין: יצירת אסימוני התחברות חתומים ואימותם,
 * השוואת סיסמאות בזמן קבוע, וקריאה וכתיבה של עוגיית ההתחברות.
 *
 * האסימון בנוי כ-base64url(payload).base64url(HMAC-SHA256) — חתום ולא
 * מוצפן, ובלי בחירת אלגוריתם מתוכו, כך שאין את חולשת "alg: none".
 */
const crypto = require('crypto');
const config = require('../config/env');

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

/** יוצר אסימון אדמין חדש עם תוקף לפי הקונפיגורציה. */
function createToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'admin',
    iat: now,
    exp: now + config.auth.ttlHours * 3600,
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

/** מחזיר את אפשרויות עוגיית ההתחברות, זהות בהתחברות ובניתוק. */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
    maxAge: config.auth.ttlHours * 3600 * 1000,
  };
}

/** קורא עוגייה בשם נתון מכותרת הבקשה. */
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = { createToken, verifyToken, passwordMatches, cookieOptions, readCookie };
