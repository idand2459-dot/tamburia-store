/**
 * The limits on creating an order and writing a review (P8.1 step C), on real requests against the
 * real routes: the production middleware with the thresholds from config.rateLimits.
 *
 * This suite starts its own server with low limits (4 orders and 2 reviews per 3 seconds), set
 * before the server loads its configuration; every other suite runs with high ones
 * (test/lib/testServer.js), and the counters live in the server process, so nothing is shared.
 *
 * Phase 1 uses bodies that fail validation, so reaching the limit creates nothing and sends no
 * email. Phase 2 creates one order, one review and a product, and removes them at the end.
 */
process.env.ORDER_RATE_MAX = '4';
process.env.ORDER_RATE_WINDOW_MS = '3000';
process.env.REVIEW_RATE_MAX = '2';
process.env.REVIEW_RATE_WINDOW_MS = '3000';

const crypto = require('crypto');
const { login } = require('./helpers');
const { runHttpSuite } = require('./lib/testServer');
// Set by runHttpSuite: the suite talks only to the server it started itself.
let BASE;

const WINDOW_MS = 3000;
const MARKER = `rate-test-${crypto.randomBytes(3).toString('hex')}`;

let passed = 0;
let failed = 0;
let authCookie = null;
const createdOrders = [];
const createdReviews = [];
const createdProducts = [];

/** Records the result of one check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — got: ${JSON.stringify(actual)}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends a request; returns the status, the parsed body (or null) and the headers. */
async function call(method, path, body, { auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authCookie) headers.Cookie = authCookie;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, headers: res.headers };
}

const postOrder = (body) => call('POST', '/orders', body);
const postReview = (body) => call('POST', '/reviews', body);
const admin = (method, path, body) => call(method, path, body, { auth: true });

/** Checks a 429: the status, the Hebrew message, Retry-After, and the { error } shape. */
function expectLimited(name, res, text) {
  const retryAfter = Number(res.headers.get('retry-after'));
  check(`${name}: 429`, res.status === 429, res.status);
  check(`${name}: Retry-After is a whole number of seconds within the window`,
    Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= WINDOW_MS / 1000, res.headers.get('retry-after'));
  check(`${name}: RateLimit-Remaining is 0`, res.headers.get('ratelimit-remaining') === '0', res.headers.get('ratelimit-remaining'));
  check(`${name}: the message is the limiter's, in Hebrew, with the seconds`,
    res.body && typeof res.body.error === 'string' && res.body.error.includes(text) && /\(עוד \d+ שניות\)/.test(res.body.error), res.body);
  check(`${name}: the body is { error } only`, res.body && JSON.stringify(Object.keys(res.body)) === '["error"]', res.body);
}

/** A valid order for the test product, with a fixed request id (the same body every time). */
function orderBody(product, requestId) {
  return {
    request_id: requestId,
    customer_name: MARKER,
    customer_phone: '0501234567',
    delivery_method: 'pickup',
    items: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }],
  };
}

/** The orders this suite created, found by the customer name. */
async function ordersOfThisSuite() {
  const res = await admin('GET', `/orders?search=${MARKER}`);
  return Array.isArray(res.body) ? res.body : [];
}

/** Phase 1: the limit itself, with requests that create nothing. */
async function testLimits() {
  console.log('\n── הזמנות: הבקשה אחרי המכסה');
  const first = [];
  for (let i = 0; i < 4; i++) first.push(await postOrder({}));
  check('ארבע הבקשות הראשונות מגיעות לוולידציה (400, לא 429)', first.every((r) => r.status === 400), first.map((r) => r.status));
  check('RateLimit-Limit הוא 4 ו-RateLimit-Remaining יורד', first.every((r) => r.headers.get('ratelimit-limit') === '4')
    && JSON.stringify(first.map((r) => r.headers.get('ratelimit-remaining'))) === '["3","2","1","0"]',
  first.map((r) => [r.headers.get('ratelimit-limit'), r.headers.get('ratelimit-remaining')]));
  expectLimited('הבקשה החמישית', await postOrder({}), 'יותר מדי הזמנות בזמן קצר');
  check('בקשה תקינה אחרי המכסה נחסמת גם היא', (await postOrder({ x: 1 })).status === 429);

  console.log('\n── מונים נפרדים');
  const review1 = await postReview({});
  check('חוות דעת: מונה משלה, לא נגמר בגלל ההזמנות (400)', review1.status === 400, review1.status);
  check('חוות דעת: RateLimit-Limit הוא 2', review1.headers.get('ratelimit-limit') === '2', review1.headers.get('ratelimit-limit'));
  const review2 = await postReview({});
  check('חוות דעת: הבקשה השנייה (400)', review2.status === 400, review2.status);
  expectLimited('חוות דעת: הבקשה השלישית', await postReview({}), 'יותר מדי חוות דעת בזמן קצר');
  check('ההזמנות עדיין חסומות', (await postOrder({})).status === 429);

  console.log('\n── מה שלא מוגבל');
  check('the removed order lookup is a 404 with no limiter', (await call('GET', '/orders/by-phone/0501234567')).status === 404);
  check('רשימת הזמנות לאדמין', (await admin('GET', '/orders')).status === 200);
  check('קריאת חוות דעת מאושרות', (await call('GET', '/reviews')).status === 200);
  check('קריאת מוצרים', (await call('GET', '/products?limit=1')).status === 200);
  check('התחברות האדמין', (await call('GET', '/auth/me', undefined, { auth: true })).status === 200);

  console.log('\n── אחרי החלון');
  await sleep(WINDOW_MS + 300);
}

/** Phase 2: below the limits everything works, and the 429 never touches the stored order. */
async function testBelowAndReplay() {
  console.log('\n── מתחת למכסה: הזמנה, חוות דעת ושליחה חוזרת');
  const created = await admin('POST', '/products', { name: 'מוצר בדיקת מכסה', price: 25, category: 'tools', sku: `TEST-${MARKER}` });
  createdProducts.push(created.body.id);
  check('נוצר מוצר בדיקה', created.status === 201, created.status);
  const product = created.body;

  const requestId = crypto.randomUUID();
  const body = orderBody(product, requestId);

  const order = await postOrder(body);
  if (order.body && order.body.id) createdOrders.push(order.body.id);
  check('הזמנה תקינה אחרי החלון → 201', order.status === 201 && order.body.total === 25 && order.body.status === 'new', order);
  check('RateLimit-Remaining 3 (הבקשה הראשונה בחלון החדש)', order.headers.get('ratelimit-remaining') === '3', order.headers.get('ratelimit-remaining'));

  const review = await postReview({ reviewer_name: 'Dana', text: 'בדיקת מכסה', rating: 5, type: 'store' });
  if (review.body && review.body.id) createdReviews.push(review.body.id);
  check('חוות דעת תקינה אחרי החלון → 201, ממתינה לאישור', review.status === 201 && review.body.approved === false, review);

  const replays = [];
  for (let i = 0; i < 3; i++) replays.push(await postOrder(body));
  check('שלוש שליחות חוזרות של אותו request_id → 200 עם Idempotent-Replayed',
    replays.every((r) => r.status === 200 && r.headers.get('idempotent-replayed') === 'true'), replays.map((r) => r.status));
  check('כולן מחזירות את ההזמנה המקורית', replays.every((r) => r.body.id === order.body.id), replays.map((r) => r.body && r.body.id));

  const limited = await postOrder(body);
  check('שליחה חוזרת נספרת גם היא: הבקשה החמישית בחלון → 429', limited.status === 429, limited.status);
  expectLimited('שליחה חוזרת מעל המכסה', limited, 'יותר מדי הזמנות בזמן קצר');
  check('ה-429 לא יצר הזמנה: עדיין הזמנה אחת', (await ordersOfThisSuite()).length === 1, (await ordersOfThisSuite()).length);

  await sleep(WINDOW_MS + 300);

  const later = await postOrder(body);
  check('שליחה חוזרת מאוחרת עם אותו גוף → 200, ההזמנה המקורית', later.status === 200
    && later.headers.get('idempotent-replayed') === 'true' && later.body.id === order.body.id, later.status);
  const orders = await ordersOfThisSuite();
  check('אחרי כל השליחות יש הזמנה אחת בלבד', orders.length === 1 && orders[0].id === order.body.id, orders.map((o) => o.id));
  check('ההזמנה לא השתנתה', orders[0].total === 25 && orders[0].customer_name === MARKER && orders[0].items.length === 1, orders[0]);

  const sameIdOtherBody = await postOrder({ ...body, customer_name: `${MARKER}-x` });
  check('אותו request_id עם גוף אחר עדיין 422 (ההגנה הקיימת לא הושפעה)', sameIdOtherBody.status === 422, sameIdOtherBody.status);
  check('ועדיין הזמנה אחת', (await ordersOfThisSuite()).length === 1);
}

/** Removes what the suite created. */
async function cleanup() {
  console.log('\n── ניקוי');
  for (const id of createdOrders) await admin('DELETE', `/orders/${id}`).catch(() => {});
  for (const id of createdReviews) await admin('DELETE', `/reviews/${id}`).catch(() => {});
  for (const id of createdProducts) await admin('DELETE', `/products/${id}`).catch(() => {});
  check('אין הזמנות שנשארו', (await ordersOfThisSuite()).length === 0);
}

runHttpSuite(async (baseUrl) => {
  BASE = baseUrl + '/api';
  authCookie = await login(baseUrl);
  await testLimits();
  await testBelowAndReplay();
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}, async () => {
  for (const id of createdOrders) await admin('DELETE', `/orders/${id}`).catch(() => {});
  for (const id of createdReviews) await admin('DELETE', `/reviews/${id}`).catch(() => {});
  for (const id of createdProducts) await admin('DELETE', `/products/${id}`).catch(() => {});
});
