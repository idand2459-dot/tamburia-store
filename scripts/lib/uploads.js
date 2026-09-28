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

module.exports = { UPLOADS_DIR, urlToPath, fileExists, pathToUrl };
