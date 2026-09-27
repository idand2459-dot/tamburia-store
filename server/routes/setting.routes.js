/**
 * נתיבי ההגדרות. שניהם דורשים התחברות כאדמין: אלה העדפות של מסך
 * הניהול, ואין ללקוח מה לעשות בהן.
 */
const express = require('express');
const controller = require('../controllers/setting.controller');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/:key', requireAdmin, controller.getOne);
router.put('/:key', requireAdmin, controller.update);

module.exports = router;
