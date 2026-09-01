const { query } = require('../config/db');

const FIELDS = [
  'id', 'color_code', 'color_name_he', 'hex',
  'ml_per_liter_light', 'ml_per_liter_medium', 'ml_per_liter_dark',
  'sort_order',
];

const COLUMNS = FIELDS.join(', ');

/** בונה WHERE משותף ל-list ול-count */
function buildFilters(options = {}) {
  const { search } = options;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(color_code ILIKE $${params.length} OR color_name_he ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/**
 * רשימת הגוונים. ברירת המחדל היא sort_order, כמו בשרת הישן —
 * זה הסדר שבו הם מוצגים במחשבון הצבע.
 */
async function list(options = {}) {
  const { sort = 'sort_order', order = 'ASC', limit, offset } = options;
  const { where, params } = buildFilters(options);

  // sort ו-order עברו ולידציה מול whitelist — לא ניתן להזריק דרכם
  let sql = `SELECT ${COLUMNS} FROM pigment_formulas ${where} ORDER BY ${sort} ${order}, id ASC`;

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
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM pigment_formulas ${where}`, params);
  return rows[0].total;
}

/** גוון בודד לפי מזהה, או null */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM pigment_formulas WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * גוון לפי color_code — המפתח הטבעי.
 * זה מה שהקליינט מחזיק בידיו (selectedColor במחשבון), לא ה-id.
 */
async function findByCode(code) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM pigment_formulas WHERE color_code = $1`, [code]);
  return rows[0] || null;
}

/** יוצר גוון ומחזיר אותו כפי שנשמר */
async function create(data) {
  const columns = Object.keys(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const { rows } = await query(
    `INSERT INTO pigment_formulas (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${COLUMNS}`,
    columns.map((col) => data[col])
  );
  return rows[0];
}

/**
 * מעדכן רק את השדות שנמצאים ב-data.
 * מחזיר null אם הגוון אינו קיים.
 */
async function update(id, data) {
  const columns = Object.keys(data);
  if (columns.length === 0) return findById(id);

  const assignments = columns.map((col, i) => `${col} = $${i + 1}`);
  const values = columns.map((col) => data[col]);
  values.push(id);

  const { rows } = await query(
    `UPDATE pigment_formulas SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

/** מוחק ומחזיר את הגוון שנמחק, או null אם לא היה קיים */
async function remove(id) {
  const { rows } = await query(
    `DELETE FROM pigment_formulas WHERE id = $1 RETURNING ${COLUMNS}`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { list, count, findById, findByCode, create, update, remove, FIELDS };
