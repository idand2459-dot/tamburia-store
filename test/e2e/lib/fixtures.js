/**
 * Deterministic data for the browser suite, and the cleanup of exactly that data.
 *
 * Everything the suite creates is named with a recognisable prefix (E2E_PREFIX in customer names,
 * `E2E-` in product SKUs), is recorded by id, and is deleted at the end by id. Before the run, a
 * sweep removes what an interrupted earlier run left behind, by the same prefixes. The sweep and
 * the direct SQL run only on the connection the guarded test server opened (test/lib/testServer.js
 * has already confirmed it is the separate local test database), never on another one.
 */
const E2E_PREFIX = 'E2E';
const CUSTOMER_NAME = `${E2E_PREFIX} לקוח סינתטי`;
const CUSTOMER_PHONE = '0500000000';
const CUSTOMER_EMAIL = 'e2e-customer@example.invalid';

/** Created ids, for the cleanup. */
const created = { orders: new Set(), products: new Set() };

/** A client for the API of the server under test, optionally with the admin cookie. */
function createApi(baseUrl, cookie = null) {
  async function call(method, path, body, headers = {}) {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, body: json, text };
  }
  return { call };
}

/** Creates one product through the admin API and remembers it for the cleanup. */
async function makeProduct(api, body) {
  const res = await api.call('POST', '/products', { category: 'tools', ...body });
  if (res.status !== 201) throw new Error(`יצירת מוצר בדיקה נכשלה: ${res.status}`);
  created.products.add(res.body.id);
  return res.body;
}

/** The catalogue the browser scenarios use: two priced products and one that is later sold out. */
async function createCatalog(api) {
  const stamp = Date.now().toString(36);
  const hammer = await makeProduct(api, { name: `${E2E_PREFIX} פטיש בדיקה`, price: 100, sku: `E2E-HAMMER-${stamp}` });
  const brush = await makeProduct(api, { name: `${E2E_PREFIX} מברשת בדיקה`, price: 30, sku: `E2E-BRUSH-${stamp}` });
  const stock = await makeProduct(api, { name: `${E2E_PREFIX} מוצר מלאי`, price: 50, sku: `E2E-STOCK-${stamp}` });
  return { hammer, brush, stock };
}

/** Remembers an order created during a scenario so that the cleanup removes it. */
function trackOrder(id) {
  if (id !== undefined && id !== null) created.orders.add(id);
}

/** Orders of this suite, read from PostgreSQL itself (not through the API under test). */
async function ordersOfCustomer(db, name = CUSTOMER_NAME) {
  const { rows } = await db.query('SELECT * FROM orders WHERE customer_name = $1 ORDER BY id', [name]);
  rows.forEach((row) => trackOrder(row.id));
  return rows;
}

/** Removes what an interrupted earlier run left behind, by prefix. */
async function sweepLeftovers(db) {
  await db.query('DELETE FROM orders WHERE customer_name LIKE $1', [`${E2E_PREFIX} %`]);
  await db.query('DELETE FROM products WHERE sku LIKE $1', ['E2E-%']);
}

/** Removes the orders and products this run created, by id. */
async function cleanup(db) {
  const orders = [...created.orders];
  const products = [...created.products];
  if (orders.length) await db.query('DELETE FROM orders WHERE id = ANY($1::int[])', [orders]);
  if (products.length) await db.query('DELETE FROM products WHERE id = ANY($1::int[])', [products]);
  // Anything of ours that was created without being tracked (an order made by the browser and not
  // yet read back) is found by the customer name.
  await db.query('DELETE FROM orders WHERE customer_name LIKE $1', [`${E2E_PREFIX} %`]);
  const left = await db.query(
    'SELECT (SELECT count(*) FROM orders WHERE customer_name LIKE $1) AS orders, (SELECT count(*) FROM products WHERE sku LIKE $2) AS products',
    [`${E2E_PREFIX} %`, 'E2E-%'],
  );
  return { orders: Number(left.rows[0].orders), products: Number(left.rows[0].products), removedOrders: orders.length, removedProducts: products.length };
}

module.exports = {
  E2E_PREFIX, CUSTOMER_NAME, CUSTOMER_PHONE, CUSTOMER_EMAIL,
  createApi, createCatalog, makeProduct, trackOrder, ordersOfCustomer, sweepLeftovers, cleanup,
};
