/**
 * נתיבי חוות הדעת. קריאת מאושרות וכתיבת חוות דעת חדשה פתוחות
 * ללקוח, המודרציה דורשת התחברות כאדמין. /all ו-/stats לפני /:id.
 */
const express = require('express');
const config = require('../../config/env');
const controller = require('./review.controller');
const { idParam } = require('../../middleware/validate');
const { requireAdmin, requireAdminRead } = require('../../middleware/requireAdmin');
const { rateLimit } = require('../../middleware/rateLimit');

const router = express.Router();

/**
 * A review is public and anonymous, so writing one is limited per client address
 * (REVIEW_RATE_MAX per REVIEW_RATE_WINDOW_MS; 5 per hour by default). Reviews wait for approval, so
 * this only keeps the table and the moderation queue from being flooded.
 */
const createLimiter = rateLimit({
  windowMs: config.rateLimits.reviews.windowMs,
  max: config.rateLimits.reviews.max,
  message: 'יותר מדי חוות דעת בזמן קצר',
});

router.get('/stats', controller.stats);
router.get('/', controller.list);
router.post('/', createLimiter, controller.create);

// Reads: owner and viewer. Every other route below is owner only.
router.get('/all', requireAdminRead, controller.listAll);
router.get('/:id', requireAdminRead, idParam, controller.getOne);
router.put('/:id', requireAdmin, idParam, controller.update);
router.delete('/:id', requireAdmin, idParam, controller.remove);

router.put('/:id/approve', requireAdmin, idParam, controller.approve);

module.exports = router;
