/**
 * בונה את אפליקציית Express: כותרות אבטחה, CORS, ה-API תחת /api,
 * תמונות המוצרים והגשת אפליקציית React מאותו מקור.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { securityHeaders } = require('./middleware/securityHeaders');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const ROOT = path.join(__dirname, '..');

/** מחזיר את מדיניות ה-CORS: פתוחה בפיתוח, מוגבלת בייצור. */
function corsOptions() {
  if (!config.isProduction) return { origin: true };
  return { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false };
}

/** מחזיר טיפול ששולח את index.html בלי לאפשר שמירה במטמון. */
function sendIndex(indexHtml) {
  return (req, res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(indexHtml);
  };
}

/** מחבר את הגשת ה-build של React, או מדלג אם אין build. */
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

  app.use('/static', express.static(path.join(buildDir, 'static'), {
    immutable: true,
    maxAge: '1y',
  }));

  app.use(express.static(buildDir, {
    index: false,
    maxAge: '1h',
    redirect: false,
  }));

  app.get(/.*/, sendIndex(indexHtml));
  return true;
}

/** מרכיב את האפליקציה ומחזיר אותה, בלי לפתוח פורט. */
function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '200kb' }));

  app.use('/uploads', express.static(path.join(ROOT, 'uploads'), {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  }));

  // עוצר כאן: תמונה חסרה היא 404, ולא נפילה ל-SPA fallback שהחזירה
  // את index.html עם 200 — תשובה שנראית תקינה ומסתירה קישור שבור.
  app.use('/uploads', notFoundHandler);

  app.use('/api', require('./routes'));
  app.use('/api', notFoundHandler);

  if (config.client.serve) mountClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, config };
