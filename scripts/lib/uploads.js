/**
 * מתרגם בין כתובת התמונה שמופיעה במסד (image_url) לקובץ על הדיסק.
 *
 * הכתובות במסד נראות כך: "/uploads/roller_pro.png". השרת מגיש את
 * התיקייה הזו ב-app.js דרך express.static, ו-multer כותב אליה. את
 * הנתיב עצמו לא כותבים כאן מחדש אלא לוקחים מ-middleware/upload.js,
 * כדי שאם התיקייה תזוז פעם אחת — היא תזוז בכל המקומות.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOADS_DIR } = require('../../server/middleware/upload');

const PREFIX = '/uploads/';

/**
 * מחזיר את הנתיב המלא של הקובץ שכתובת התמונה מצביעה עליו, או null
 * אם הכתובת ריקה, חיצונית, או מנסה לצאת מתיקיית ההעלאות.
 */
function urlToPath(imageUrl) {
  if (typeof imageUrl !== 'string') return null;

  const url = imageUrl.trim();
  if (!url.startsWith(PREFIX)) return null;

  const name = decodeURIComponent(url.slice(PREFIX.length).split('?')[0]);
  if (!name || name.includes('/') || name.includes('\\')) return null;

  const full = path.join(UPLOADS_DIR, name);
  // חגורה ושלייקס: גם אחרי הבדיקה למעלה, לוודא שלא יצאנו מהתיקייה.
  if (path.dirname(full) !== UPLOADS_DIR) return null;

  return full;
}

/** האם לכתובת הזו יש באמת קובץ על הדיסק. */
function fileExists(imageUrl) {
  const full = urlToPath(imageUrl);
  return full !== null && fs.existsSync(full);
}

/** הכתובת הציבורית של קובץ בתיקיית ההעלאות: "roller.webp" → "/uploads/roller.webp". */
function pathToUrl(fileName) {
  return PREFIX + path.basename(fileName);
}

/**
 * שם הקובץ שתמונת מוצר נכתבת בו: product-218-a3f9c1b2.webp.
 *
 * החתימה היא של תוכן הקובץ, וזו כל מטרתה: /uploads מוגש עם max-age
 * של שבוע (server/app.js), ולכן צילום מחדש של מוצר שנכתב לאותו שם
 * היה יושב במטמון של כל מי שכבר ראה את הקודם — עד שבוע. תוכן אחר הוא
 * שם אחר, וכתובת חדשה נטענת מיד.
 *
 * שמונה ספרות הקסדצימליות ולא יותר: החתימה צריכה להבדיל רק בין
 * גרסאות של אותו שיבוץ, והמזהה כבר בשם.
 *
 * כאן ולא בסקריפט אחד מהם, כי שני סקריפטים כותבים לתיקייה הזו —
 * images-products (צילום של מוצר קיים) ו-products-import-new (מוצר
 * שנוצר עכשיו) — ושם קובץ אחד הוא מה שמאפשר לדעת מי יתום.
 */
function uploadName(id, index, contents) {
  const hash = crypto.createHash('sha256').update(contents).digest('hex').slice(0, 8);
  const slot = index === 1 ? `${id}` : `${id}-${index}`;
  return `product-${slot}-${hash}.webp`;
}

module.exports = { UPLOADS_DIR, fileExists, pathToUrl, uploadName };
