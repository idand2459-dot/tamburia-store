const express = require('express');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tamburia',
  password: '1234',
  port: 5432,
});

app.use(express.static('.'));

app.get('/api/products', async function(req, res) {
  const result = await pool.query('SELECT * FROM products');
  res.json(result.rows);
});

app.listen(3000, function() {
  console.log('השרת עובד על פורט 3000!');
});








