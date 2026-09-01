/**
 * גישה לטבלת orders: שליפה מסוננת, חיפוש לפי טלפון, יצירה,
 * עדכון, מחיקה וסיכום לפי סטטוס.
 */
const { query } = require('../config/db');

const COLUMNS = `
  id, customer_name, customer_phone, customer_email,
  delivery_method, delivery_address, notes, items,
  subtotal, delivery_fee, total, status, created_at
`;

const JSON_COLUMNS = new Set(['items']);

/** ממיר ערך לפורמט שמתאים לעמודה, כולל JSON למקום שצריך. */
function toDbValue(column, value) {
  return JSON_COLUMNS.has(column) ? JSON.stringify(value ?? []) : value;
}

/** משאיר ספרות בלבד, כדי שמספרי טלפון בפורמטים שונים יושוו נכון. */
function digitsOnly(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

/** בונה את תנאי ה-WHERE והפרמטרים המשותפים לשליפה ולספירה. */
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
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/** מחזיר הזמנות לפי הסינון והמיון, מהחדשה לישנה כברירת מחדל. */
async function list(options = {}) {
  const { sort = 'created_at', order = 'DESC', limit, offset } = options;
  const { where, params } = buildFilters(options);

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

/** סופר הזמנות לפי אותם תנאי סינון, לצורך דפדוף. */
async function count(options = {}) {
  const { where, params } = buildFilters(options);
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM orders ${where}`, params);
  return rows[0].total;
}

/** מחזיר הזמנה לפי מזהה, או null אם אינה קיימת. */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM orders WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** מחזיר את כל ההזמנות של מספר טלפון נתון. */
async function findByPhone(phone) {
  return list({ phone });
}

/** יוצר הזמנה חדשה ומחזיר אותה כפי שנשמרה. */
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

/** מעדכן את השדות שנשלחו בלבד, ומחזיר null אם ההזמנה אינה קיימת. */
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

/** מוחק הזמנה ומחזיר אותה, או null אם לא הייתה קיימת. */
async function remove(id) {
  const { rows } = await query(`DELETE FROM orders WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] || null;
}

/** מחזיר מספר הזמנות והכנסה מצטברת לכל סטטוס. */
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
