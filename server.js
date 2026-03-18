const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const app = express();

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'tamburia', password: '1234', port: 5432 });

app.use(express.static('.'));
app.use(express.json());
app.use(cors());

async function initDB() {
  // הוספת עמודות חדשות אם לא קיימות
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(200) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      customer_email VARCHAR(200),
      delivery_method VARCHAR(20) NOT NULL,
      delivery_address TEXT,
      notes TEXT,
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('מסד הנתונים מוכן ✓');
}
initDB().catch(console.error);

// PRODUCTS
app.get('/api/products', async (req, res) => {
  const result = await pool.query('SELECT * FROM products');
  res.json(result.rows);
});

app.use('/uploads', express.static('uploads'));

app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: '/uploads/' + req.file.filename });
});

app.post('/api/upload-multiple', upload.array('images', 5), (req, res) => {
  res.json({ imageUrls: req.files.map(f => '/uploads/' + f.filename) });
});

app.post('/api/products', async (req, res) => {
  const { name, price, image_url, images, colors, category, sku, description, in_stock } = req.body;
  const result = await pool.query(
    'INSERT INTO products (name, price, stock, image_url, images, colors, category, sku, description, in_stock) VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [name, price, image_url||'', JSON.stringify(images||[]), colors, category, sku||null, description||null, in_stock !== false]
  );
  res.json(result.rows[0]);
});

app.put('/api/products/:id', async (req, res) => {
  const { name, price, colors, category, sku, description, images, in_stock, image_url } = req.body;
  const result = await pool.query(
    'UPDATE products SET name=$1,price=$2,colors=$3,category=$4,sku=$5,description=$6,images=$7,in_stock=$8,image_url=$9 WHERE id=$10 RETURNING *',
    [name, price, colors, category, sku||null, description||null, JSON.stringify(images||[]), in_stock !== false, image_url||'', req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/products/:id', async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ message: 'נמחק' });
});

// ORDERS
app.get('/api/orders', async (req, res) => {
  const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/orders', async (req, res) => {
  const { customer_name, customer_phone, customer_email, delivery_method, delivery_address, notes, items, subtotal, delivery_fee, total } = req.body;
  const result = await pool.query(
    `INSERT INTO orders (customer_name,customer_phone,customer_email,delivery_method,delivery_address,notes,items,subtotal,delivery_fee,total,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING *`,
    [customer_name, customer_phone, customer_email||null, delivery_method, delivery_address||null, notes||null, JSON.stringify(items), subtotal, delivery_fee, total]
  );
  res.json(result.rows[0]);
});

app.put('/api/orders/:id/status', async (req, res) => {
  const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/orders/:id', async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ message: 'נמחק' });
});

app.listen(3000, () => console.log('השרת עובד על פורט 3000 ✓'));








