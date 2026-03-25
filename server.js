const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const app = express();

const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'tamburia', password: '1234', port: 5432 });

// No-cache for HTML — always serve fresh page, never stale
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static('.'));
app.use(express.json());
app.use(cors());

// ===== הגדרת שליחת מייל =====
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'anridvir@gmail.com',
    pass: 'rufgiitbplggbtgk'
  }
});

function buildOrderEmail(order) {
  const deliveryText = order.delivery_method === 'pickup'
    ? '🏪 איסוף עצמי — בר כוכבא 52, פתח תקווה'
    : `🚚 משלוח לכתובת: ${order.delivery_address}`;

  const itemsRows = order.items.map(item =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.name}${item.selectedColor ? ` (${item.selectedColor})` : ''}${item.selectedSize ? ` — ${item.selectedSize}` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">₪${item.price * item.quantity}</td>
    </tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">
    
    <!-- כותרת -->
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">🔧 טכניק טמבור</h1>
      <p style="color:#e63946;margin:8px 0 0;font-size:16px;font-weight:bold">הזמנה חדשה #${order.id}</p>
    </div>

    <!-- פרטי לקוח -->
    <div style="padding:24px 32px">
      <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:16px;border-bottom:2px solid #e63946;padding-bottom:8px">פרטי לקוח</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#666;width:120px">שם:</td><td style="padding:6px 0;font-weight:bold">${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#666">טלפון:</td><td style="padding:6px 0;font-weight:bold">${order.customer_phone}</td></tr>
        ${order.customer_email ? `<tr><td style="padding:6px 0;color:#666">אימייל:</td><td style="padding:6px 0">${order.customer_email}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#666">אופן קבלה:</td><td style="padding:6px 0">${deliveryText}</td></tr>
        ${order.notes ? `<tr><td style="padding:6px 0;color:#666">הערות:</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
      </table>
    </div>

    <!-- פריטים -->
    <div style="padding:0 32px 24px">
      <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:16px;border-bottom:2px solid #e63946;padding-bottom:8px">פריטים שהוזמנו</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:10px 8px;text-align:right;color:#555">מוצר</th>
            <th style="padding:10px 8px;text-align:center;color:#555">כמות</th>
            <th style="padding:10px 8px;text-align:left;color:#555">מחיר</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>

    <!-- סיכום -->
    <div style="padding:0 32px 28px">
      <div style="background:#f8f8f8;border-radius:8px;padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#666">
          <span>סכום מוצרים:</span><span>₪${order.subtotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:#666">
          <span>משלוח:</span><span>${order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1a1a2e;border-top:2px solid #e63946;padding-top:12px">
          <span>סה"כ לתשלום:</span><span>₪${order.total}</span>
        </div>
      </div>
    </div>

    <!-- כפתור -->
    <div style="padding:0 32px 32px;text-align:center">
      <a href="http://localhost:3001/admin" style="background:#e63946;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
        כניסה לאדמין לניהול ההזמנה
      </a>
    </div>

    <!-- תחתית -->
    <div style="background:#f0f0f0;padding:16px 32px;text-align:center;color:#999;font-size:12px">
      טכניק טמבור • בר כוכבא 52, פתח תקווה • 03-9315750
    </div>
  </div>
</body>
</html>`;
}

async function sendOrderEmail(order) {
  try {
    await transporter.sendMail({
      from: '"טכניק טמבור 🔧" <anridvir@gmail.com>',
      to: 'anridvir@gmail.com',
      subject: `📦 הזמנה חדשה #${order.id} — ${order.customer_name} — ₪${order.total}`,
      html: buildOrderEmail(order)
    });
    console.log(`מייל נשלח עבור הזמנה #${order.id} ✓`);
  } catch (err) {
    console.error('שגיאה בשליחת מייל:', err.message);
  }
}

// מייל אישור ללקוח עם שליחת ההזמנה
function buildCustomerConfirmEmail(order) {
  const deliveryText = order.delivery_method === 'pickup'
    ? '🏪 איסוף עצמי — בר כוכבא 52, פתח תקווה'
    : `🚚 משלוח לכתובת: ${order.delivery_address}`;

  const itemsRows = order.items.map(item =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${item.name}${item.selectedColor ? ` (${item.selectedColor})` : ''}${item.selectedSize ? ` — ${item.selectedSize}` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">₪${item.price * item.quantity}</td>
    </tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">

    <!-- כותרת -->
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">🔧 טכניק טמבור</h1>
      <p style="color:#e63946;margin:8px 0 0;font-size:16px;font-weight:bold">אישור קבלת הזמנה — מספר #${order.id}</p>
    </div>

    <!-- הבהרה חשובה -->
    <div style="background:#fff8e1;border-right:4px solid #f4c430;padding:12px 20px;margin:0">
      <p style="margin:0;font-size:0.82rem;color:#666">⚠️ מסמך זה הוא <strong>אישור הזמנה בלבד</strong> ואינו חשבונית מס. חשבונית מס תוצא בנפרד.</p>
    </div>

    <!-- ברכה -->
    <div style="padding:28px 32px 0">
      <p style="font-size:1.1rem;color:#1a1a2e;margin:0 0 12px">שלום ${order.customer_name},</p>
      <p style="font-size:1rem;color:#555;line-height:1.7;margin:0 0 8px">
        ההזמנה שלך התקבלה אצלנו בהצלחה! 🎉<br/>
        אנחנו נטפל בה בהקדם האפשרי וניצור איתך קשר לאישור.
      </p>
    </div>

    <!-- פרטי הזמנה -->
    <div style="padding:20px 32px">
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">מספר הזמנה:</span><strong>#${order.id}</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#666">אופן קבלה:</span><span>${deliveryText}</span>
        </div>
      </div>

      <!-- פריטים -->
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:10px 8px;text-align:right;color:#555">מוצר</th>
            <th style="padding:10px 8px;text-align:center;color:#555">כמות</th>
            <th style="padding:10px 8px;text-align:left;color:#555">מחיר</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <!-- סיכום -->
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#666">
          <span>סכום מוצרים:</span><span>₪${order.subtotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:#666">
          <span>משלוח:</span><span>${order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1a1a2e;border-top:2px solid #e63946;padding-top:12px">
          <span>סה"כ לתשלום:</span><span>₪${order.total}</span>
        </div>
      </div>
    </div>

    <!-- פרטי קשר -->
    <div style="padding:0 32px 28px;text-align:center">
      <p style="color:#666;font-size:0.9rem;margin-bottom:12px">לכל שאלה אנחנו כאן בשבילך:</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a href="tel:039315750" style="background:#1a1a2e;color:white;padding:10px 18px;border-radius:20px;text-decoration:none;font-size:0.85rem;font-weight:bold">📞 03-9315750</a>
        <a href="tel:0506735040" style="background:#1a1a2e;color:white;padding:10px 18px;border-radius:20px;text-decoration:none;font-size:0.85rem;font-weight:bold">📱 050-6735040</a>
        <a href="https://wa.me/972506735040" style="background:#25d366;color:white;padding:10px 18px;border-radius:20px;text-decoration:none;font-size:0.85rem;font-weight:bold">💬 וואטסאפ</a>
      </div>
    </div>

    <!-- תחתית -->
    <div style="background:#f0f0f0;padding:16px 32px;text-align:center;color:#999;font-size:12px">
      טכניק טמבור • בר כוכבא 52, פתח תקווה • א׳-ה׳ 7:00-20:00 • ו׳ 7:00-15:00
    </div>
  </div>
</body>
</html>`;
}

async function sendCustomerConfirmEmail(order) {
  if (!order.customer_email) return;
  try {
    await transporter.sendMail({
      from: '"טכניק טמבור 🔧" <anridvir@gmail.com>',
      to: order.customer_email,
      subject: `✅ ההזמנה שלך התקבלה! מספר הזמנה #${order.id} — טכניק טמבור`,
      html: buildCustomerConfirmEmail(order)
    });
    console.log(`מייל אישור נשלח ללקוח ${order.customer_email} ✓`);
  } catch (err) {
    console.error('שגיאה בשליחת מייל אישור:', err.message);
  }
}
const STATUS_LABELS = {
  processing: { label: 'בטיפול',  emoji: '⚙️', desc: 'קיבלנו את הזמנתך ואנחנו מתחילים לטפל בה. נעדכן אותך כשהיא תהיה מוכנה.' },
  shipped:    { label: 'נשלחה',   emoji: '🚚', desc: 'ההזמנה שלך יצאה לדרך ותגיע אליך בקרוב. תודה על הסבלנות!' },
  completed:  { label: 'הושלמה', emoji: '🎉', desc: 'ההזמנה שלך הושלמה בהצלחה!\n\nתודה שבחרת בטכניק טמבור — זה לא מובן מאליו עבורנו ואנחנו שמחים שיכולנו לעזור.\n\nנשמח לראותך שוב! 😊' },
};

function buildStatusEmail(order, status) {
  const cfg = STATUS_LABELS[status];
  if (!cfg) return null;
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">🔧 טכניק טמבור</h1>
      <p style="color:#e63946;margin:8px 0 0;font-size:16px;font-weight:bold">${cfg.emoji} עדכון הזמנה #${order.id}</p>
    </div>
    <div style="padding:32px">
      <p style="font-size:1.1rem;color:#1a1a2e">שלום ${order.customer_name},</p>
      <p style="font-size:1rem;color:#555">${cfg.desc}</p>
      <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">מספר הזמנה:</span><strong>#${order.id}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#666">סטטוס:</span>
          <strong style="color:#e63946">${cfg.emoji} ${cfg.label}</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#666">סה"כ:</span><strong>₪${order.total}</strong>
        </div>
      </div>
      <p style="color:#999;font-size:0.85rem">שאלות? צרו קשר: 03-9315750 | 050-6735040</p>
    </div>
    <div style="background:#f0f0f0;padding:16px 32px;text-align:center;color:#999;font-size:12px">
      טכניק טמבור • בר כוכבא 52, פתח תקווה
    </div>
  </div>
</body>
</html>`;
}

async function sendStatusEmail(order, status) {
  if (!order.customer_email) return; // אין מייל ללקוח
  const html = buildStatusEmail(order, status);
  if (!html) return; // סטטוס שלא שולחים עליו מייל (new)
  try {
    await transporter.sendMail({
      from: '"טכניק טמבור 🔧" <anridvir@gmail.com>',
      to: order.customer_email,
      subject: `${STATUS_LABELS[status]?.emoji} עדכון הזמנה #${order.id} — טכניק טמבור`,
      html
    });
    console.log(`מייל סטטוס נשלח ללקוח ${order.customer_email} ✓`);
  } catch (err) {
    console.error('שגיאה בשליחת מייל סטטוס:', err.message);
  }
}
// ============================

async function initDB() {
  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      reviewer_name VARCHAR(200) NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      text TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'store',
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      approved BOOLEAN DEFAULT false,
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
  const { name, price, image_url, images, colors, sizes, category, subcategory, sku, description, in_stock, variants } = req.body;
  const parsedVariants = Array.isArray(variants) ? variants : [];
  const effectivePrice = parsedVariants.length > 0
    ? Math.min(...parsedVariants.map(v => Number(v.price) || 0))
    : (price || 0);
  const result = await pool.query(
    'INSERT INTO products (name, price, stock, image_url, images, colors, sizes, category, subcategory, sku, description, in_stock, variants) VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
    [name, effectivePrice, image_url||'', JSON.stringify(images||[]), colors, sizes||[], category, subcategory||null, sku||null, description||null, in_stock !== false, JSON.stringify(parsedVariants)]
  );
  res.json(result.rows[0]);
});

app.put('/api/products/:id', async (req, res) => {
  const { name, price, colors, sizes, category, subcategory, sku, description, images, in_stock, image_url, variants } = req.body;
  const parsedVariants = Array.isArray(variants) ? variants : [];
  const effectivePrice = parsedVariants.length > 0
    ? Math.min(...parsedVariants.map(v => Number(v.price) || 0))
    : (price || 0);
  const result = await pool.query(
    'UPDATE products SET name=$1,price=$2,colors=$3,sizes=$4,category=$5,subcategory=$6,sku=$7,description=$8,images=$9,in_stock=$10,image_url=$11,variants=$12 WHERE id=$13 RETURNING *',
    [name, effectivePrice, colors, sizes||[], category, subcategory||null, sku||null, description||null, JSON.stringify(images||[]), in_stock !== false, image_url||'', JSON.stringify(parsedVariants), req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/products/:id', async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ message: 'נמחק' });
});

// הזמנות לפי טלפון (ללקוח)
app.get('/api/orders/by-phone/:phone', async (req, res) => {
  const phone = req.params.phone.replace(/\D/g, ''); // רק ספרות
  const result = await pool.query(
    `SELECT * FROM orders WHERE REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g') = $1 ORDER BY created_at DESC`,
    [phone]
  );
  res.json(result.rows);
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
  const order = result.rows[0];

  // מייל לאבא
  await sendOrderEmail({ ...order, items });
  // מייל אישור ללקוח
  await sendCustomerConfirmEmail({ ...order, items });

  res.json(order);
});

app.put('/api/orders/:id/status', async (req, res) => {
  const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
  const order = result.rows[0];
  console.log(`סטטוס הזמנה #${order.id} שונה ל-${req.body.status} | מייל לקוח: ${order.customer_email || 'אין'}`);
  await sendStatusEmail(order, req.body.status);
  res.json(order);
});

app.delete('/api/orders/:id', async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ message: 'נמחק' });
});

// REVIEWS
app.get('/api/reviews', async (req, res) => {
  const { type, product_id } = req.query;
  let query = 'SELECT * FROM reviews WHERE approved=true';
  const params = [];
  if (type) { params.push(type); query += ` AND type=$${params.length}`; }
  if (product_id) { params.push(product_id); query += ` AND product_id=$${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.get('/api/reviews/all', async (req, res) => {
  const result = await pool.query(`
    SELECT r.*, p.name as product_name
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
  `);
  res.json(result.rows);
});

app.post('/api/reviews', async (req, res) => {
  const { reviewer_name, rating, text, type, product_id } = req.body;
  if (!reviewer_name || !rating || !text) return res.status(400).json({ error: 'חסרים שדות' });
  const result = await pool.query(
    'INSERT INTO reviews (reviewer_name, rating, text, type, product_id, approved) VALUES ($1,$2,$3,$4,$5,false) RETURNING *',
    [reviewer_name, rating, text, type||'store', product_id||null]
  );
  res.json(result.rows[0]);
});

app.put('/api/reviews/:id/approve', async (req, res) => {
  const result = await pool.query(
    'UPDATE reviews SET approved=$1 WHERE id=$2 RETURNING *',
    [req.body.approved, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/reviews/:id', async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id=$1', [req.params.id]);
  res.json({ message: 'נמחק' });
});

// ── PIGMENT FORMULAS ─────────────────────────────────────────────────────────
async function initPigmentFormulas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pigment_formulas (
      id                  SERIAL PRIMARY KEY,
      color_code          VARCHAR(50) NOT NULL UNIQUE,
      color_name_he       VARCHAR(100) NOT NULL,
      hex                 VARCHAR(7)  NOT NULL,
      ml_per_liter_light  INTEGER     NOT NULL DEFAULT 30,
      ml_per_liter_medium INTEGER     NOT NULL DEFAULT 60,
      ml_per_liter_dark   INTEGER     NOT NULL DEFAULT 120,
      sort_order          INTEGER     NOT NULL DEFAULT 0
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM pigment_formulas');
  if (parseInt(rows[0].cnt) > 0) return;

  const colors = [
    ['cream',      'שמנת',      '#F5E6C8', 30, 65, 130,  1],
    ['yellow',     'צהוב',      '#FFD700', 35, 70, 140,  2],
    ['mustard',    'חרדל',      '#C8960C', 30, 65, 130,  3],
    ['orange',     'כתום',      '#FF6B35', 30, 60, 120,  4],
    ['red',        'אדום',      '#DC2626', 25, 55, 110,  5],
    ['pink',       'ורוד',      '#FF69B4', 30, 60, 120,  6],
    ['terracotta', 'טרקוטה',    '#C2674E', 25, 55, 110,  7],
    ['lilac',      'לילך',      '#C084FC', 30, 60, 120,  8],
    ['purple',     'סגול',      '#7B2FBE', 25, 50, 100,  9],
    ['sky_blue',   'תכלת',      '#38BDF8', 30, 60, 120, 10],
    ['blue',       'כחול',      '#1D4ED8', 25, 50, 100, 11],
    ['turquoise',  'טורקיז',    '#0D9488', 25, 55, 110, 12],
    ['green',      'ירוק',      '#16A34A', 25, 55, 110, 13],
    ['olive',      'ירוק זית',  '#6B7C2E', 25, 55, 110, 14],
    ['beige',      "בז'",       '#D4A96A', 30, 65, 130, 15],
    ['khaki',      'חאקי',      '#8B8456', 25, 55, 115, 16],
    ['brown',      'חום',       '#92400E', 20, 45,  95, 17],
    ['chocolate',  'שוקולד',    '#5C3317', 20, 40,  85, 18],
    ['gray',       'אפור',      '#6B7280', 20, 45,  95, 19],
    ['black',      'שחור',      '#1C1C1C', 15, 35,  80, 20],
  ];

  for (const [code, name, hex, light, medium, dark, sort] of colors) {
    await pool.query(
      `INSERT INTO pigment_formulas (color_code,color_name_he,hex,ml_per_liter_light,ml_per_liter_medium,ml_per_liter_dark,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [code, name, hex, light, medium, dark, sort]
    );
  }
  console.log('✅ pigment_formulas table seeded');
}
initPigmentFormulas().catch(console.error);

app.get('/api/pigment-formulas', async (req, res) => {
  const result = await pool.query('SELECT * FROM pigment_formulas ORDER BY sort_order');
  res.json(result.rows);
});

app.listen(3000, () => console.log('השרת עובד על פורט 3000 ✓'));