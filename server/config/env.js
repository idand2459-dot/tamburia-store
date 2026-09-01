const path = require('path');

// טוענים את .env משורש הפרויקט במפורש, כדי שזה יעבוד
// גם אם מריצים את השרת מתוך תיקייה אחרת
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
  quiet: true,   // בלי באנר פרסומי בכל עלייה
});

const missing = [];

function required(key) {
  const value = process.env[key];
  if (!value) missing.push(key);
  return value;
}

/** משתנה דגל. ברירת המחדל נשמרת אלא אם הוגדר במפורש true/false. */
function flag(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`משתנה הסביבה ${key} חייב להיות true או false (התקבל: "${raw}")`);
  }
  return raw === 'true';
}

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
    // ברירת המחדל היא "שולח" — כיבוי דורש MAIL_ENABLED=false מפורש,
    // כדי שלא נגלה בייצור שמיילים לא נשלחו בגלל משתנה חסר
    enabled: process.env.MAIL_ENABLED !== 'false',
  },

  // הכתובת שאליה מפנה הכפתור במייל ההזמנה
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3001/admin',

  orders: {
    // דמי המשלוח נקבעים בשרת ולא נלקחים מגוף הבקשה,
    // אחרת אפשר לשלוח delivery_fee=0 ולקבל משלוח חינם
    deliveryFee: number('DELIVERY_FEE', 20, { allowZero: true }),
  },

  security: {
    // ראה את ההערה ב-middleware/securityHeaders.js
    cspEnabled: flag('CSP_ENABLED', false),
    hsts: flag('HSTS_ENABLED', true),
  },

  client: {
    // הגשת אפליקציית ה-React מאותו מקור. כיבוי הופך את השרת ל-API בלבד.
    serve: flag('SERVE_CLIENT', true),
    // תיקיית ה-build. יחסית לשורש הפרויקט.
    buildDir: process.env.CLIENT_BUILD_DIR || 'client/build',
  },

  /**
   * מקורות שמותר להם לפנות ל-API מדפדפן.
   * בפיתוח הכל פתוח, כי שרת הפיתוח של CRA יושב על פורט אחר.
   * בייצור הקליינט מוגש מאותו מקור, ולכן ברירת המחדל היא לא לאפשר כלום.
   */
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

// כל המשתנים החסרים בהודעה אחת — לא אחד בכל הרצה
if (missing.length > 0) {
  throw new Error(
    `חסרים משתני סביבה: ${missing.join(', ')}\n` +
    `העתק את .env.example ל-.env ומלא את הערכים.`
  );
}

module.exports = config;
