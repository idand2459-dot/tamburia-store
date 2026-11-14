/**
 * גישה לטבלת orders: שליפה מסוננת, יצירה,
 * עדכון, סימון שורות שהוכנו, מחיקה וסיכום לפי סטטוס.
 */
const { query } = require('../../config/db');

const COLUMNS = `
  id, customer_name, customer_phone, customer_email,
  delivery_method, delivery_address, notes, items,
  subtotal, delivery_fee, total, status, created_at, picked_items
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

/** מכניס הזמנה. conflict הוא סעיף ON CONFLICT אופציונלי; בלעדיו שורה תמיד נוצרת. */
async function insert(data, conflict = '') {
  const columns = Object.keys(data);
  const values = columns.map((col) => toDbValue(col, data[col]));
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const { rows } = await query(
    `INSERT INTO orders (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ${conflict}
     RETURNING ${COLUMNS}`,
    values
  );
  return rows[0] || null;
}

/** יוצר הזמנה חדשה ומחזיר אותה כפי שנשמרה. */
function create(data) {
  return insert(data);
}

/**
 * יוצר הזמנה שיש לה request_id, פעם אחת בלבד. האינדקס הייחודי של המסד הוא
 * ההגנה מפני כפילות, גם בין בקשות מקבילות: ה-INSERT של הראשונה שמסיימת קובע,
 * וכל השאר נתקלות בהתנגשות. מחזיר את ההזמנה שנוצרה, או null אם המזהה כבר תפוס
 * (ואז findByRequestId מחזירה את ההזמנה שתפסה אותו).
 */
function createOnce(data) {
  return insert(data, 'ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING');
}

/**
 * מחזיר את ההזמנה שנוצרה עם מזהה בקשה, יחד עם request_hash שלה, או null.
 * ה-hash אינו ב-COLUMNS בכוונה: הוא לעולם לא יוצא בתשובה ללקוח.
 */
async function findByRequestId(requestId) {
  const { rows } = await query(
    `SELECT ${COLUMNS}, request_hash FROM orders WHERE request_id = $1`,
    [requestId]
  );
  return rows[0] || null;
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

/**
 * מסמן שורה אחת בהזמנה כמוכנה, או מבטל את הסימון.
 *
 * picked_items היא קבוצת האינדקסים של השורות שהוכנו
 * (מיגרציה 011). השינוי נעשה בתוך ה-UPDATE עצמו ולא כקריאה, שינוי
 * בקוד וכתיבה, כדי ששני מכשירים שמסמנים שורות שונות באותו רגע לא
 * ידרסו זה את זה. DISTINCT שומר על קבוצה גם כשאותה שורה מסומנת פעמיים.
 *
 * מחזיר את ההזמנה המעודכנת, או null אם אינה קיימת.
 */
async function setLinePicked(id, line, picked) {
  const { rows } = await query(
    `UPDATE orders
     SET picked_items = CASE
       WHEN $3 THEN ARRAY(SELECT DISTINCT unnest(array_append(picked_items, $2::int)) ORDER BY 1)
       ELSE array_remove(picked_items, $2::int)
     END
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, line, picked]
  );
  return rows[0] || null;
}

/** מוחק הזמנה ומחזיר אותה, או null אם לא הייתה קיימת. */
async function remove(id) {
  const { rows } = await query(`DELETE FROM orders WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] || null;
}

/**
 * סופר כמה הזמנות מכילות את המוצר הזה.
 *
 * items הוא JSONB של שורות ההזמנה, וכל שורה נושאת את id המוצר.
 * ‎@>‎ שואל "האם המערך מכיל אובייקט כזה", וזו השאלה: האם מחיקת המוצר
 * תנתק הזמנה קיימת מהפריט שנמכר בה.
 */
async function countByProductId(productId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM orders
     WHERE items @> $1::jsonb`,
    [JSON.stringify([{ id: productId }])]
  );
  return rows[0].total;
}

/** מחזיר מספר הזמנות והכנסה מצטברת לכל סטטוס. */
async function statsByStatus() {
  const { rows } = await query(`
    SELECT status,
           COUNT(*)::int      AS orders,
           COALESCE(SUM(total), 0) AS revenue
    FROM orders
    GROUP BY status
    ORDER BY status
  `);
  return rows;
}

module.exports = {
  list, count, findById,
  create, createOnce, findByRequestId, update, setLinePicked, remove, statsByStatus, countByProductId,
};
