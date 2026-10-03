/**
 * קריאות ההזמנות של חזית החנות: שליחת הזמנה, ו"ההזמנות שלי" לפי טלפון.
 *
 * הסכום שהלקוח רואה נשלח לשרת, אבל השרת אינו סומך עליו: הוא מתמחר
 * מחדש מתוך הפריטים ומחזיר 409 כשהמחירים השתנו, עם המחירים העדכניים
 * ב-details.prices. createOrder מעבירה את זה כמו שהוא ב-ApiError, כדי
 * שהעגלה תוכל להתיישר עם השרת לפני הניסיון הבא.
 *
 * הזמנות הניהול אינן כאן — הן עוברות דרך api() של מסך הניהול.
 */
import { ApiError, getJson, postJson } from './http';

export { ApiError };

/** ההודעה כשהשרת דחה את ההזמנה בלי להסביר למה. */
const REJECTED = 'שליחת ההזמנה נכשלה. אפשר לנסות שוב.';

/**
 * POST /api/orders — שולח הזמנה ומחזיר אותה כפי שנשמרה.
 *
 * זורקת ApiError כשהשרת דחה (status ו-details בתוכה), ושגיאה רגילה
 * כשלא הגענו לשרת בכלל.
 */
export async function createOrder(order, { signal } = {}) {
  return postJson('/api/orders', order, { signal, fallback: REJECTED });
}

/**
 * GET /api/orders/by-phone/:phone — ההזמנות של מספר טלפון.
 *
 * רק הספרות נשלחות: "050-123 4567" ו-"0501234567" הם אותו לקוח.
 */
export async function getOrdersByPhone(phone, { signal } = {}) {
  return getJson(`/api/orders/by-phone/${String(phone).replace(/\D/g, '')}`, { signal });
}
