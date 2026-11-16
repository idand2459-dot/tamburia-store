/**
 * Tells the storefront whether it is the portfolio demo. Public and read-only.
 */
const demoService = require('./demo.service');

/** GET /api/demo — { demo: false }, or { demo: true, identities } in demo mode. */
async function info(req, res) {
  res.json(demoService.getPublicInfo());
}

module.exports = { info };
