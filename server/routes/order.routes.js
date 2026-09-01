/**
 * נתיבי ההזמנות. יצירת הזמנה וחיפוש לפי טלפון פתוחים ללקוח,
 * כל השאר דורש התחברות כאדמין. /stats מוגדר לפני /:id.
 */
const express = require('express');
const controller = require('../controllers/order.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.post('/', controller.create);
router.get('/by-phone/:phone', controller.byPhone);

router.get('/stats', requireAdmin, controller.stats);
router.get('/', requireAdmin, controller.list);
router.get('/:id', requireAdmin, idParam, controller.getOne);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

router.put('/:id/status', requireAdmin, idParam, controller.updateStatus);
router.patch('/:id/status', requireAdmin, idParam, controller.updateStatus);

module.exports = router;
