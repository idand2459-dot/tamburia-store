/**
 * קריאות הקריאה של חוות הדעת בחזית החנות.
 *
 * שלוש קריאות בשלושה רכיבים — קרוסלת חוות הדעת בעמוד הבית, חוות
 * הדעת על המוצר בעמוד המוצר, ונתוני הדירוג בכרזה — וכולן בדיוק אותו
 * דפוס קטן של productService: בניית query, JSON, ברירת מחדל שפויה
 * כשאין מה להציג. לכן הן כאן.
 *
 * שליחת חוות דעת (POST /api/reviews) נשארה בכוונה ברכיבים. שני
 * הקוראים שלה מתעלמים היום מהתשובה לחלוטין — גם 400 מהשרת מציג
 * "תודה" — וכל פונקציה שתכבד כאן שגיאות תשנה את מה שהמשתמש רואה.
 * זה מסלול הכתיבה, והוא אינו חלק מהאיחוד הזה.
 */
import { buildUrl } from './http';

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
