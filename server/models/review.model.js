/**
 * גישה לטבלת reviews: שליפה מסוננת עם ובלי שם המוצר,
 * יצירה, עדכון, מחיקה וחישוב ממוצע והתפלגות דירוגים.
 */
const { query } = require('../config/db');

const FIELDS = ['id', 'reviewer_name', 'rating', 'text', 'type', 'product_id', 'approved', 'created_at'];

const COLUMNS = FIELDS.map((f) => `r.${f}`).join(', ');
const RETURNING = FIELDS.join(', ');

const PRODUCT_JOIN = 'LEFT JOIN products p ON p.id = r.product_id';

/** בונה את תנאי ה-WHERE והפרמטרים המשותפים לשליפה, לספירה ולסטטיסטיקה. */
function buildFilters(options = {}) {
  const { type, productId, approved, rating, search } = options;
  const conditions = [];
  const params = [];

  if (type) {
    params.push(type);
    conditions.push(`r.type = $${params.length}`);
  }
  if (productId !== undefined) {
    params.push(productId);
    conditions.push(`r.product_id = $${params.length}`);
  }
  if (approved !== undefined) {
    params.push(approved);
    conditions.push(`COALESCE(r.approved, false) = $${params.length}`);
  }
  if (rating !== undefined) {
    params.push(rating);
    conditions.push(`r.rating = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(r.reviewer_name ILIKE $${params.length} OR r.text ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/** מחזיר חוות דעת לפי הסינון, ובאופן אופציונלי גם את שם המוצר. */
async function list(options = {}) {
  const { sort = 'created_at', order = 'DESC', limit, offset, withProductName = false } = options;
  const { where, params } = buildFilters(options);

  const columns = withProductName ? `${COLUMNS}, p.name AS product_name` : COLUMNS;
  const join = withProductName ? PRODUCT_JOIN : '';

  let sql = `SELECT ${columns} FROM reviews r ${join} ${where} ORDER BY r.${sort} ${order}, r.id DESC`;

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

/** סופר חוות דעת לפי אותם תנאי סינון, לצורך דפדוף. */
async function count(options = {}) {
  const { where, params } = buildFilters(options);
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM reviews r ${where}`, params);
  return rows[0].total;
}

/** מחזיר חוות דעת לפי מזהה, או null אם אינה קיימת. */
async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM reviews r WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

/** יוצר חוות דעת חדשה ומחזיר אותה כפי שנשמרה. */
async function create(data) {
  const columns = Object.keys(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const { rows } = await query(
    `INSERT INTO reviews (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${RETURNING}`,
    columns.map((col) => data[col])
  );
  return rows[0];
}

/** מעדכן את השדות שנשלחו בלבד, ומחזיר null אם אינה קיימת. */
async function update(id, data) {
  const columns = Object.keys(data);
  if (columns.length === 0) return findById(id);

  const assignments = columns.map((col, i) => `${col} = $${i + 1}`);
  const values = columns.map((col) => data[col]);
  values.push(id);

  const { rows } = await query(
    `UPDATE reviews SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${RETURNING}`,
    values
  );
  return rows[0] || null;
}

/** מוחק חוות דעת ומחזיר אותה, או null אם לא הייתה קיימת. */
async function remove(id) {
  const { rows } = await query(
    `DELETE FROM reviews WHERE id = $1 RETURNING ${RETURNING}`,
    [id]
  );
  return rows[0] || null;
}

/** מחזיר כמות, ממוצע והתפלגות דירוגים לפי הסינון שהתבקש. */
async function stats(options = {}) {
  const { where, params } = buildFilters(options);
  const { rows } = await query(`
    SELECT COUNT(*)::int AS total,
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average,
           (COUNT(*) FILTER (WHERE rating = 1))::int AS "1",
           (COUNT(*) FILTER (WHERE rating = 2))::int AS "2",
           (COUNT(*) FILTER (WHERE rating = 3))::int AS "3",
           (COUNT(*) FILTER (WHERE rating = 4))::int AS "4",
           (COUNT(*) FILTER (WHERE rating = 5))::int AS "5"
    FROM reviews r ${where}
  `, params);

  const { total, average, ...distribution } = rows[0];
  return { total, average, distribution };
}

module.exports = { list, count, findById, create, update, remove, stats };
