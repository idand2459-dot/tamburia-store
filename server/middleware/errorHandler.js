/**
 * מרכז את הטיפול בשגיאות ובנתיבים לא קיימים, וממפה שגיאות
 * PostgreSQL ו-multer לקודי HTTP והודעות שהלקוח יכול להבין.
 */
const config = require('../config/env');

/** מחזיר 404 בפורמט JSON לנתיב API שאינו קיים. */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'הנתיב לא נמצא',
    path: `${req.method} ${req.originalUrl}`,
  });
}

/** ממפה קוד שגיאה של PostgreSQL לסטטוס והודעה, או null אם אינו מוכר. */
function mapPgError(err) {
  switch (err.code) {
    case '23505': return { status: 409, message: 'הערך כבר קיים במערכת' };
    case '23503': return { status: 409, message: 'הפעולה מפרה קישור לרשומה אחרת' };
    case '23514': return { status: 400, message: 'הערך לא עומד בכללי המערכת' };
    case '23502': return { status: 400, message: 'חסר שדה חובה' };
    case '22P02': return { status: 400, message: 'פורמט הערך שגוי' };
    case 'ECONNREFUSED':
    case '57P01': return { status: 503, message: 'אין חיבור למסד הנתונים' };
    default: return null;
  }
}

/** ממפה שגיאת העלאת קובץ לסטטוס והודעה, או null אם אינה שגיאת multer. */
function mapMulterError(err) {
  if (err.name !== 'MulterError') return null;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':       return { status: 413, message: 'הקובץ גדול מדי' };
    case 'LIMIT_FILE_COUNT':      return { status: 400, message: 'נשלחו יותר קבצים מהמותר' };
    case 'LIMIT_UNEXPECTED_FILE': return { status: 400, message: err.message };
    default:                      return { status: 400, message: `שגיאה בהעלאת הקובץ: ${err.message}` };
  }
}

/** מתרגם כל שגיאה שנזרקה בבקשה לתשובת JSON עם הסטטוס המתאים. */
function errorHandler(err, req, res, next) {
  const multerMapped = mapMulterError(err);
  if (multerMapped) {
    return res.status(multerMapped.status).json({ error: multerMapped.message });
  }

  const pgMapped = mapPgError(err);
  const status = err.status || pgMapped?.status || 500;

  if (status >= 500) {
    console.error(`✗ ${req.method} ${req.originalUrl} →`, err);
  }

  const body = {
    error: status >= 500
      ? (pgMapped?.message || 'שגיאת שרת פנימית')
      : err.message,
  };

  if (err.details) body.details = err.details;
  if (!config.isProduction && status >= 500) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
