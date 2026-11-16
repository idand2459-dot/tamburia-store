/**
 * נתיבי ההגדרות. שניהם דורשים התחברות כאדמין: אלה העדפות של מסך
 * הניהול, ואין ללקוח מה לעשות בהן.
 */
const express = require('express');
const controller = require('./setting.controller');
const { requireAdmin, requireAdminRead } = require('../../middleware/requireAdmin');

const router = express.Router();

// Read: owner and viewer. The write is owner only.
router.get('/:key', requireAdminRead, controller.getOne);
router.put('/:key', requireAdmin, controller.update);

module.exports = router;
