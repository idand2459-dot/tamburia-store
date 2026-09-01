/**
 * נתיבי העלאת תמונות המוצרים. דורשים התחברות כאדמין,
 * והבדיקה קודמת ל-multer כדי לא לכתוב קובץ לפני שאושר.
 */
const express = require('express');
const { upload } = require('../middleware/upload');
const controller = require('../controllers/upload.controller');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.post('/upload', requireAdmin, upload.single('image'), controller.uploadSingle);
router.post('/upload-multiple', requireAdmin, upload.array('images', 5), controller.uploadMultiple);

module.exports = router;
