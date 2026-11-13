/**
 * עץ הקטגוריות ותתי-הקטגוריות של החנות. הנתונים עצמם ב-categories.json, כדי שהשרת
 * יקרא את אותו קובץ בדיוק (server/utils/categories.js) בלי להריץ קוד של הקליינט.
 */
import categories from './categories.json';

/**
 * שם תת-הקטגוריה לפי המזהה שלה: { rollers_pads: 'רולרים ורפידות', … }.
 *
 * המוצר נושא את מזהה תת-הקטגוריה בלבד, ומי שמציג אותו (ProductCard)
 * צריך את השם. נגזר מהעץ שלמעלה ולא נכתב פעם שנייה, כך ששינוי שם קורה
 * במקום אחד. 85 המזהים ייחודיים על פני כל הקטגוריות, ולכן מפה שטוחה
 * מספיקה ואין צורך לצרף אליה את מזהה הקטגוריה.
 */
export const SUBCATEGORY_NAMES = Object.fromEntries(
  categories.flatMap((c) => c.subcategories.map((sub) => [sub.id, sub.name]))
);

export default categories;
