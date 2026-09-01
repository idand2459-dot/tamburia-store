const { query } = require('../config/db');

/**
 * העמודות מפורטות במפורש ולא SELECT * — כך תוספת עמודה ל-DB
 * לא מדליפה אותה ל-API בטעות, והסדר קבוע.
 */
const COLUMNS = `
  id, name, price, stock, image_url, images, colors, sizes,
  category, subcategory, sku, description, in_stock, variants
`;

/** עמודות JSONB — חייבות JSON.stringify לפני שליחה ל-pg */
const JSON_COLUMNS = new Set(['images', 'variants']);

function toDbValue(column, value) {
  return JSON_COLUMNS.has(column) ? JSON.stringify(value ?? []) : value;
}

/**
 * רשימת מוצרים, עם סינון אופציונלי.
 * בלי פרמטרים — מחזיר את כל המוצרים, כמו קודם.
 */
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
    // ILIKE = חיפוש שלא תלוי אותיות גדולות/קטנות
    conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // sort ו-order עברו ולידציה מול whitelist בוולידטור — לא ניתן להזריק דרכם
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

/** ספירה לאותם תנאי סינון — בשביל pagination */
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

/** מוצר בודד, או null אם אינו קיים */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** יוצר מוצר ומחזיר אותו כפי שנשמר */
async function create(data) {
  const columns = Object.keys(data);
  const values = columns.map((col) => toDbValue(col, data[col]));
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  // stock אינו בשימוש — המלאי מנוהל דרך in_stock הבוליאני
  const { rows } = await query(
    `INSERT INTO products (${columns.join(', ')}, stock)
     VALUES (${placeholders.join(', ')}, 0)
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0];
}

/**
 * מעדכן רק את השדות שנמצאים ב-data.
 * מחזיר null אם המוצר אינו קיים.
 */
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

/** מוחק ומחזיר את המוצר שנמחק, או null אם לא היה קיים */
async function remove(id) {
  const { rows } = await query(`DELETE FROM products WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] || null;
}

/** רשימת הקטגוריות ותתי-הקטגוריות הקיימות בפועל */
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
