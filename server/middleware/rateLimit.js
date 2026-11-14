/**
 * מגביל את מספר הבקשות שכתובת IP יכולה לשלוח בחלון זמן נתון.
 * המונים נשמרים בזיכרון התהליך, ולכן זה מתאים לשרת יחיד.
 */
const { AppError } = require('../utils/AppError');

/**
 * Expands an IPv6 address into its eight 4-digit hex groups, or returns null if it is not one.
 * Handles "::" and an IPv4 tail ("::ffff:1.2.3.4").
 */
function expandIPv6(address) {
  let text = address;

  const dotted = text.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const octets = dotted.slice(2).map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    text = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  let groups = left;
  if (halves.length === 2) {
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  }
  if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;

  return groups.map((group) => group.padStart(4, '0'));
}

/**
 * The key a client is counted under.
 *
 * An IPv4-mapped IPv6 address (::ffff:1.2.3.4, as a dual-stack socket reports an IPv4 client) is
 * counted as that IPv4 address. Any other IPv6 address is counted by its /64 prefix: a home or
 * mobile connection is given a whole /64, so keying on the full address would let one client
 * choose a fresh key for every request. A zone id (%eth0) is dropped. Anything that does not
 * parse is used as it is.
 */
function clientKey(ip) {
  if (!ip) return 'unknown';

  let address = String(ip).trim().toLowerCase();
  const zone = address.indexOf('%');
  if (zone !== -1) address = address.slice(0, zone);
  if (!address.includes(':')) return address;

  const groups = expandIPv6(address);
  if (!groups) return address;

  if (groups.slice(0, 5).every((group) => group === '0000') && groups[5] === 'ffff') {
    const high = parseInt(groups[6], 16);
    const low = parseInt(groups[7], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `${groups.slice(0, 4).join(':')}/64`;
}

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

  const keyOf = (req) => clientKey(req.ip || req.socket?.remoteAddress);

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

module.exports = { rateLimit, clientKey };
