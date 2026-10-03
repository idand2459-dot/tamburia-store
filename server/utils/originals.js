/**
 * הצילום המקורי של כל תמונה שהועלתה מהאדמין, ברזולוציה מלאה.
 *
 * ההעלאה מקטינה כל תמונה לצלע של 1200px ומשלימה לריבוע (image.service),
 * וזה מה שהאתר מגיש. אבל מוצר שתופס רבע מהצילום נשאר אחרי זה עם כ-450px,
 * והסרת הרקע (images:products --from-uploads) לא יכולה להגדיל אותו
 * בחזרה ל-80% מהריבוע בלי להמציא פיקסלים. לכן המקור נשמר כאן, כמו שהוא
 * הגיע מהטלפון, והעיבוד מחדש מתחיל ממנו כשהוא קיים.
 *
 * התיקייה אינה מוגשת: השרת מגיש רק את /uploads ואת ה-build של React
 * (server/app.js), והיא מחוץ לשניהם. היא גם ב-.gitignore.
 *
 * השם מקושר לקובץ המעובד: 0b99d097208f5e91.webp ב-uploads ←→
 * 0b99d097208f5e91.jpg כאן — אותו בסיס, הסיומת של הקובץ שהועלה. השם
 * המעובד נגזר מהתוכן, ולכן גם הקישור יציב.
 */
const fs = require('fs');
const path = require('path');

const ORIGINALS_DIR = path.join(__dirname, '..', '..', 'uploads-originals');

const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/avif': '.avif',
};

/** בסיס השם של קובץ מעובד: "0b99d097208f5e91.webp" → "0b99d097208f5e91". */
function baseOf(processedName) {
  return path.basename(processedName, path.extname(processedName));
}

/** הסיומת לשמירת המקור: של שם הקובץ שהועלה, או לפי סוג התוכן. */
function originalExt(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  return MIME_EXT[mimetype] || '.bin';
}

/**
 * שומר את המקור לצד קובץ מעובד. קיים כבר (אותה תמונה שהועלתה שוב) —
 * לא נכתב מחדש. מחזיר את הנתיב.
 */
function saveOriginal(buffer, processedName, ext, dir = ORIGINALS_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, baseOf(processedName) + ext);
  try {
    fs.writeFileSync(target, buffer, { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return target;
}

/** המקור של קובץ מעובד, או null כשאין (תמונה שהועלתה לפני שהמקורות נשמרו). */
function findOriginal(processedName, dir = ORIGINALS_DIR) {
  const base = baseOf(processedName);
  if (!base || !fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((name) => baseOf(name) === base);
  return match ? path.join(dir, match) : null;
}

/** מוחק את המקור של קובץ מעובד, אם יש. */
function removeOriginal(processedName, dir = ORIGINALS_DIR) {
  const found = findOriginal(processedName, dir);
  if (found) fs.rmSync(found, { force: true });
  return found;
}

/**
 * ממה לעבד מחדש תמונה שב-uploads: מהמקור כשהוא קיים, ומהקובץ המעובד
 * כשלא. מחזיר { path, original }.
 */
function sourceForUpload(uploadPath, dir = ORIGINALS_DIR) {
  const original = findOriginal(path.basename(uploadPath), dir);
  return original ? { path: original, original: true } : { path: uploadPath, original: false };
}

module.exports = {
  originalExt, saveOriginal, findOriginal, removeOriginal, sourceForUpload,
};
