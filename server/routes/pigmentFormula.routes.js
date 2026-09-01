const express = require('express');
const controller = require('../controllers/pigmentFormula.controller');
const { idParam } = require('../middleware/validate');

const router = express.Router();

// שני מקטעים, ולכן אינו מתנגש ב-/:id — אבל נשאר ראשון לבהירות
router.get('/code/:code', controller.getByCode);

router.get('/', controller.list);                      // List
router.get('/:id', idParam, controller.getOne);        // Read
router.post('/', controller.create);                   // Create
router.put('/:id', idParam, controller.update);        // Update
router.delete('/:id', idParam, controller.remove);     // Delete

module.exports = router;
