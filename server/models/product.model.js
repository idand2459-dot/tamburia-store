/**
 * גישה לטבלת products: שליפה מסוננת, ספירה, יצירה, עדכון ומחיקה.
 * זהו המקום היחיד בדומיין המוצרים שכותב SQL.
 */
const { query } = require('../config/db');

const COLUMNS = `
  id, name, price, stock, image_url, images, colors, sizes,
  category, subcategory, sku, description, in_stock, variants
`;

const JSON_COLUMNS = new Set(['images', 'variants']);

/** ממיר ערך לפורמט שמתאים לעמודה, כולל JSON למקום שצריך. */
function toDbValue(column, value) {
  return JSON_COLUMNS.has(column) ? JSON.stringify(value ?? []) : value;
}

/** מחזיר מוצרים לפי הסינון, המיון והדפדוף שהתבקשו. */
async function list(options = {}) {
  const { category, subcategory, inStock, search, sort = 'id', order = 'ASC', limit, offset } = options;

  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (subcategory) {
    params.push(subcategory);
    conditions.push(`subcategory = $${params.length}`);
  }
  if (inStock !== undefined) {
    params.push(inStock);
    conditions.push(`COALESCE(in_stock, true) = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let sql = `SELECT ${COLUMNS} FROM products ${where} ORDER BY ${sort} ${order}, id ASC`;

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

/** סופר מוצרים לפי אותם תנאי סינון, לצורך דפדוף. */
async function count(options = {}) {
  const { category, subcategory, inStock, search } = options;
  const conditions = [];
  const params = [];

  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (subcategory) { params.push(subcategory); conditions.push(`subcategory = $${params.length}`); }
  if (inStock !== undefined) { params.push(inStock); conditions.push(`COALESCE(in_stock, true) = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM products ${where}`, params);
  return rows[0].total;
}

/** מחזיר מוצר לפי מזהה, או null אם אינו קיים. */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** יוצר מוצר חדש ומחזיר אותו כפי שנשמר. */
async function create(data) {
  const columns = Object.keys(data);
  const values = columns.map((col) => toDbValue(col, data[col]));
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const { rows } = await query(
    `INSERT INTO products (${columns.join(', ')}, stock)
     VALUES (${placeholders.join(', ')}, 0)
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/** מעדכן את השדות שנשלחו בלבד, ומחזיר null אם המוצר אינו קיים. */
async function update(id, data) {
  const columns = Object.keys(data);
  if (columns.length === 0) return findById(id);

  const assignments = columns.map((col, i) => `${col} = $${i + 1}`);
  const values = columns.map((col) => toDbValue(col, data[col]));
  values.push(id);

  const { rows } = await query(
    `UPDATE products SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

/** מוחק מוצר ומחזיר אותו, או null אם לא היה קיים. */
async function remove(id) {
  const { rows } = await query(`DELETE FROM products WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] || null;
}

/** מחזיר את הקטגוריות ותתי-הקטגוריות הקיימות בפועל, עם ספירה. */
async function listCategories() {
  const { rows } = await query(`
    SELECT category, subcategory, COUNT(*)::int AS product_count
    FROM products
    WHERE category IS NOT NULL
    GROUP BY category, subcategory
    ORDER BY category, subcategory NULLS FIRST
  `);
  return rows;
}

module.exports = { list, count, findById, create, update, remove, listCategories };
