const express = require('express');
const controller = require('../controllers/product.controller');
const { idParam } = require('../middleware/validate');

const router = express.Router();

// /categories חייב לבוא לפני /:id, אחרת "categories" ייחשב למזהה
router.get('/categories', controller.categories);

router.get('/', controller.list);                    // List
router.get('/:id', idParam, controller.getOne);      // Read
router.post('/', controller.create);                 // Create
router.put('/:id', idParam, controller.update);      // Update
router.delete('/:id', idParam, controller.remove);   // Delete

module.exports = router;
