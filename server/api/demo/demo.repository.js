/**
 * Access to what the portfolio demo adds to a database: the marker table (which exists only in a
 * demo database; it is never created by a migration or by the server) and the visitor orders.
 * The only place in the demo domain that writes SQL.
 */
const { query } = require('../../config/db');
const { SEED_TAG_PREFIX } = require('./demo.rules');

/**
 * A visitor order: not a seeded one (its request_id is empty or does not start with the seed tag)
 * and carrying one of the three identity phones. Defence in depth: a row that is not recognisably
 * demo data is never counted and never deleted.
 */
const VISITOR_PREDICATE = `
  (request_id IS NULL OR request_id NOT LIKE '${SEED_TAG_PREFIX}%')
  AND customer_phone = ANY($1::text[])
`;

/** Whether the marker table exists (to_regclass returns NULL, and does not fail, when it is absent). */
async function markerTableExists() {
  const { rows } = await query("SELECT to_regclass('public.demo_database_marker') AS marker");
  return rows[0].marker !== null;
}

/** The marker row ({ id, state }), or null when the table is empty. The table must exist. */
async function readMarker() {
  const { rows } = await query('SELECT id, state FROM demo_database_marker');
  return rows[0] || null;
}

/** How many visitor orders are stored. */
async function countVisitorOrders(phones) {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM orders WHERE ${VISITOR_PREDICATE}`, [phones]);
  return rows[0].total;
}

/**
 * Deletes up to `limit` visitor orders older than `ttlHours` (oldest first) in one statement and
 * returns how many. Products, reviews, settings, pigment formulas, the marker and seeded orders
 * are never touched. The order's request_id and request_hash live in the same row, so the
 * idempotency data goes with it.
 */
async function deleteExpiredVisitorOrders({ phones, ttlHours, limit }) {
  const { rowCount } = await query(
    `DELETE FROM orders WHERE id IN (
       SELECT id FROM orders
       WHERE ${VISITOR_PREDICATE} AND created_at < NOW() - make_interval(hours => $2::int)
       ORDER BY created_at, id
       LIMIT $3::int
     )`,
    [phones, ttlHours, limit]
  );
  return rowCount;
}

module.exports = { markerTableExists, readMarker, countVisitorOrders, deleteExpiredVisitorOrders };
