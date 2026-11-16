/**
 * נתיבי העלאת תמונות המוצרים. דורשים התחברות כאדמין,
 * והבדיקה קודמת ל-multer כדי לא לכתוב קובץ לפני שאושר. אחרי הקליטה
 * כל תמונה עוברת עיבוד (processUploads) ורק הגרסה המעובדת נשמרת.
 */
const express = require('express');
const { upload, processUploads, MAX_FILES } = require('../../middleware/upload');
const controller = require('./upload.controller');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { demoDisabled } = require('../../middleware/demoDisabled');

const router = express.Router();

// demoDisabled comes first: in the portfolio demo the answer is 403 for everyone, the owner included,
// and nothing is written to the host's ephemeral disk.
router.post('/upload-multiple', demoDisabled, requireAdmin, upload.array('images', MAX_FILES), processUploads, controller.uploadMultiple);

module.exports = router;
