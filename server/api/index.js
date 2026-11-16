/**
 * מאגד את כל ראוטרי ה-API תחת /api ומוסיף נתיב בדיקת בריאות.
 */
const express = require('express');
const db = require('../config/db');
const { rememberMount } = require('../middleware/errorHandler');

const router = express.Router();

// Lets the error handler log a route template with its mount path (/api/orders/:id) and no URL.
router.use(rememberMount);

/** GET /api/health — מאמת שהשרת חי ושהחיבור למסד עובד. */
router.get('/health', async (req, res) => {
  const info = await db.assertConnection();
  res.json({
    status: 'ok',
    database: info.db,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

router.use('/demo', rememberMount, require('./demo/demo.routes'));
router.use('/auth', rememberMount, require('./auth/auth.routes'));
router.use('/products', rememberMount, require('./product/product.routes'));
router.use('/orders', rememberMount, require('./order/order.routes'));
router.use('/reviews', rememberMount, require('./review/review.routes'));
router.use('/pigment-formulas', rememberMount, require('./pigmentFormula/pigmentFormula.routes'));
router.use('/settings', rememberMount, require('./setting/setting.routes'));
router.use('/', rememberMount, require('./upload/upload.routes'));

module.exports = router;
