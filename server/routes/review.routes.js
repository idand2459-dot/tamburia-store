/**
 * נתיבי חוות הדעת. קריאת מאושרות וכתיבת חוות דעת חדשה פתוחות
 * ללקוח, המודרציה דורשת התחברות כאדמין. /all ו-/stats לפני /:id.
 */
const express = require('express');
const controller = require('../controllers/review.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/stats', controller.stats);
router.get('/', controller.list);
router.post('/', controller.create);

router.get('/all', requireAdmin, controller.listAll);
router.get('/:id', requireAdmin, idParam, controller.getOne);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

router.put('/:id/approve', requireAdmin, idParam, controller.approve);
router.patch('/:id/approve', requireAdmin, idParam, controller.approve);

module.exports = router;
