/**
 * ההתחברות של מסך הניהול: כניסה, בדיקת מצב ויציאה.
 *
 * הקריאות האלה אינן עוברות דרך api() של מסך הניהול, כי הן רצות לפניו
 * או סביבו: api() מגיב ל-401 בהחזרה למסך ההתחברות, וכאן 401 הוא
 * התשובה עצמה — "לא מחובר" או "סיסמה שגויה" — ולא תקלה.
 *
 * האסימון עצמו לעולם אינו עובר כאן: השרת מציב אותו בעוגיית httpOnly,
 * והדפדפן שולח אותה לבד.
 */
import { ApiError, postJson } from './http';

export { ApiError };

/** ההודעה כשהשרת דחה את הסיסמה בלי הסבר. */
const LOGIN_REJECTED_MESSAGE = 'סיסמה שגויה — נסה שוב';

/**
 * POST /api/auth/login — מתחבר.
 *
 * זורקת ApiError עם הודעת השרת ("סיסמה שגויה", "יותר מדי ניסיונות"),
 * ושגיאה רגילה כשלא הגענו לשרת.
 */
export async function login(password) {
  return postJson('/api/auth/login', { password }, { fallback: LOGIN_REJECTED_MESSAGE });
}

/** GET /api/auth/me — האם יש התחברות בתוקף. כישלון מכל סוג הוא "לא". */
export async function isLoggedIn() {
  try {
    const res = await fetch('/api/auth/me');
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /api/auth/logout — מתנתק. כישלון אינו משנה דבר: המסך יוצא בכל מקרה. */
export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // אין מה לעשות: גם בלי תשובה המסך חוזר לחנות
  }
}
