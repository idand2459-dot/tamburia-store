const config = require('../config/env');

/** נתיב API שלא קיים — JSON, לא דף HTML של Express */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'הנתיב לא נמצא',
    path: `${req.method} ${req.originalUrl}`,
  });
}

/** מיפוי שגיאות PostgreSQL לקודי HTTP שהלקוח יכול להבין */
function mapPgError(err) {
  switch (err.code) {
    case '23505': return { status: 409, message: 'הערך כבר קיים במערכת' };          // unique_violation
    case '23503': return { status: 409, message: 'הפעולה מפרה קישור לרשומה אחרת' };  // foreign_key_violation
    case '23514': return { status: 400, message: 'הערך לא עומד בכללי המערכת' };      // check_violation
    case '23502': return { status: 400, message: 'חסר שדה חובה' };                    // not_null_violation
    case '22P02': return { status: 400, message: 'פורמט הערך שגוי' };                 // invalid_text_representation
    case 'ECONNREFUSED':
    case '57P01': return { status: 503, message: 'אין חיבור למסד הנתונים' };
    default: return null;
  }
}

/** שגיאות העלאת קבצים — כולן תקלות של הלקוח, לא של השרת */
function mapMulterError(err) {
  if (err.name !== 'MulterError') return null;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':       return { status: 413, message: 'הקובץ גדול מדי' };
    case 'LIMIT_FILE_COUNT':      return { status: 400, message: 'נשלחו יותר קבצים מהמותר' };
    case 'LIMIT_UNEXPECTED_FILE': return { status: 400, message: err.message };
    default:                      return { status: 400, message: `שגיאה בהעלאת הקובץ: ${err.message}` };
  }
}

/**
 * מטפל השגיאות המרכזי — חייב להיות ה-middleware האחרון.
 * ב-Express 5 שגיאות מ-handlers אסינכרוניים מגיעות לכאן אוטומטית,
 * כך שאין צורך ב-try/catch בכל קונטרולר.
 */
function errorHandler(err, req, res, next) {
  const multerMapped = mapMulterError(err);
  if (multerMapped) {
    return res.status(multerMapped.status).json({ error: multerMapped.message });
  }

  const pgMapped = mapPgError(err);
  const status = err.status || pgMapped?.status || 500;

  // שגיאת שרת אמיתית — רושמים ביומן. שגיאת לקוח (4xx) לא מזהמת את הלוג.
  if (status >= 500) {
    console.error(`✗ ${req.method} ${req.originalUrl} →`, err);
  }

  const body = {
    error: status >= 500
      ? (pgMapped?.message || 'שגיאת שרת פנימית')   // לא חושפים פרטים פנימיים ללקוח
      : err.message,
  };

  if (err.details) body.details = err.details;
  if (!config.isProduction && status >= 500) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
