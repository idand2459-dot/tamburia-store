const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * בדיקת בריאות — מאמת שהשרת חי ושהחיבור ל-DB עובד.
 * שימושי גם כשנשווה בין השרת החדש לישן.
 */
router.get('/health', async (req, res) => {
  const info = await db.assertConnection();
  res.json({
    status: 'ok',
    database: info.db,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ── ראוטרים לפי דומיין ───────────────────────────────
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/pigment-formulas', require('./pigmentFormula.routes'));
router.use('/', require('./upload.routes'));   // /upload, /upload-multiple

module.exports = router;
