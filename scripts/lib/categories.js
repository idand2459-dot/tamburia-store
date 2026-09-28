/**
 * מספק לסקריפטים של Node את עץ הקטגוריות של החנות, מתוך אותו קובץ
 * שהקליינט קורא — client/src/js/features/catalog/categories.js.
 *
 * הקובץ ההוא הוא מודול ES שאי אפשר לעשות לו require מקוד CommonJS
 * (package.json מכריז "type": "commonjs", ולכן גם import() דינמי יקרא
 * אותו כ-CJS וייפול על export). הוא גם קובץ נתונים טהור: מערך ליטרלי
 * בלי import־ים ובלי לוגיקה. לכן כאן קוראים אותו כטקסט, מסירים את שתי
 * מילות ה-export, ומריצים את מה שנשאר.
 *
 * למה לא פשוט להעתיק את הרשימה לכאן: 12 קטגוריות ו-85 תתי-קטגוריות
 * ששמן מוצג ללקוח. עותק שני היה מתיישן בשקט, והרשימה המודפסת שהאבא
 * מחזיק ביד בחנות הייתה מראה שמות שכבר לא קיימים באתר.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname, '..', '..', 'client', 'src', 'js', 'features', 'catalog', 'categories.js'
);

let cached = null;

/** קורא ומריץ את קובץ הקטגוריות של הקליינט, פעם אחת לכל ריצה. */
function load() {
  if (cached) return cached;

  let source;
  try {
    source = fs.readFileSync(SOURCE, 'utf8');
  } catch (err) {
    throw new Error(`לא נמצא קובץ הקטגוריות של הקליינט (${SOURCE}): ${err.message}`);
  }

  // export const SUBCATEGORY_NAMES → const SUBCATEGORY_NAMES, ו-export
  // default נמחק. אלה שתי ההופעות היחידות של export בקובץ.
  const plain = source
    .replace(/^export\s+const\s/m, 'const ')
    .replace(/^export\s+default\s+categories;?\s*$/m, '');

  let categories;
  try {
    // eslint-disable-next-line no-new-func
    categories = new Function(`${plain}\nreturn categories;`)();
  } catch (err) {
    throw new Error(
      `לא הצלחתי לקרוא את ${path.basename(SOURCE)}: ${err.message}\n` +
      'הקובץ אמור להיות מערך ליטרלי בלבד. אם נוספה לו לוגיקה, צריך לעדכן את scripts/lib/categories.js.'
    );
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(`${path.basename(SOURCE)} לא החזיר מערך קטגוריות.`);
  }

  cached = {
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

  return cached;
}

module.exports = { load, SOURCE };
