const express = require('express');
const app = express();

app.use(express.static('.'));

const products = [
  { id: 1, name: 'תוף סנר Pearl', price: 450 },
  { id: 2, name: 'היהאט Zildjian 14"', price: 320 },
  { id: 3, name: 'מקלות Vic Firth 5A', price: 45 },
];

app.get('/api/products', function(req, res) {
  res.json(products);
});

app.listen(3000, function() {
  console.log('השרת עובד על פורט 3000!');
});