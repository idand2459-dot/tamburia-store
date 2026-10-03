/**
 * נתיבי העלאת תמונות המוצרים. דורשים התחברות כאדמין,
 * והבדיקה קודמת ל-multer כדי לא לכתוב קובץ לפני שאושר. אחרי הקליטה
 * כל תמונה עוברת עיבוד (processUploads) ורק הגרסה המעובדת נשמרת.
 */
const express = require('express');
const { upload, processUploads, MAX_FILES } = require('../middleware/upload');
const controller = require('../controllers/upload.controller');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.post('/upload-multiple', requireAdmin, upload.array('images', MAX_FILES), processUploads, controller.uploadMultiple);

module.exports = router;
