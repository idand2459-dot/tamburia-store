const express = require('express');
const controller = require('../controllers/review.controller');
const { idParam } = require('../middleware/validate');

const router = express.Router();

// הנתיבים הקבועים חייבים לבוא לפני /:id, אחרת "all" ייחשב למזהה
router.get('/all', controller.listAll);
router.get('/stats', controller.stats);

router.get('/', controller.list);                      // List
router.get('/:id', idParam, controller.getOne);        // Read
router.post('/', controller.create);                   // Create
router.put('/:id', idParam, controller.update);        // Update
router.delete('/:id', idParam, controller.remove);     // Delete

// נתיב האישור נשמר כפי שהוא — מסך האדמין קורא אליו
router.put('/:id/approve', idParam, controller.approve);
router.patch('/:id/approve', idParam, controller.approve);

module.exports = router;
