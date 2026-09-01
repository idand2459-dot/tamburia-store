/**
 * מגדיר את קליטת קבצי התמונה: לאן הם נשמרים, באיזה שם,
 * אילו סוגים מותרים ומה גודלם המרבי.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const ALLOWED_MIME = /^image\//;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 5;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, unique + ext);
  },
});

/** דוחה כל קובץ שאינו תמונה בסיומת ובסוג התוכן המותרים. */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.test(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    err.message = `סוג קובץ לא נתמך: ${ext || file.mimetype}. מותר רק ${[...ALLOWED_EXTENSIONS].join(', ')}`;
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

module.exports = { upload, UPLOADS_DIR, MAX_FILE_SIZE, MAX_FILES };
