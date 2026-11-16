/**
 * נתיבי ההתחברות של האדמין, עם הגבלת קצב על ניסיונות הסיסמה.
 */
const express = require('express');
const config = require('../../config/env');
const controller = require('./auth.controller');
const { requireAdminRead } = require('../../middleware/requireAdmin');
const { rateLimit } = require('../../middleware/rateLimit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: config.auth.loginWindowMs,
  max: config.auth.loginMaxAttempts,
  message: 'יותר מדי ניסיונות התחברות',
});

/** מוסיף לבקשה דרך לאפס את מונה הניסיונות לאחר התחברות מוצלחת. */
function exposeReset(req, res, next) {
  req.resetRateLimit = () => loginLimiter.reset(req);
  next();
}

router.post('/login', exposeReset, loginLimiter, controller.login);
// The viewer session exists only in the portfolio demo: on a normal server this route is a 404.
if (config.demo.enabled) {
  router.post('/demo-login', loginLimiter, controller.demoLogin);
}
router.post('/logout', controller.logout);
router.get('/me', requireAdminRead, controller.me);

module.exports = router;
