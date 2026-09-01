/**
 * נתיבי המוצרים. הקריאה פתוחה לכולם, השינוי דורש התחברות כאדמין.
 * /categories מוגדר לפני /:id כדי שלא ייחשב למזהה.
 */
const express = require('express');
const controller = require('../controllers/product.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/categories', controller.categories);
router.get('/', controller.list);
router.get('/:id', idParam, controller.getOne);

router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

module.exports = router;
