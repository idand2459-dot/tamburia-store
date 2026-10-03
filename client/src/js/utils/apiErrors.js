/**
 * קריאת הודעת השגיאה מתשובה שנכשלה.
 *
 * השרת מחזיר שגיאות בצורה אחידה — { error: "..." } — דרך
 * utils/AppError, ולכן אותה קריאה נדרשת בכל הוק שמבצע פעולת כתיבה.
 * שלושת הוקי הניהול היו מחזיקים כאן קוד זהה, ומכאן הקובץ המשותף.
 *
 * תשובה שאינה JSON (שגיאת פרוקסי, HTML של 502) לא מפילה כלום —
 * במקרה כזה מוחזרת הודעת ברירת המחדל של הקורא.
 */

const GENERIC = 'הפעולה נכשלה. אפשר לנסות שוב.';

/**
 * הודעה לכישלון ברמת הרשת — כשה-fetch עצמו זרק ולא החזיר תשובה
 * כלל (שרת שנפל, חיבור שנקטע). זה מסלול אחר מ-!res.ok, שבו יש
 * תשובה עם הסבר מהשרת, ולכן הוא צריך נוסח משלו.
 */
export const NETWORK_ERROR = 'לא הצלחנו להגיע לשרת. בדקו את החיבור ונסו שוב.';

/**
 * מחזיר { message, details } מגוף התשובה: הודעת השרת או הודעת הגיבוי,
 * ו-details כשהשרת צירף אותם (למשל המחירים העדכניים ב-409 של הזמנה).
 */
export async function errorFrom(res, fallback = GENERIC) {
  try {
    const body = await res.json();
    const message = body && typeof body.error === 'string' && body.error.trim()
      ? body.error
      : fallback;
    return { message, details: body?.details };
  } catch {
    // התשובה אינה JSON — אין מה לחלץ, נופלים להודעה הכללית.
    return { message: fallback, details: undefined };
  }
}

/** מחזיר את הודעת השגיאה מגוף התשובה, או הודעת גיבוי. */
export async function errorMessageFrom(res, fallback = GENERIC) {
  return (await errorFrom(res, fallback)).message;
}
