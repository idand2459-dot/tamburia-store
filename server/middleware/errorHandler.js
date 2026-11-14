/**
 * מרכז את הטיפול בשגיאות ובנתיבים לא קיימים, וממפה שגיאות
 * PostgreSQL ו-multer לקודי HTTP והודעות שהלקוח יכול להבין.
 *
 * The text of an error is sent to the client only when this API wrote it: an AppError, or a
 * message defined in this file. What PostgreSQL, the body parser or any other library says is
 * never sent (it names tables, constraints and columns, or is in English), and no response carries
 * a stack trace in any environment. Failures of 500 and above are logged here with the full error.
 */
const { MAX_FILE_SIZE } = require('../services/image.service');
const { AppError } = require('../utils/AppError');

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
    // Safety net behind the validators: a number or text the column cannot hold, or a date outside
    // PostgreSQL's range, is a bad request and not a server failure.
    case '22003': return { status: 400, message: 'ערך מספרי חורג מהטווח המותר' };
    case '22001': return { status: 400, message: 'הערך ארוך מדי' };
    case '22007':
    case '22008': return { status: 400, message: 'תאריך לא תקין' };
    case 'ECONNREFUSED':
    case '57P01': return { status: 503, message: 'אין חיבור למסד הנתונים' };
    default: return null;
  }
}

/** ממפה שגיאת העלאת קובץ לסטטוס והודעה, או null אם אינה שגיאת multer. */
function mapMulterError(err) {
  if (err.name !== 'MulterError') return null;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':       return { status: 413, message: `הקובץ גדול מדי — עד ${MAX_FILE_SIZE / 1024 / 1024}MB לתמונה` };
    case 'LIMIT_FILE_COUNT':      return { status: 400, message: 'נשלחו יותר קבצים מהמותר' };
    case 'LIMIT_UNEXPECTED_FILE': return { status: 400, message: err.message };
    default:                      return { status: 400, message: `שגיאה בהעלאת הקובץ: ${err.message}` };
  }
}

/** The generic answer for a failure the API has nothing to explain. */
const INTERNAL_ERROR_MESSAGE = 'שגיאת שרת פנימית';

/** Errors the JSON body parser raises (keyed by err.type), with Hebrew text instead of its English one. */
const PARSER_ERRORS = {
  'entity.parse.failed': { status: 400, message: 'גוף הבקשה אינו JSON תקין' },
  'entity.too.large': { status: 413, message: 'גוף הבקשה גדול מדי' },
  'encoding.unsupported': { status: 415, message: 'קידוד הבקשה אינו נתמך' },
  'charset.unsupported': { status: 415, message: 'קידוד הבקשה אינו נתמך' },
  'request.aborted': { status: 400, message: 'הבקשה נקטעה לפני שהתקבלה במלואה' },
  'request.size.invalid': { status: 400, message: 'גודל הבקשה אינו תואם לתוכן שנשלח' },
};

/** What an unexpected error with a 4xx status says, by status; its own message is never used. */
const CLIENT_ERROR_MESSAGES = {
  400: 'הבקשה אינה תקינה',
  401: 'נדרשת התחברות',
  403: 'אין הרשאה לפעולה הזו',
  404: 'המשאב לא נמצא',
  405: 'השיטה אינה נתמכת בנתיב הזה',
  408: 'הבקשה לא התקבלה בזמן',
  409: 'הבקשה מתנגשת עם המצב הקיים',
  413: 'הבקשה גדולה מדי',
  415: 'סוג התוכן אינו נתמך',
  416: 'טווח הבקשה אינו תקין',
  422: 'לא ניתן לעבד את הבקשה',
  429: 'יותר מדי בקשות, נסה שוב מאוחר יותר',
};
const DEFAULT_CLIENT_ERROR_MESSAGE = 'הבקשה נדחתה';

/** ממפה שגיאה של מנתח גוף הבקשה לסטטוס והודעה, או null אם אינה כזו. */
function mapParserError(err) {
  return PARSER_ERRORS[err.type] || null;
}

/** The HTTP status an error carries (http-errors sets both names), or null when it has none. */
function statusOf(err) {
  const status = err.status ?? err.statusCode;
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : null;
}

/**
 * Decides what the client is told: { status, message, details }.
 * In order: the body parser, an AppError (its message and details as written), a known PostgreSQL
 * error (its translated message at any status), any other error with a 4xx status (a generic text
 * for that status), and everything else as a 500.
 */
function describeError(err) {
  const parser = mapParserError(err);
  if (parser) return parser;

  const pg = mapPgError(err);

  if (err instanceof AppError) {
    // An AppError of 500 or more keeps the old rule: the client gets the generic text, not the message.
    if (err.status >= 500) return { status: err.status, message: pg?.message || INTERNAL_ERROR_MESSAGE, details: err.details };
    return { status: err.status, message: err.message, details: err.details };
  }

  if (pg) return pg;

  const status = statusOf(err);
  if (status && status < 500) {
    return { status, message: CLIENT_ERROR_MESSAGES[status] || DEFAULT_CLIENT_ERROR_MESSAGE };
  }

  // A 5xx status from elsewhere (for example 503) is kept; the text is always the generic one.
  return { status: status || 500, message: INTERNAL_ERROR_MESSAGE };
}

/** מתרגם כל שגיאה שנזרקה בבקשה לתשובת JSON עם הסטטוס המתאים. */
function errorHandler(err, req, res, next) {
  const multerMapped = mapMulterError(err);
  if (multerMapped) {
    return res.status(multerMapped.status).json({ error: multerMapped.message });
  }

  const { status, message, details } = describeError(err);

  if (status >= 500) {
    // The full error, with its stack, stays in the server log only.
    console.error(`✗ ${req.method} ${req.originalUrl} →`, err);
  } else if (!(err instanceof AppError) && mapPgError(err)) {
    // A database error answered as a 4xx: one line with the method and the code only. Not the URL
    // (a path can carry a customer's phone number), the query, the body, or the error's detail.
    console.warn(`⚠ ${req.method} → PostgreSQL ${err.code}`);
  }

  const body = { error: message };
  if (details) body.details = details;

  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
