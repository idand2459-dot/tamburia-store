/**
 * שגיאה עם קוד HTTP — מאפשרת לקונטרולרים ולמודלים
 * לזרוק שגיאה מפורשת שה-errorHandler יודע לתרגם לתשובה נכונה.
 *
 *   throw new AppError(404, 'המוצר לא נמצא');
 */
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const notFound   = (msg = 'לא נמצא')  => new AppError(404, msg);
const conflict   = (msg)              => new AppError(409, msg);

module.exports = { AppError, badRequest, notFound, conflict };
