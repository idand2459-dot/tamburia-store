/**
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
const { notFound, conflict } = require('../utils/AppError');

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

module.exports = { removeProduct, HAS_ORDERS_MESSAGE };
