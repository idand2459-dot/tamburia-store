/**
 * עץ הקטגוריות של החנות לצד השרת, מאותו קובץ נתונים שהקליינט קורא —
 * client/src/js/features/catalog/categories.json.
 *
 * הקובץ הוא JSON טהור, ולכן ה-require הזה הוא כל מה שצריך: אין עותק שני
 * שיכול להתיישן בשקט, והוולידציה של תת-הקטגוריה בשרת מתאימה תמיד למה
 * שהחנות מציגה. (לפני כן הנתונים ישבו במודול ES של הקליינט והשרת הריץ את
 * הטקסט שלו; ראו את P7.3 ב-REFACTOR_PLAN.md.)
 *
 * נמצא ב-utils כי גם הסקריפטים קוראים אותו.
 */
const categories = require('../../client/src/js/features/catalog/categories.json');

if (!Array.isArray(categories) || categories.length === 0) {
  throw new Error('categories.json לא מכיל מערך קטגוריות.');
}

const cached = {
  categories,
  /** סדר הקטגוריות כפי שהחנות מציגה אותן: { painting: 0, kitchen: 1, … } */
  order: Object.fromEntries(categories.map((c, i) => [c.id, i])),
  /** שם הקטגוריה לפי מזהה. */
  categoryNames: Object.fromEntries(categories.map((c) => [c.id, c.name])),
  /** שם תת-הקטגוריה לפי מזהה, שטוח על פני כל הקטגוריות. */
  subcategoryNames: Object.fromEntries(
    categories.flatMap((c) => c.subcategories.map((sub) => [sub.id, sub.name]))
  ),
};

/** מחזיר את העץ והמפות הנגזרות ממנו. */
function load() {
  return cached;
}

/** האם תת-הקטגוריה שייכת לקטגוריה. */
function isSubcategoryOf(categoryId, subcategoryId) {
  const category = categories.find((c) => c.id === categoryId);
  return Boolean(category && category.subcategories.some((sub) => sub.id === subcategoryId));
}

module.exports = { load, isSubcategoryOf };
