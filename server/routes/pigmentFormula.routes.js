/**
 * נתיבי גווני הפיגמנט. הקריאה פתוחה למחשבון הצבע,
 * השינוי דורש התחברות כאדמין.
 */
const express = require('express');
const controller = require('../controllers/pigmentFormula.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/code/:code', controller.getByCode);
router.get('/', controller.list);
router.get('/:id', idParam, controller.getOne);

router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

module.exports = router;
