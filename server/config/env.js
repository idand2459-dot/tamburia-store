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

/** Reads a value that must be one of a fixed list; the default applies when it is unset. */
function oneOf(key, allowed, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  if (!allowed.includes(raw)) {
    throw new Error(`משתנה הסביבה ${key} חייב להיות אחד מ: ${allowed.join(', ')} (התקבל: "${raw}")`);
  }
  return raw;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Splits DATABASE_URL into the fields the pool takes. The errors never print the
 * value: a connection string carries the password.
 */
function parseDatabaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('משתנה הסביבה DATABASE_URL אינו כתובת תקינה');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('משתנה הסביבה DATABASE_URL חייב להתחיל ב-postgres:// או ב-postgresql://');
  }
  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    name: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// בלי מייל פעיל אין צורך בחשבון Gmail: שכפול חדש עולה עם
// MAIL_ENABLED=false ובלי MAIL_USER / MAIL_PASS. כשהמייל פעיל הם חובה.
const mailEnabled = process.env.MAIL_ENABLED !== 'false';
const mailCredential = (key) => (mailEnabled ? required(key) : process.env[key] || '');

/** האורך המינימלי של סיסמת האדמין בייצור. */
const MIN_ADMIN_PASSWORD = 12;

// DATABASE_URL wins over DB_*. It is set only on the hosting service, so a local
// run never reaches a cloud database by accident.
const databaseUrl = process.env.DATABASE_URL ? parseDatabaseUrl(process.env.DATABASE_URL) : null;
const dbHost = databaseUrl ? databaseUrl.host : process.env.DB_HOST || 'localhost';

const config = {
  nodeEnv,
  isProduction,
  port: number('PORT', 3000),

  db: {
    host: dbHost,
    port: databaseUrl ? databaseUrl.port : number('DB_PORT', 5432),
    name: databaseUrl ? databaseUrl.name : process.env.DB_NAME || 'tamburia',
    user: databaseUrl ? databaseUrl.user : process.env.DB_USER || 'postgres',
    password: databaseUrl ? databaseUrl.password : required('DB_PASSWORD'),
    poolMax: number('DB_POOL_MAX', 10),
    // A remote host needs TLS; a local one does not offer it by default.
    ssl: !LOCAL_HOSTS.includes(dbHost),
    logQueries: flag('DB_LOG_QUERIES', nodeEnv !== 'production'),
  },

  // 'local' keeps images on disk (uploads/); 'cloudinary' sends them to Cloudinary.
  storage: {
    driver: oneOf('STORAGE_DRIVER', ['local', 'cloudinary'], 'local'),
    cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  },

  // open = the full store, catalog = browse only, closed = the under-construction page.
  siteMode: oneOf('SITE_MODE', ['open', 'catalog', 'closed'], 'open'),

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

if (config.storage.driver === 'cloudinary' && !config.storage.cloudinaryUrl) {
  missing.push('CLOUDINARY_URL');
}

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
