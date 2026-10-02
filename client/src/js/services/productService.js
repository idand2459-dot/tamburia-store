/**
 * כל קריאות ה-API של המוצרים בחזית החנות, במקום אחד.
 *
 * הקריאות האלה ישבו עד כה בתוך הרכיבים עצמם — עמוד הקטגוריה, עמוד
 * המוצר, המוצרים הקשורים, תיבת החיפוש בסרגל ושני המחשבונים — וכל
 * אחד מהם בנה כתובת משלו וזכר לבד פרט אחד של השרת: GET /api/products
 * מחזיר מערך שטוח, אבל ברגע ש-limit או offset נשלחים הוא מחזיר
 * { products, pagination }. הפרט הזה כבר הפיל את אותו באג פעמיים,
 * ולכן הנרמול נעשה כאן בדיוק פעם אחת: getProducts מחזירה תמיד
 * { products, pagination }, בלי קשר למה שחזר מהשרת.
 *
 * מסך הניהול אינו עובר דרך כאן — ראו את ההערה ב-services/http.js.
 */
import { buildUrl, getJson } from './http';

export { ApiError, isNotFound, isAbortError } from './http';

/**
 * מנרמל את שתי הצורות שהשרת מחזיר לצורה אחת.
 *
 * מערך שטוח מגיע כשלא התבקש דפדוף, ואז אין pagination ואין מה
 * להמציא — הוא null. זה המקום היחיד בלקוח שמכיר את ההבדל.
 */
function toProductList(data) {
  if (Array.isArray(data)) return { products: data, pagination: null };
  return { products: data?.products || [], pagination: data?.pagination || null };
}

/**
 * GET /api/products — רשימת מוצרים, תמיד כ-{ products, pagination }.
 *
 * זו הפונקציה שמשרתת את כל הרשימות בחנות: עמוד הקטגוריה (בלי limit,
 * כל המוצרים), המוצרים הקשורים (category + limit), תיבת החיפוש
 * (search + limit) ומחשבון הפרויקט (בלי פרמטרים כלל). אין כאן
 * עטיפות נפרדות לכל אחד מהם — ההבדל ביניהם הוא הפרמטרים בלבד.
 *
 * ids הוא רשימת מזהים מופרדת בפסיקים, ומשמש רק את useAvailability:
 * מה מתוך מה ששמור ב-localStorage של הלקוח עדיין בקטלוג. מזהה של
 * מוצר מוסתר פשוט לא יחזור, וזו התשובה.
 */
export async function getProducts({
  category, subcategory, search, inStock, ids, limit, offset, signal,
} = {}) {
  const url = buildUrl('/api/products', {
    category, subcategory, search, in_stock: inStock, ids, limit, offset,
  });

  return toProductList(await getJson(url, { signal }));
}

/**
 * GET /api/products/:id — מוצר בודד.
 *
 * מזהה שאינו קיים מחזיר 404 מהשרת, וכאן הוא הופך ל-ApiError שאפשר
 * לזהות עם isNotFound — כך שעמוד המוצר יכול להציג 404 אמיתי.
 */
export async function getProduct(id, { signal } = {}) {
  return getJson(`/api/products/${id}`, { signal });
}
