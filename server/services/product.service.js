/**
 * כללי המוצר שדורשים יותר מהבקשה עצמה: מחיקה (הזמנות, ביקורות,
 * תמונות) ותת-קטגוריה (מול הקטגוריה של המוצר הקיים).
 *
 * מחיקת מוצר: מה מותר למחוק, ומה נמחק איתו.
 *
 * מוצר שיש לו הזמנות אינו נמחק. ההזמנה מפנה אליו לפי id בתוך
 * orders.items, ומחיקתו הייתה מנתקת הזמנה ישנה מהפריט שנמכר בה. לזה
 * בדיוק יש הסתרה (active = false), וה-409 כאן נושא את מה שמסך הניהול
 * צריך כדי להציע אותה באותה הודעה.
 *
 * מוצר בלי הזמנות נמחק לצמיתות, עם הביקורות שלו, ואחרי שהמחיקה נשמרה
 * גם קבצי התמונות שלו שאף מוצר אחר אינו משתמש בהם. הקבצים נמחקים רק
 * אחרי ה-COMMIT: קובץ שנמחק לפני שהמוצר נמחק בפועל היה משאיר מוצר
 * עם תמונה שבורה אם הטרנזקציה נכשלה.
 */
const fs = require('fs/promises');
const path = require('path');
const Product = require('../models/product.model');
const { UPLOADS_DIR } = require('../middleware/upload');
const { removeOriginal } = require('../utils/originals');
const { notFound, conflict, badRequest } = require('../utils/AppError');
const { load: loadCategories, isSubcategoryOf } = require('../utils/categories');

const HAS_ORDERS_MESSAGE = 'למוצר יש הזמנות, ולכן אי אפשר למחוק אותו. אפשר להסתיר אותו מהחנות';

/** כתובות התמונה של המוצר שיושבות ב-/uploads, בלי כפילויות. */
function uploadedImagesOf(product) {
  const urls = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])];
  return [...new Set(urls.filter((url) => typeof url === 'string' && url.startsWith('/uploads/')))];
}

/**
 * מוחק מהדיסק את קבצי התמונה שאף מוצר כבר אינו מפנה אליהם.
 *
 * רק שם הקובץ נלקח מהכתובת (basename), כך שכתובת כמו
 * /uploads/../server.js אינה יכולה לצאת מהתיקייה. קובץ שכבר אינו קיים
 * אינו שגיאה, וכישלון במחיקת קובץ אינו מכשיל את הבקשה: המוצר כבר
 * נמחק, וקובץ יתום בדיסק אינו מזיק לאיש.
 */
async function removeOrphanImages(urls) {
  const orphans = await Product.findUnreferencedImages(urls);
  const removed = [];
  for (const url of orphans) {
    const file = path.join(UPLOADS_DIR, path.basename(url));
    try {
      await fs.rm(file, { force: true });
      // והצילום המקורי שלו, אם נשמר: בלי הקובץ המעובד אין לו לאן לחזור
      removeOriginal(path.basename(url));
      removed.push(url);
    } catch (err) {
      console.error(`לא הצלחנו למחוק את ${file}:`, err.message);
    }
  }
  return removed;
}

/** מוחק מוצר בלי הזמנות, או זורק 404 / 409. */
async function removeProduct(id) {
  const outcome = await Product.removeUnlessOrdered(id);
  if (!outcome.product) throw notFound(`מוצר ${id} לא נמצא`);

  if (outcome.orders > 0) {
    throw conflict(HAS_ORDERS_MESSAGE, {
      reason: 'has_orders',
      orders: outcome.orders,
      active: outcome.product.active !== false,
    });
  }

  const files = await removeOrphanImages(uploadedImagesOf(outcome.product));
  return { product: outcome.product, reviews: outcome.reviews, files };
}

// ───────────────────────────── תת-קטגוריה ─────────────────────────────
//
// תת-הקטגוריה היא מה שסרגל הסינון בעמוד הקטגוריה משווה אליו, לפי מזהה
// (?sub=rollers_pads). ערך שאינו מזהה של תת-קטגוריה בקטגוריה של המוצר —
// שם בעברית שהוקלד ביד, או מזהה מקטגוריה אחרת — הוא מוצר שלא יופיע
// באף סינון, בלי שום סימן לכך. לכן הוא נדחה כאן. ריק מותר: מוצר בלי
// תת-קטגוריה מופיע תחת "הכל", ומסך הניהול מסמן אותו לשיבוץ.

/** 400 על תת-קטגוריה שאינה שייכת לקטגוריה, עם השמות בעברית. */
function wrongSubcategory(categoryId, subcategoryId) {
  const { categoryNames, subcategoryNames } = loadCategories();
  const category = categoryNames[categoryId] || categoryId || 'ללא קטגוריה';
  const sub = subcategoryNames[subcategoryId] || subcategoryId;
  return badRequest(`תת-הקטגוריה "${sub}" אינה שייכת לקטגוריה "${category}"`);
}

/** בודק מוצר חדש: תת-קטגוריה, אם נשלחה, חייבת להיות של הקטגוריה שלו. */
function checkNewSubcategory(data) {
  if (data.subcategory && !isSubcategoryOf(data.category, data.subcategory)) {
    throw wrongSubcategory(data.category, data.subcategory);
  }
  return data;
}

/**
 * בודק עדכון חלקי מול המוצר הקיים, ומחזיר את השדות לעדכון.
 *
 * תת-קטגוריה שנשלחה נבדקת מול הקטגוריה שתהיה למוצר אחרי העדכון — זו
 * שנשלחה, או הקיימת. העריכה המהירה ברשימה שולחת רק subcategory, ולכן
 * בלי המוצר הקיים אי אפשר לבדוק אותה.
 *
 * קטגוריה שהשתנתה בלי תת-קטגוריה בבקשה מנקה תת-קטגוריה שכבר לא שייכת —
 * כמו שהטופס באדמין עושה. אחרת המוצר היה עובר קטגוריה ונשאר עם תת-
 * קטגוריה של הקודמת.
 */
function checkSubcategoryUpdate(data, existing) {
  const sentSub = Object.prototype.hasOwnProperty.call(data, 'subcategory');
  const category = Object.prototype.hasOwnProperty.call(data, 'category') ? data.category : existing.category;

  if (sentSub) {
    if (data.subcategory && !isSubcategoryOf(category, data.subcategory)) {
      throw wrongSubcategory(category, data.subcategory);
    }
    return data;
  }

  if (category !== existing.category && existing.subcategory
    && !isSubcategoryOf(category, existing.subcategory)) {
    return { ...data, subcategory: null };
  }
  return data;
}

/** יוצר מוצר אחרי בדיקת תת-הקטגוריה. */
async function createProduct(data) {
  return Product.create(checkNewSubcategory(data));
}

/** מעדכן מוצר אחרי בדיקת תת-הקטגוריה מול הקיים. */
async function updateProduct(id, data) {
  const touchesCategory = ['subcategory', 'category']
    .some((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (!touchesCategory) return Product.update(id, data);

  const existing = await Product.findById(id);
  if (!existing) return null;
  return Product.update(id, checkSubcategoryUpdate(data, existing));
}

module.exports = { removeProduct, createProduct, updateProduct };
