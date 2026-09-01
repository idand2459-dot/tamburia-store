/**
 * מגדיר שגיאה נושאת קוד HTTP, כדי שקונטרולרים ומודלים יוכלו לזרוק
 * שגיאה מפורשת שמטפל השגיאות המרכזי יתרגם לתשובה נכונה.
 */

class AppError extends Error {
  /** בונה שגיאה עם קוד HTTP, הודעה ופרטים אופציונליים. */
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

/** שגיאת 400 — הבקשה אינה תקינה. */
const badRequest = (msg, details) => new AppError(400, msg, details);

/** שגיאת 404 — המשאב אינו קיים. */
const notFound = (msg = 'לא נמצא') => new AppError(404, msg);

/** שגיאת 409 — הפעולה מתנגשת עם המצב הקיים. */
const conflict = (msg) => new AppError(409, msg);

module.exports = { AppError, badRequest, notFound, conflict };
