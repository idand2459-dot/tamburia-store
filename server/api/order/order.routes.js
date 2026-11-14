/**
 * נתיבי ההזמנות. יצירת הזמנה וחיפוש לפי טלפון פתוחים ללקוח,
 * כל השאר דורש התחברות כאדמין. /stats מוגדר לפני /:id.
 */
const express = require('express');
const config = require('../../config/env');
const controller = require('./order.controller');
const { idParam } = require('../../middleware/validate');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { rateLimit } = require('../../middleware/rateLimit');

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

/**
 * Creating an order sends two emails and writes a row, so it is limited per client address
 * (ORDER_RATE_MAX per ORDER_RATE_WINDOW_MS; 10 per 15 minutes by default). Every request counts,
 * a retry of the same request_id included: the storefront keeps the checkout attempt on a 429 and
 * sends it again by hand later, with the same request_id.
 */
const createLimiter = rateLimit({
  windowMs: config.rateLimits.orders.windowMs,
  max: config.rateLimits.orders.max,
  message: 'יותר מדי הזמנות בזמן קצר',
});

router.post('/', createLimiter, controller.create);
router.get('/by-phone/:phone', byPhoneLimiter, controller.byPhone);

router.get('/stats', requireAdmin, controller.stats);
router.get('/', requireAdmin, controller.list);
router.get('/:id', requireAdmin, idParam, controller.getOne);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

router.put('/:id/status', requireAdmin, idParam, controller.updateStatus);
router.put('/:id/items/:line/picked', requireAdmin, idParam, controller.setPicked);

module.exports = router;
