const express = require('express');
const controller = require('../controllers/order.controller');
const { idParam } = require('../middleware/validate');

const router = express.Router();

// הנתיבים הקבועים חייבים לבוא לפני /:id, אחרת "stats" ייחשב למזהה
router.get('/stats', controller.stats);
router.get('/by-phone/:phone', controller.byPhone);

router.get('/', controller.list);                          // List
router.get('/:id', idParam, controller.getOne);            // Read
router.post('/', controller.create);                       // Create
router.put('/:id', idParam, controller.update);            // Update
router.delete('/:id', idParam, controller.remove);         // Delete

// נתיב הסטטוס נשמר כפי שהוא — מסך האדמין קורא אליו
router.put('/:id/status', idParam, controller.updateStatus);
router.patch('/:id/status', idParam, controller.updateStatus);

module.exports = router;
