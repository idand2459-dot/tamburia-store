/**
 * Switches a route off in the portfolio demo, for every caller (the owner included), before the
 * route does anything: the answer is a 403 with the stable reason `demo_disabled`. Outside demo mode
 * it does nothing. Used for image uploads, which cannot persist on the host's ephemeral disk.
 */
const config = require('../config/env');
const { AppError } = require('../utils/AppError');

/** Express middleware: 403 in demo mode, otherwise continues. */
function demoDisabled(req, res, next) {
  if (config.demo.enabled) {
    return next(new AppError(403, 'הפעולה הזו מושבתת באתר ההדגמה', { reason: 'demo_disabled' }));
  }
  next();
}

module.exports = { demoDisabled };
