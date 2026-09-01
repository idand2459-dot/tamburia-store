const { badRequest } = require('../utils/AppError');

/** POST /api/upload — קובץ אחד בשדה "image" */
function uploadSingle(req, res) {
  // בקוד הקודם היעדר קובץ הפיל את הבקשה ב-500
  if (!req.file) throw badRequest('לא נשלח קובץ בשדה "image"');
  res.json({ imageUrl: '/uploads/' + req.file.filename });
}

/** POST /api/upload-multiple — עד 5 קבצים בשדה "images" */
function uploadMultiple(req, res) {
  if (!req.files || req.files.length === 0) {
    throw badRequest('לא נשלחו קבצים בשדה "images"');
  }
  res.json({ imageUrls: req.files.map((f) => '/uploads/' + f.filename) });
}

module.exports = { uploadSingle, uploadMultiple };
