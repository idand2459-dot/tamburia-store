/**
 * מחזיר את הכתובות הציבוריות של קבצי התמונה שהועלו.
 */
const { badRequest } = require('../utils/AppError');

/** POST /api/upload — מחזיר את כתובת הקובץ שהועלה בשדה "image". */
function uploadSingle(req, res) {
  if (!req.file) throw badRequest('לא נשלח קובץ בשדה "image"');
  res.json({ imageUrl: '/uploads/' + req.file.filename });
}

/** POST /api/upload-multiple — מחזיר את כתובות הקבצים שהועלו בשדה "images". */
function uploadMultiple(req, res) {
  if (!req.files || req.files.length === 0) {
    throw badRequest('לא נשלחו קבצים בשדה "images"');
  }
  res.json({ imageUrls: req.files.map((f) => '/uploads/' + f.filename) });
}

module.exports = { uploadSingle, uploadMultiple };
