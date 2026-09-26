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

/** מחזיר את הודעת השגיאה מגוף התשובה, או הודעת גיבוי. */
export async function errorMessageFrom(res, fallback = GENERIC) {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    // התשובה אינה JSON — אין מה לחלץ, נופלים להודעה הכללית.
  }
  return fallback;
}
