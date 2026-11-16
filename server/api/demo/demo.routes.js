/**
 * The demo route: one public GET that the storefront reads once to learn whether it is the demo.
 */
const express = require('express');
const controller = require('./demo.controller');

const router = express.Router();

router.get('/', controller.info);

module.exports = router;
