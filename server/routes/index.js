/**
 * מאגד את כל ראוטרי ה-API תחת /api ומוסיף נתיב בדיקת בריאות.
 */
const express = require('express');
const db = require('../config/db');

const router = express.Router();

/** GET /api/health — מאמת שהשרת חי ושהחיבור למסד עובד. */
router.get('/health', async (req, res) => {
  const info = await db.assertConnection();
  res.json({
    status: 'ok',
    database: info.db,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/pigment-formulas', require('./pigmentFormula.routes'));
router.use('/', require('./upload.routes'));

module.exports = router;
