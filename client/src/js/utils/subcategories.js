/**
 * תתי-הקטגוריות של כל קטגוריה, לפי features/catalog/categories.js.
 *
 * כאן ולא בקובץ הקטגוריות עצמו: הוא חייב להישאר נתונים טהורים (מערך
 * ליטרלי בלבד), כי השרת קורא אותו כטקסט ומריץ אותו — ראו
 * server/utils/categories.js. אותו כלל שייכות נאכף שם, בשרת.
 */
import categories from '../features/catalog/categories';

/** תתי-הקטגוריות של קטגוריה, או מערך ריק. */
export function subcategoriesOf(categoryId) {
  return categories.find((c) => c.id === categoryId)?.subcategories || [];
}

/** האם תת-הקטגוריה שייכת לקטגוריה. */
export function isSubcategoryOf(categoryId, subcategoryId) {
  return Boolean(subcategoryId) && subcategoriesOf(categoryId).some((sub) => sub.id === subcategoryId);
}

/** שם תת-הקטגוריה בעברית, אם היא שייכת לקטגוריה. */
export function subcategoryName(categoryId, subcategoryId) {
  return subcategoriesOf(categoryId).find((sub) => sub.id === subcategoryId)?.name || null;
}

/**
 * האם למוצר אין תת-קטגוריה שעובדת בסינון: ריקה, או ערך שאינו שייך
 * לקטגוריה שלו (שם חופשי מייבוא ישן, מזהה של קטגוריה אחרת). מוצר כזה
 * מופיע בחנות רק תחת "הכל".
 */
export function lacksSubcategory(product) {
  return subcategoriesOf(product?.category).length > 0
    && !isSubcategoryOf(product.category, product.subcategory);
}
