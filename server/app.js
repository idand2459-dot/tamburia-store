const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { securityHeaders } = require('./middleware/securityHeaders');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const ROOT = path.join(__dirname, '..');

/**
 * בפיתוח שרת הפיתוח של CRA יושב על פורט אחר, ולכן הכל פתוח.
 * בייצור הקליינט מוגש מאותו מקור ואינו זקוק ל-CORS בכלל —
 * מקורות חיצוניים מותרים רק אם נקבעו במפורש ב-CORS_ORIGINS.
 */
function corsOptions() {
  if (!config.isProduction) return { origin: true };
  return { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false };
}

/** index.html לעולם לא נשמר במטמון — אחרת גרסה ישנה של האתר נתקעת אצל הגולש */
function sendIndex(indexHtml) {
  return (req, res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(indexHtml);
  };
}

/**
 * מגיש את ה-build של React מאותו מקור כמו ה-API.
 * מחזיר false אם אין build — אז השרת עולה כ-API בלבד במקום ליפול.
 */
function mountClient(app) {
  const buildDir = path.join(ROOT, config.client.buildDir);
  const indexHtml = path.join(buildDir, 'index.html');

  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `⚠ לא נמצא build של הקליינט ב-${config.client.buildDir} — השרת מגיש API בלבד.\n` +
      '  לבנייה:  npm run build:client'
    );
    return false;
  }

  // שמות הקבצים תחת /static מכילים hash של התוכן, ולכן שינוי
  // בקוד מייצר שם חדש — בטוח לתת לדפדפן לשמור אותם לשנה
  app.use('/static', express.static(path.join(buildDir, 'static'), {
    immutable: true,
    maxAge: '1y',
  }));

  // favicon, manifest, robots וכדומה
  app.use(express.static(buildDir, {
    index: false,          // index.html מוגש רק דרך ה-fallback, כדי שיקבל no-store
    maxAge: '1h',
    redirect: false,
  }));

  // ניתוב בצד הלקוח: /admin ושאר הנתיבים מקבלים את index.html.
  // רק GET/HEAD — POST לנתיב לא מוכר ימשיך ל-404 של ה-API.
  app.get(/.*/, sendIndex(indexHtml));
  return true;
}

/**
 * בונה את ה-Express app ומחזיר אותו — בלי listen.
 * ההפרדה מ-server.js מאפשרת להרים את האפליקציה בטסטים
 * בלי לתפוס פורט.
 */
function createApp() {
  const app = express();

  // לא מפרסמים שזה Express ואיזו גרסה
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '200kb' }));

  // תמונות מוצרים. dotfiles: 'deny' חוסם קבצים נסתרים אם הגיעו לשם איכשהו.
  app.use('/uploads', express.static(path.join(ROOT, 'uploads'), {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  }));

  // כל ה-API תחת /api
  app.use('/api', require('./routes'));

  // נתיב /api שלא נתפס — 404 בפורמט JSON, ולא דף HTML של הקליינט
  app.use('/api', notFoundHandler);

  // הקליינט אחרון: ה-fallback שלו תופס כל GET שנותר
  if (config.client.serve) mountClient(app);

  // מה שלא נתפס עד כאן, ומטפל השגיאות — חייבים להיות אחרונים, בסדר הזה
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, config };
