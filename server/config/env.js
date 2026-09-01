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

/** קורא משתנה מספרי שלם, ומחזיר את ברירת המחדל אם לא הוגדר. */
function number(key, fallback, { allowZero = false } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  const min = allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < min) {
    const expected = allowZero ? 'מספר שלם אי-שלילי' : 'מספר שלם חיובי';
    throw new Error(`משתנה הסביבה ${key} חייב להיות ${expected} (התקבל: "${raw}")`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
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
    user: required('MAIL_USER'),
    pass: required('MAIL_PASS'),
    to: process.env.MAIL_TO || process.env.MAIL_USER,
    from: `"טכניק טמבור 🔧" <${process.env.MAIL_USER}>`,
    enabled: process.env.MAIL_ENABLED !== 'false',
  },

  adminUrl: process.env.ADMIN_URL || 'http://localhost:3001/admin',

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

if (!process.env.SESSION_SECRET) {
  if (config.isProduction) {
    throw new Error(
      'חסר SESSION_SECRET. צור אחד עם:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  console.warn('⚠ אין SESSION_SECRET — נוצר אחד זמני. התחברות לאדמין לא תשרוד הפעלה מחדש.');
}

module.exports = config;
