const express = require('express');
const { upload } = require('../middleware/upload');
const controller = require('../controllers/upload.controller');

const router = express.Router();

// שמות הנתיבים נשמרים כפי שהיו, כדי לא לגעת בקליינט:
// POST /api/upload  ו-  POST /api/upload-multiple
router.post('/upload', upload.single('image'), controller.uploadSingle);
router.post('/upload-multiple', upload.array('images', 5), controller.uploadMultiple);

module.exports = router;
