/**
 * מגדיר את קליטת קבצי התמונה: אילו סוגים מותרים, מה גודלם המרבי,
 * ואת שלב העיבוד שבין הקליטה לבין השמירה בתיקייה.
 *
 * הקבצים נקלטים לזיכרון ולא לדיסק, כי מה שנשמר הוא הגרסה המעובדת בשם
 * שנגזר מהתוכן — ראו image.service. היכן היא נשמרת (הדיסק או Cloudinary)
 * ואיפה הצילום המקורי, שאינו מוגש — ראו services/storage.
 */
const path = require('path');
const multer = require('multer');
const { prepareImage, heicError } = require('../services/image.service');
const storage = require('../services/storage');
const { originalExt } = require('../utils/originals');

const { UPLOADS_DIR } = storage;

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const ALLOWED_MIME = /^image\//;
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);
const HEIC_MIME = /^image\/hei[cf](-sequence)?$/;

/* תמונה מהאייפון שוקלת 3–5MB, ו-15MB משאירים מרווח לצילומי ProRAW
   שהומרו. עד חמישה קבצים בזיכרון בבת אחת — 75MB לכל היותר, ורק
   לאדמין מחובר. */
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 5;

/** דוחה כל קובץ שאינו תמונה בסיומת ובסוג התוכן המותרים. */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (HEIC_EXTENSIONS.has(ext) || HEIC_MIME.test(file.mimetype)) {
    return cb(heicError());
  }
  if (!ALLOWED_MIME.test(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    err.message = `סוג קובץ לא נתמך: ${ext || file.mimetype}. מותר רק ${[...ALLOWED_EXTENSIONS].join(', ')}`;
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

/**
 * מעבד את הקבצים שנקלטו ושומר אותם, ומציב לכל אחד filename כמו
 * שעשה diskStorage — כך שהקונטרולר לא צריך לדעת שמשהו השתנה.
 * אם קובץ אחד נכשל, הבקשה כולה נכשלת לפני שהמוצר נשמר.
 */
async function processUploads(req, res, next) {
  const files = req.file ? [req.file] : (req.files || []);
  // One image at a time, and each buffer is released before the next is read, so five
  // 15 MB photos never sit in memory together with their processed copies.
  for (const file of files) {
    const { filename, output } = await prepareImage(file.buffer);
    file.filename = filename;
    file.url = await storage.saveProcessed(filename, output);
    // המקור נשמר רק אחרי שהעיבוד הצליח: קובץ שבור לא מגיע לכאן. כישלון
    // בשמירתו אינו מכשיל את ההעלאה — התמונה שהאתר מגיש כבר נשמרה, והמקור
    // הוא רק חומר גלם לעיבוד מחדש.
    try {
      await storage.saveOriginal(filename, file.buffer, originalExt(file.originalname, file.mimetype));
    } catch (err) {
      console.error(`המקור של ${file.filename} לא נשמר:`, err.message);
    }
    file.buffer = null;
  }
  next();
}

module.exports = { upload, processUploads, UPLOADS_DIR, MAX_FILE_SIZE, MAX_FILES };
