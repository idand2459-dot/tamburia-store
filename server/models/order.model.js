const { query } = require('../config/db');

/** כמו במוצרים — עמודות מפורשות, לא SELECT * */
const COLUMNS = `
  id, customer_name, customer_phone, customer_email,
  delivery_method, delivery_address, notes, items,
  subtotal, delivery_fee, total, status, created_at
`;

/** עמודות JSONB — חייבות JSON.stringify לפני שליחה ל-pg */
const JSON_COLUMNS = new Set(['items']);

function toDbValue(column, value) {
  return JSON_COLUMNS.has(column) ? JSON.stringify(value ?? []) : value;
}

/** משאיר ספרות בלבד — כך 050-673-5040 ו-0506735040 מזוהים כאותו מספר */
function digitsOnly(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

/** בונה WHERE משותף ל-list ול-count, כדי שהספירה תמיד תתאים לתוצאות */
function buildFilters(options = {}) {
  const { status, phone, search, from, to } = options;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (phone) {
    params.push(digitsOnly(phone));
    conditions.push(`REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g') = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(customer_name ILIKE $${params.length} OR customer_phone ILIKE $${params.length} OR customer_email ILIKE $${params.length})`
    );
  }
  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    // סוף היום כולל — הוולידטור כבר הפך תאריך לגבול העליון הנכון
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/**
 * רשימת הזמנות. ברירת המחדל — החדשה ביותר ראשונה, כמו בשרת הישן.
 * id משמש כשובר-שוויון כדי שהסדר יהיה יציב בין קריאות.
 */
async function list(options = {}) {
  const { sort = 'created_at', order = 'DESC', limit, offset } = options;
  const { where, params } = buildFilters(options);

  // sort ו-order עברו ולידציה מול whitelist — לא ניתן להזריק דרכם
  let sql = `SELECT ${COLUMNS} FROM orders ${where} ORDER BY ${sort} ${order}, id DESC`;

  if (limit !== undefined) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  if (offset !== undefined) {
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const { rows } = await query(sql, params);
  return rows;
}

/** ספירה לאותם תנאי סינון — בשביל pagination */
async function count(options = {}) {
  const { where, params } = buildFilters(options);
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM orders ${where}`, params);
  return rows[0].total;
}

/** הזמנה בודדת, או null אם אינה קיימת */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM orders WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** כל ההזמנות של מספר טלפון — מסך "ההזמנות שלי" של הלקוח */
async function findByPhone(phone) {
  return list({ phone });
}

/** יוצר הזמנה ומחזיר אותה כפי שנשמרה */
async function create(data) {
  const columns = Object.keys(data);
  const values = columns.map((col) => toDbValue(col, data[col]));
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const { rows } = await query(
    `INSERT INTO orders (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/**
 * מעדכן רק את השדות שנמצאים ב-data.
 * מחזיר null אם ההזמנה אינה קיימת.
 */
async function update(id, data) {
  const columns = Object.keys(data);
  if (columns.length === 0) return findById(id);

  const assignments = columns.map((col, i) => `${col} = $${i + 1}`);
  const values = columns.map((col) => toDbValue(col, data[col]));
  values.push(id);

  const { rows } = await query(
    `UPDATE orders SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

/** מוחק ומחזיר את ההזמנה שנמחקה, או null אם לא הייתה קיימת */
async function remove(id) {
  const { rows } = await query(`DELETE FROM orders WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] || null;
}

/**
 * סיכום לפי סטטוס — מה שמסך האדמין מחשב היום בצד הלקוח
 * על כל ההזמנות שהוא הוריד.
 */
async function statsByStatus() {
  const { rows } = await query(`
    SELECT status,
           COUNT(*)::int      AS orders,
           COALESCE(SUM(total), 0)::int AS revenue
    FROM orders
    GROUP BY status
    ORDER BY status
  `);
  return rows;
}

module.exports = {
  list, count, findById, findByPhone,
  create, update, remove, statsByStatus, digitsOnly,
};
