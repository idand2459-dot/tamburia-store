/**
 * קורא את משתני הסביבה מ-.env, מאמת אותם ומרכז אותם באובייקט קונפיגורציה
 * אחד שכל שאר השרת נשען עליו. נכשל בעלייה אם חסר משתנה חובה.
 */
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
  quiet: true,
});

const missing = [];

/** מחזיר משתנה חובה, ורושם אותו כחסר אם אינו מוגדר. */
function required(key) {
  const value = process.env[key];
  if (!value) missing.push(key);
  return value;
}

/** קורא משתנה בוליאני, ומחזיר את ברירת המחדל אם לא הוגדר. */
function flag(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`משתנה הסביבה ${key} חייב להיות true או false (התקבל: "${raw}")`);
  }
  return raw === 'true';
}

/** קורא משתנה מספרי שלם, ומחזיר את ברירת המחדל אם לא הוגדר. max אופציונלי: תקרה לערך. */
function number(key, fallback, { allowZero = false, max } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  const min = allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < min) {
    const expected = allowZero ? 'מספר שלם אי-שלילי' : 'מספר שלם חיובי';
    throw new Error(`משתנה הסביבה ${key} חייב להיות ${expected} (התקבל: "${raw}")`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`משתנה הסביבה ${key} חייב להיות לכל היותר ${max} (התקבל: "${raw}")`);
  }
  return parsed;
}

/**
 * The longest rate-limit window: a day. The limiter sweeps its counters with a timer of the
 * window's length, and Node runs a timer above about 24.8 days as if it were 1 ms.
 */
const MAX_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// בלי מייל פעיל אין צורך בחשבון Gmail: שכפול חדש עולה עם
// MAIL_ENABLED=false ובלי MAIL_USER / MAIL_PASS. כשהמייל פעיל הם חובה.
const mailEnabled = process.env.MAIL_ENABLED !== 'false';
const mailCredential = (key) => (mailEnabled ? required(key) : process.env[key] || '');

/** האורך המינימלי של סיסמת האדמין בייצור. */
const MIN_ADMIN_PASSWORD = 12;

const config = {
  nodeEnv,
  isProduction,
  port: number('PORT', 3000),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: number('DB_PORT', 5432),
    name: process.env.DB_NAME || 'tamburia',
    user: process.env.DB_USER || 'postgres',
    password: required('DB_PASSWORD'),
    logQueries: flag('DB_LOG_QUERIES', nodeEnv !== 'production'),
  },

  mail: {
    user: mailCredential('MAIL_USER'),
    pass: mailCredential('MAIL_PASS'),
    to: process.env.MAIL_TO || process.env.MAIL_USER,
    from: `"טכניק טמבור 🔧" <${process.env.MAIL_USER}>`,
    enabled: mailEnabled,
  },

  adminUrl: process.env.ADMIN_URL || 'http://localhost:3000/admin',

  orders: {
    deliveryFee: number('DELIVERY_FEE', 20, { allowZero: true }),
  },

  auth: {
    password: required('ADMIN_PASSWORD'),
    sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    ttlHours: number('SESSION_TTL_HOURS', 12),
    cookieName: 'tamburia_admin',
    loginMaxAttempts: number('LOGIN_MAX_ATTEMPTS', 10),
    loginWindowMs: number('LOGIN_WINDOW_MS', 15 * 60 * 1000),
  },

  // Public writes, counted per client address (middleware/rateLimit.js): every request counts,
  // a retry of the same order included. Defaults: 10 orders per 15 minutes, 5 reviews per hour.
  rateLimits: {
    orders: {
      max: number('ORDER_RATE_MAX', 10),
      windowMs: number('ORDER_RATE_WINDOW_MS', 15 * 60 * 1000, { max: MAX_RATE_WINDOW_MS }),
    },
    reviews: {
      max: number('REVIEW_RATE_MAX', 5),
      windowMs: number('REVIEW_RATE_WINDOW_MS', 60 * 60 * 1000, { max: MAX_RATE_WINDOW_MS }),
    },
  },

  // How many proxies stand between the internet and this process (0 = none). It decides which
  // address req.ip reports, and so which client a rate limit counts: the number must match the
  // real hosting, so check it on deployment. Default: 1 in production, 0 elsewhere.
  trustProxyHops: number('TRUST_PROXY_HOPS', isProduction ? 1 : 0, { allowZero: true, max: 5 }),

  security: {
    cspEnabled: flag('CSP_ENABLED', false),
    hsts: flag('HSTS_ENABLED', true),
  },

  client: {
    serve: flag('SERVE_CLIENT', true),
    buildDir: process.env.CLIENT_BUILD_DIR || 'client/build',
  },

  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

if (missing.length > 0) {
  throw new Error(
    `חסרים משתני סביבה: ${missing.join(', ')}\n` +
    `העתק את .env.example ל-.env ומלא את הערכים.`
  );
}

// בייצור השרת מסרב לעלות עם הגדרות אבטחה חלשות, במקום לעלות ולהיות פרוץ.
// ההודעות נוקבות בשם המשתנה בלבד: ערך של סוד לעולם אינו מודפס.
if (isProduction) {
  const problems = [];
  if (!process.env.SESSION_SECRET) {
    problems.push(
      'חסר SESSION_SECRET. צור אחד עם:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (config.auth.password.length < MIN_ADMIN_PASSWORD) {
    problems.push(`ADMIN_PASSWORD קצרה מדי: בייצור נדרשים לפחות ${MIN_ADMIN_PASSWORD} תווים.`);
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
}

if (!process.env.SESSION_SECRET) {
  console.warn('⚠ אין SESSION_SECRET — נוצר אחד זמני. התחברות לאדמין לא תשרוד הפעלה מחדש.');
}

module.exports = config;
