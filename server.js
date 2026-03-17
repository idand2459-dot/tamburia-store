const express = require('express');
const cors = require('cors');
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
app.use(express.json());
app.use(cors());

app.get('/api/products', async function(req, res) {
  const result = await pool.query('SELECT * FROM products');
  res.json(result.rows);
});

app.post('/api/products', async function(req, res) {
  const { name, price, stock } = req.body;
  const result = await pool.query(
    'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *',
    [name, price, stock]
  );
  res.json(result.rows[0]);
});

app.put('/api/products/:id', async function(req, res) {
  const { id } = req.params;
  const { stock } = req.body;
  const result = await pool.query(
    'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *',
    [stock, id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/products/:id', async function(req, res) {
  const { id } = req.params;
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  res.json({ message: 'המוצר נמחק' });
});

app.listen(3000, function() {
  console.log('השרת עובד על פורט 3000!');
});








