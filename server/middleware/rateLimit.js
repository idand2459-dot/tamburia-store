/**
 * מגביל את מספר הבקשות שכתובת IP יכולה לשלוח בחלון זמן נתון.
 * המונים נשמרים בזיכרון התהליך, ולכן זה מתאים לשרת יחיד.
 */
const { AppError } = require('../utils/AppError');

/** יוצר מידלוור הגבלת קצב, עם פונקציית reset לאיפוס ידני של כתובת. */
function rateLimit({ windowMs, max, message = 'יותר מדי בקשות, נסה שוב מאוחר יותר' }) {
  const hits = new Map();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweeper.unref();

  const keyOf = (req) => req.ip || req.socket.remoteAddress || 'unknown';

  /** סופר את הבקשה ומחזיר 429 אם המכסה נגמרה. */
  function rateLimiter(req, res, next) {
    const key = keyOf(req);
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', seconds);
      return next(new AppError(429, `${message} (עוד ${seconds} שניות)`));
    }

    next();
  }

  /** מאפס את המונה של הכתובת שממנה הגיעה הבקשה. */
  rateLimiter.reset = (req) => hits.delete(keyOf(req));

  return rateLimiter;
}

module.exports = { rateLimit };
