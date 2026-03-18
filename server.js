const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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

app.use('/uploads', express.static('uploads'));

app.post('/api/upload', upload.single('image'), function(req, res) {
  res.json({ imageUrl: '/uploads/' + req.file.filename });
});

app.post('/api/products', async function(req, res) {
  const { name, price, stock, image_url, colors } = req.body;
  const result = await pool.query(
    'INSERT INTO products (name, price, stock, image_url, colors) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, price, stock, image_url, colors]
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








