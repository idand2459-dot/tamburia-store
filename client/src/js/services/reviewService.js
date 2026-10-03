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
import { ApiError, buildUrl, getJson, postJson } from './http';

/**
 * GET /api/reviews — חוות דעת, על החנות או על מוצר.
 *
 * תשובה שאינה מערך, או שגיאה מהשרת, מוחזרת כמערך ריק ולא מגיעה לרכיב:
 * שני הקוראים מריצים map על מה שחוזר, ואין להם מצב שגיאה משלהם. תקלת
 * רשת וביטול עדיין נזרקים, והקוראים מטפלים בהם ב-catch.
 */
export async function getReviews({ type, productId, signal } = {}) {
  try {
    const data = await getJson(buildUrl('/api/reviews', { type, product_id: productId }), { signal });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}

/**
 * GET /api/reviews/stats — ממוצע הדירוג ומספר חוות הדעת.
 *
 * שגיאה מהשרת מחזירה null: הכרזה מציגה דירוג רק כשיש total חיובי.
 */
export async function getReviewStats({ signal } = {}) {
  try {
    return await getJson('/api/reviews/stats', { signal });
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
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
