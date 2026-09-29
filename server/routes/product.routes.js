/**
 * נתיבי המוצרים. הקריאה פתוחה לכולם, השינוי דורש התחברות כאדמין.
 * /categories מוגדר לפני /:id כדי שלא ייחשב למזהה.
 */
const express = require('express');
const controller = require('../controllers/product.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin, markAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

// markAdmin ולא requireAdmin: הקריאות פתוחות לכולם, והוא רק מסמן מי
// שואל — רשימה עם ?active=all ומוצר בודד שהוסתר מותרים לאדמין בלבד.
// /categories מתאר תמיד את מה שבחנות, ולכן אינו צריך לדעת מי שואל.
router.get('/categories', controller.categories);
router.get('/', markAdmin, controller.list);
router.get('/:id', markAdmin, idParam, controller.getOne);

router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

module.exports = router;
