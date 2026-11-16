/**
 * Small helpers shared by the demo HTTP suites: calling the demo server, the owner and viewer
 * logins, the three fictional identities, and the data invariant ("every customer and reviewer
 * value in the database belongs to the fixed fictional set").
 */
const { DEMO_ADMIN_PASSWORD } = require('./demoServer');
const {
  IDENTITIES, REVIEWER_NAMES, DEMO_NOTE, SEED_TAG_PREFIX,
} = require('../../server/api/demo/demo.rules');

const COOKIE_NAME = 'tamburia_admin';

/** Returns `call(method, path, { body, cookie, headers })` bound to a server address. */
function apiClient(baseUrl) {
  return async function call(method, path, { body, cookie, headers = {}, raw = false } = {}) {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (cookie) init.headers.Cookie = cookie;
    const res = await fetch(`${baseUrl}${path}`, init);
    const text = await res.text();
    let parsed = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { text }; }
    return { status: res.status, body: parsed, text, headers: res.headers, setCookie: res.headers.getSetCookie?.() || [], raw };
  };
}

/** The `name=value` part of the admin cookie in a response, or null. */
function adminCookie(response) {
  const raw = response.setCookie.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return raw ? raw.split(';')[0] : null;
}

/** Logs in as the owner (the demo owner password) and returns the cookie. */
async function loginOwner(call) {
  const res = await call('POST', '/api/auth/login', { body: { password: DEMO_ADMIN_PASSWORD } });
  const cookie = adminCookie(res);
  if (res.status !== 200 || !cookie) throw new Error(`התחברות הבעלים נכשלה: ${res.status}`);
  return cookie;
}

/** Logs in as the public viewer and returns the cookie. */
async function loginViewer(call) {
  const res = await call('POST', '/api/auth/demo-login');
  const cookie = adminCookie(res);
  if (res.status !== 200 || !cookie) throw new Error(`כניסת הצופה נכשלה: ${res.status}`);
  return cookie;
}

/** A version-4 UUID for a request_id. */
const uuid = () => require('crypto').randomUUID();

/** The body of a valid demo order for one identity and one product line. */
function demoOrderBody(product, { identity = IDENTITIES[0], delivery = 'pickup', requestId = uuid(), quantity = 1, notes = null } = {}) {
  return {
    customer_name: identity.customer_name,
    customer_phone: identity.customer_phone,
    customer_email: identity.customer_email,
    delivery_method: delivery,
    delivery_address: delivery === 'delivery' ? identity.delivery_address : undefined,
    notes,
    request_id: requestId,
    items: [{ id: product.id, name: product.name, price: product.price, quantity }],
  };
}

/**
 * The data invariant, read straight from the database: every order created after `baselineOrderId`
 * carries one of the three identities (name, phone and email together) and, when it has an address,
 * that identity's address; notes are empty or the demo note; every review created after
 * `baselineReviewId` has a reviewer from the fixed list. Returns the list of violations (empty = ok).
 * Rows older than the baseline belong to other suites and are not judged here.
 */
async function invariantViolations(db, { baselineOrderId = 0, baselineReviewId = 0 } = {}) {
  const violations = [];
  const { rows: orders } = await db.query(
    'SELECT id, customer_name, customer_phone, customer_email, delivery_address, notes, request_id FROM orders WHERE id > $1',
    [baselineOrderId]
  );
  for (const order of orders) {
    const identity = IDENTITIES.find((item) => item.customer_name === order.customer_name
      && item.customer_phone === order.customer_phone && item.customer_email === order.customer_email);
    if (!identity) violations.push(`order ${order.id}: customer fields outside the fictional set`);
    else if (order.delivery_address && order.delivery_address !== identity.delivery_address) violations.push(`order ${order.id}: address`);
    if (order.notes && order.notes !== DEMO_NOTE) violations.push(`order ${order.id}: notes`);
    if (order.request_id && order.request_id.startsWith(SEED_TAG_PREFIX) === false && !/^[0-9a-f-]{36}$/.test(order.request_id)) {
      violations.push(`order ${order.id}: request_id shape`);
    }
  }
  const { rows: reviews } = await db.query('SELECT id, reviewer_name FROM reviews WHERE id > $1', [baselineReviewId]);
  for (const review of reviews) {
    if (!REVIEWER_NAMES.includes(review.reviewer_name)) violations.push(`review ${review.id}: reviewer outside the fixed list`);
  }
  return violations;
}

/** The highest id of a table (0 when empty), for a baseline. */
async function maxId(db, table) {
  const { rows } = await db.query(`SELECT COALESCE(MAX(id), 0)::int AS id FROM ${table}`);
  return rows[0].id;
}

/**
 * One comparable fingerprint of the content of the tables the admin API can write, so "nothing
 * changed" is a string comparison.
 */
async function contentFingerprint(db) {
  const parts = [];
  for (const [table, order] of [['products', 'id'], ['orders', 'id'], ['reviews', 'id'], ['pigment_formulas', 'id'], ['settings', 'key']]) {
    const { rows } = await db.query(`SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t.${order}), '')) AS h, COUNT(*)::int AS n FROM ${table} t`);
    parts.push(`${table}:${rows[0].n}:${rows[0].h}`);
  }
  return parts.join(',');
}

module.exports = {
  COOKIE_NAME, apiClient, adminCookie, loginOwner, loginViewer, uuid, demoOrderBody, invariantViolations,
  maxId, contentFingerprint,
};
