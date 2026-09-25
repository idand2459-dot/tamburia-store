/**
 * נתיבי ההזמנות. יצירת הזמנה וחיפוש לפי טלפון פתוחים ללקוח,
 * כל השאר דורש התחברות כאדמין. /stats מוגדר לפני /:id.
 */
const express = require('express');
const controller = require('../controllers/order.controller');
const { idParam } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/requireAdmin');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * החיפוש לפי טלפון פתוח בכוונה — לקוח בודק הזמנה בלי להירשם.
 * המחיר הוא שמספר טלפון לבדו מחזיר שם, כתובת, פריטים וסכומים,
 * ואפשר לסרוק מספרים ברצף. ההגבלה כאן לא הופכת את הנתיב למוגן,
 * רק הורסת את הכדאיות של סריקה בנפח: לקוח בודק הזמנה כמה פעמים,
 * סקריפט מנסה מאות מספרים.
 *
 * הגנה מלאה דורשת הוכחת בעלות על המספר (OTP), וזו החלטה מוצרית
 * נפרדת — ראה את ההערה בסיכום.
 */
const byPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'יותר מדי בדיקות, נסה שוב מאוחר יותר',
});

router.post('/', controller.create);
router.get('/by-phone/:phone', byPhoneLimiter, controller.byPhone);

router.get('/stats', requireAdmin, controller.stats);
router.get('/', requireAdmin, controller.list);
router.get('/:id', requireAdmin, idParam, controller.getOne);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

router.put('/:id/status', requireAdmin, idParam, controller.updateStatus);
router.patch('/:id/status', requireAdmin, idParam, controller.updateStatus);

module.exports = router;
