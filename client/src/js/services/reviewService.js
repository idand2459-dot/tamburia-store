/**
 * קריאות הקריאה של חוות הדעת בחזית החנות.
 *
 * שלוש קריאות בשלושה רכיבים — קרוסלת חוות הדעת בעמוד הבית, חוות
 * הדעת על המוצר בעמוד המוצר, ונתוני הדירוג בכרזה — וכולן בדיוק אותו
 * דפוס קטן של productService: בניית query, JSON, ברירת מחדל שפויה
 * כשאין מה להציג. לכן הן כאן.
 *
 * גם השליחה כאן, ועכשיו היא מכבדת שגיאות: קודם שני הקוראים התעלמו
 * מהתשובה לחלוטין, ולכן 400 מהשרת ("חסר שם הכותב") הציג "תודה"
 * והביקורת נעלמה בלי שאיש ידע. createReview זורקת, ושני הטפסים
 * מציגים את ההודעה ונשארים פתוחים עם מה שהלקוח כתב.
 */
import { buildUrl, postJson } from './http';

/**
 * GET /api/reviews — חוות דעת, על החנות או על מוצר.
 *
 * תשובה שאינה מערך מוחזרת כמערך ריק ולא מגיעה לרכיב: שני הקוראים
 * מריצים map על מה שחוזר, ואין להם מצב שגיאה משלהם.
 */
export async function getReviews({ type, productId, signal } = {}) {
  const res = await fetch(buildUrl('/api/reviews', { type, product_id: productId }), { signal });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** GET /api/reviews/stats — ממוצע הדירוג ומספר חוות הדעת. */
export async function getReviewStats({ signal } = {}) {
  const res = await fetch('/api/reviews/stats', { signal });
  return res.json();
}

/**
 * POST /api/reviews — שולח חוות דעת חדשה.
 *
 * השרת מחזיר 201 והביקורת ממתינה לאישור מנהל. 400 מגיע עם ההסבר
 * שלו — שם ריק, דירוג מחוץ לטווח, מוצר חסר — וההסבר הזה הוא בדיוק
 * מה שהטופס צריך להציג.
 */
export async function createReview(review, { signal } = {}) {
  return postJson('/api/reviews', review, { signal });
}
