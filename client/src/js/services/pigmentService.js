/**
 * נוסחאות הפיגמנט של מחשבון הצבע.
 *
 * המחשבון מציג את הגוונים ובוחר את הראשון, ואין לו מצב שגיאה משלו:
 * בלי גוונים הוא פשוט מחשב ליטרים בלי סימולציית צבע. לכן כל כישלון —
 * שרת, רשת, תשובה שאינה מערך — חוזר כאן כמערך ריק.
 */
import { getJson, isAbortError } from './http';

/** GET /api/pigment-formulas — כל הגוונים, לפי sort_order. */
export async function getPigmentFormulas({ signal } = {}) {
  try {
    const data = await getJson('/api/pigment-formulas', { signal });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (isAbortError(error)) throw error;
    return [];
  }
}
