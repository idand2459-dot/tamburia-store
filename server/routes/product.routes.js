/**
 * נתיבי המוצרים. הקריאה פתוחה לכולם, השינוי דורש התחברות כאדמין.
 * /categories מוגדר לפני /:id כדי שלא ייחשב למזהה.
 */
const express = require('express');
const controller = require('../controllers/product.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin, markAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

// markAdmin ולא requireAdmin: שלוש הקריאות פתוחות לכולם, והוא רק
// מסמן מי שואל. מוצר מוסתר אינו קיים עבור הלקוח וכן עבור האדמין.
router.get('/categories', markAdmin, controller.categories);
router.get('/', markAdmin, controller.list);
router.get('/:id', markAdmin, idParam, controller.getOne);

router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

module.exports = router;
