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

/** The message when the server refused the viewer entry (the demo is not on, or too many attempts). */
const DEMO_LOGIN_REJECTED = 'הכניסה כצופה אינה זמינה כרגע — נסו שוב מאוחר יותר';

/**
 * POST /api/auth/demo-login — enters the public read-only viewer session of the portfolio demo, with
 * no password. The server has no such route outside the demo, so a refusal is expected there.
 */
export async function demoLogin() {
  return postJson('/api/auth/demo-login', {}, { fallback: DEMO_LOGIN_REJECTED });
}

/**
 * GET /api/auth/me — the current session: { role: 'owner' | 'viewer' }, or null when not logged in
 * (also on any failure). The role only chooses what the admin shows; the server enforces it.
 */
export async function getSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return { role: body.role === 'viewer' ? 'viewer' : 'owner' };
  } catch {
    return null;
  }
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
