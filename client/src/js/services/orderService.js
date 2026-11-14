/**
 * קריאת ההזמנות של חזית החנות: שליחת הזמנה. אין חיפוש הזמנות ציבורי.
 *
 * הסכום שהלקוח רואה נשלח לשרת, אבל השרת אינו סומך עליו: הוא מתמחר
 * מחדש מתוך הפריטים ומחזיר 409 כשהמחירים השתנו, עם המחירים העדכניים
 * ב-details.prices. createOrder מעבירה את זה כמו שהוא ב-ApiError, כדי
 * שהעגלה תוכל להתיישר עם השרת לפני הניסיון הבא.
 *
 * הזמנות הניהול אינן כאן — הן עוברות דרך api() של מסך הניהול.
 */
import { ApiError, TimeoutError, postJson } from './http';

export { ApiError, TimeoutError };

/** ההודעה כשהשרת דחה את ההזמנה בלי להסביר למה. */
const REJECTED = 'שליחת ההזמנה נכשלה. אפשר לנסות שוב.';

/** כמה זמן מחכים לתשובה על הזמנה. השרת עצמו מוגבל ל-10 שניות בשליחת מיילים. */
export const ORDER_TIMEOUT_MS = 20_000;

/**
 * POST /api/orders — שולח הזמנה ומחזיר אותה כפי שנשמרה.
 *
 * זורקת ApiError כשהשרת ענה בדחייה (status ו-details בתוכה), TimeoutError כשלא נענתה בזמן,
 * ושגיאה רגילה כשלא הגענו לשרת בכלל. רק הראשונה (4xx) מוכיחה שההזמנה לא נוצרה: את שתי
 * האחרות, כמו 5xx, אי אפשר לדעת. לכן ההזמנה נושאת request_id: שליחה חוזרת של אותו גוף
 * מחזירה את ההזמנה המקורית ולא יוצרת עוד אחת.
 */
export async function createOrder(order, { signal } = {}) {
  return postJson('/api/orders', order, { signal, fallback: REJECTED, timeoutMs: ORDER_TIMEOUT_MS });
}
