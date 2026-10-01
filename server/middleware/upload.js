/**
 * מגדיר את קליטת קבצי התמונה: אילו סוגים מותרים, מה גודלם המרבי,
 * ואת שלב העיבוד שבין הקליטה לבין השמירה בתיקייה.
 *
 * הקבצים נקלטים לזיכרון ולא לדיסק, כי מה שנשמר הוא הגרסה המעובדת
 * בשם שנגזר מהתוכן — ראו image.service. המקור לא נכתב לדיסק אף פעם.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { processAndSave, heicError } = require('../services/image.service');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
  for (const file of files) {
    file.filename = await processAndSave(file.buffer, UPLOADS_DIR);
    file.buffer = null;
  }
  next();
}

module.exports = { upload, processUploads, UPLOADS_DIR, MAX_FILE_SIZE, MAX_FILES };
