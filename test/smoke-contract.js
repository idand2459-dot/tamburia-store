/**
 * Black-box HTTP contract test (REFACTOR_PLAN.md, P5).
 *
 * Pins the externally visible behaviour of the whole API — routes, status codes, error
 * shapes, auth guards, response headers and database effects — so the backend can be
 * restructured (P6/P7: Route → Controller → Service → Repository) without any of it
 * changing. It talks to the server over HTTP only and imports nothing from server/.
 *
 * Where the current behaviour looks like a bug, the test pins what the code does today
 * and marks it with "KNOWN:"; the finding is listed in the P5 report, not fixed here.
 *
 * Probes are side-effect free by design: invalid ids (0, 2147483647), empty bodies, or
 * requests rejected by a guard before anything is written. The flows that do write create
 * their own records, and everything is deleted at the end (also when the suite crashes).
 */
const { login } = require('./helpers');
const { runHttpSuite } = require('./lib/testServer');

// Set by runHttpSuite: the suite talks only to the server it started itself.
let BASE;
let cookie = null;

let passed = 0;
let failed = 0;

const createdOrders = [];
const createdProducts = [];
const createdReviews = [];
const createdFormulas = [];

const MISSING_ID = 2147483647;
const MARKER = 'CONTRACT-TEST';

/** Records the result of one check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

/** Sends a request; returns status, parsed body (or null when it is not JSON), headers and raw text. */
async function call(method, path, { body, auth = false, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (body !== undefined && raw === undefined) h['Content-Type'] = 'application/json';
  if (auth && cookie) h.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, headers: res.headers, text };
}

const admin = (method, path, body) => call(method, path, { body, auth: true });
const pub = (method, path, body) => call(method, path, { body });

/** The error text of a response, or '' when it has none. */
const errorOf = (res) => (res.body && typeof res.body.error === 'string' ? res.body.error : '');

/** Checks status and (optionally) that the error text contains `text`. */
function expectError(name, res, status, text) {
  const ok = res.status === status && (text === undefined || errorOf(res).includes(text));
  check(name, ok, `${res.status} ${errorOf(res)}`);
}

/** Every error body is exactly { error: string } plus optional details. */
function hasErrorShape(res) {
  return res.body !== null
    && typeof res.body.error === 'string'
    && Object.keys(res.body).every((k) => ['error', 'details', 'path'].includes(k));
}

// ───────────────────────────── routing ─────────────────────────────

/** Unknown paths, the generic 404 shape, and route-order sensitive paths. */
async function testRouting() {
  console.log('\n── ניתוב ונתיבים לא קיימים');

  const unknown = await pub('GET', '/unknown');
  check('GET /api/unknown → 404', unknown.status === 404, unknown.status);
  check('גוף ה-404 הוא { error, path }',
    unknown.body && unknown.body.error === 'הנתיב לא נמצא' && unknown.body.path === 'GET /api/unknown', unknown.body);
  check('404 הוא JSON', /application\/json/.test(unknown.headers.get('content-type') || ''), unknown.headers.get('content-type'));

  const unknownPost = await pub('POST', '/products/1/nope', {});
  check('POST לנתיב עמוק שאינו קיים → 404 כללי', unknownPost.status === 404 && unknownPost.body.error === 'הנתיב לא נמצא', unknownPost.body);

  const unknownDelete = await pub('DELETE', '/nope');
  check('DELETE /api/nope → 404 כללי', unknownDelete.status === 404 && unknownDelete.body.path === 'DELETE /api/nope', unknownDelete.body);

  // A wrong method on an existing path is the generic 404 as well (no 405 anywhere).
  const wrongMethod = await pub('PATCH', '/products/1');
  check('PATCH על נתיב קיים → 404 כללי (אין 405)', wrongMethod.status === 404 && wrongMethod.body.error === 'הנתיב לא נמצא', wrongMethod.status);
}

/** /uploads is not the SPA fallback: a missing image is a JSON 404. */
async function testUploadsStatic() {
  console.log('\n── /uploads');

  const res = await fetch(`${BASE.replace(/\/api$/, '')}/uploads/does-not-exist-${Date.now()}.jpg`);
  const body = await res.json().catch(() => null);
  check('תמונה חסרה → 404', res.status === 404, res.status);
  check('התשובה JSON ולא index.html', body && body.error === 'הנתיב לא נמצא', body);
}

// ───────────────────────────── auth coverage (SEC-04) ─────────────────────────────

/** Every admin route, without a cookie → 401, before any validation or lookup. */
async function testAdminRoutesRequireLogin() {
  console.log('\n── כל נתיב אדמין → 401 בלי עוגייה');

  // id 0 on purpose: if a guard were missing the request would end in a 400, never a write.
  const guarded = [
    ['GET', '/auth/me'],
    ['GET', '/orders'],
    ['GET', '/orders/stats'],
    ['GET', '/orders/0'],
    ['PUT', '/orders/0', {}],
    ['DELETE', '/orders/0'],
    ['PUT', '/orders/0/status', { status: 'new' }],
    ['PUT', '/orders/0/items/0/picked', { picked: true }],
    ['POST', '/products', {}],
    ['PUT', '/products/0', {}],
    ['DELETE', '/products/0'],
    ['GET', '/reviews/all'],
    ['GET', '/reviews/0'],
    ['PUT', '/reviews/0', {}],
    ['DELETE', '/reviews/0'],
    ['PUT', '/reviews/0/approve', { approved: true }],
    ['POST', '/pigment-formulas', {}],
    ['PUT', '/pigment-formulas/0', {}],
    ['DELETE', '/pigment-formulas/0'],
    ['GET', '/settings/stats-counting-from'],
    ['PUT', '/settings/stats-counting-from', {}],
    ['POST', '/upload-multiple'],
  ];

  for (const [method, path, body] of guarded) {
    const res = await pub(method, path, body);
    check(`${method} ${path} → 401`,
      res.status === 401 && errorOf(res) === 'נדרשת התחברות כמנהל' && hasErrorShape(res),
      `${res.status} ${errorOf(res)}`);
  }

  // The guard runs before the id check: an invalid id is still a 401, not a 400.
  const order = await pub('GET', '/orders/abc');
  check('המגן קודם לבדיקת המזהה (GET /orders/abc → 401)', order.status === 401, order.status);

  // A cookie with a wrong name is not a session.
  const wrongName = await call('GET', '/auth/me', { headers: { Cookie: 'other=1' } });
  check('עוגייה בשם אחר אינה התחברות', wrongName.status === 401, wrongName.status);
}

// ───────────────────────────── admin probes ─────────────────────────────

/** With a cookie: side-effect-free probes that prove each route exists and is the right one. */
async function testAdminProbes() {
  console.log('\n── נתיבי אדמין עם עוגייה (בדיקות בלי תופעות לוואי)');

  const bad = 'מזהה לא תקין';
  const probes = [
    // orders
    ['GET', '/orders/0', undefined, 400, bad],
    ['GET', '/orders/abc', undefined, 400, 'מזהה לא תקין: "abc"'],
    ['GET', '/orders/1.5', undefined, 400, bad],
    ['GET', `/orders/${MISSING_ID}`, undefined, 404, `הזמנה ${MISSING_ID} לא נמצאה`],
    ['PUT', '/orders/0', {}, 400, bad],
    ['PUT', `/orders/${MISSING_ID}`, { notes: 'x' }, 404, `הזמנה ${MISSING_ID} לא נמצאה`],
    ['PUT', `/orders/${MISSING_ID}`, {}, 400, 'לא נשלח אף שדה לעדכון'],
    ['DELETE', '/orders/0', undefined, 400, bad],
    ['DELETE', `/orders/${MISSING_ID}`, undefined, 404, `הזמנה ${MISSING_ID} לא נמצאה`],
    ['PUT', '/orders/0/status', { status: 'new' }, 400, bad],
    ['PUT', `/orders/${MISSING_ID}/status`, {}, 400, 'חסר שדה status'],
    ['PUT', `/orders/${MISSING_ID}/status`, { status: 'bogus' }, 400, 'status חייב להיות אחד מ'],
    ['PUT', `/orders/${MISSING_ID}/status`, { status: 'new' }, 404, `הזמנה ${MISSING_ID} לא נמצאה`],
    ['PUT', '/orders/0/items/0/picked', { picked: true }, 400, bad],
    ['PUT', `/orders/${MISSING_ID}/items/x/picked`, { picked: true }, 400, 'מספר שורה לא תקין: "x"'],
    ['PUT', `/orders/${MISSING_ID}/items/0/picked`, { picked: 'yes' }, 400, 'picked חייב להיות true או false'],
    ['PUT', `/orders/${MISSING_ID}/items/0/picked`, { picked: true }, 404, `הזמנה ${MISSING_ID} לא נמצאה`],
    // products
    ['POST', '/products', {}, 400, 'חסר שם מוצר'],
    ['POST', '/products', { name: '   ' }, 400, 'חסר שם מוצר'],
    ['POST', '/products', { name: 'x', price: -5 }, 400, 'המחיר חייב להיות'],
    ['PUT', '/products/0', { name: 'x' }, 400, bad],
    ['PUT', `/products/${MISSING_ID}`, {}, 400, 'לא נשלח אף שדה לעדכון'],
    ['PUT', `/products/${MISSING_ID}`, { name: '' }, 400, 'שם המוצר לא יכול להיות ריק'],
    ['PUT', `/products/${MISSING_ID}`, { name: 'x' }, 404, `מוצר ${MISSING_ID} לא נמצא`],
    ['DELETE', '/products/0', undefined, 400, bad],
    ['DELETE', `/products/${MISSING_ID}`, undefined, 404, `מוצר ${MISSING_ID} לא נמצא`],
    // reviews
    ['GET', '/reviews/0', undefined, 400, bad],
    ['GET', `/reviews/${MISSING_ID}`, undefined, 404, `חוות דעת ${MISSING_ID} לא נמצאה`],
    ['PUT', '/reviews/0', { text: 'x' }, 400, bad],
    ['PUT', `/reviews/${MISSING_ID}`, {}, 400, 'לא נשלח אף שדה לעדכון'],
    ['PUT', `/reviews/${MISSING_ID}`, { text: 'x' }, 404, `חוות דעת ${MISSING_ID} לא נמצאה`],
    ['PUT', '/reviews/0/approve', { approved: true }, 400, bad],
    ['PUT', `/reviews/${MISSING_ID}/approve`, {}, 400, 'חסר שדה approved'],
    ['PUT', `/reviews/${MISSING_ID}/approve`, { approved: true }, 404, `חוות דעת ${MISSING_ID} לא נמצאה`],
    ['DELETE', '/reviews/0', undefined, 400, bad],
    ['DELETE', `/reviews/${MISSING_ID}`, undefined, 404, `חוות דעת ${MISSING_ID} לא נמצאה`],
    // pigment formulas
    ['POST', '/pigment-formulas', {}, 400, 'חסר color_code'],
    ['PUT', '/pigment-formulas/0', { hex: '#FFFFFF' }, 400, bad],
    // The existing formula is fetched first, so an unknown id is a 404 even with an empty body.
    ['PUT', `/pigment-formulas/${MISSING_ID}`, {}, 404, `גוון ${MISSING_ID} לא נמצא`],
    ['DELETE', '/pigment-formulas/0', undefined, 400, bad],
    ['DELETE', `/pigment-formulas/${MISSING_ID}`, undefined, 404, `גוון ${MISSING_ID} לא נמצא`],
    // settings
    ['GET', '/settings/nope', undefined, 404, 'ההגדרה "nope" אינה קיימת'],
    ['PUT', '/settings/nope', { value: null }, 404, 'ההגדרה "nope" אינה קיימת'],
    ['PUT', '/settings/stats-counting-from', {}, 400, 'חסר שדה value'],
    // upload (no multipart body at all)
    ['POST', '/upload-multiple', undefined, 400, 'לא נשלחו קבצים בשדה "images"'],
  ];

  for (const [method, path, body, status, text] of probes) {
    const res = await admin(method, path, body);
    const routerFallthrough = errorOf(res) === 'הנתיב לא נמצא';
    check(`${method} ${path}${body ? ' ' + JSON.stringify(body) : ''} → ${status}`,
      res.status === status && errorOf(res).includes(text) && !routerFallthrough && hasErrorShape(res),
      `${res.status} ${errorOf(res)}`);
  }

  const me = await admin('GET', '/auth/me');
  check('GET /auth/me → 200 { authenticated, expiresAt }',
    me.status === 200 && me.body.authenticated === true && typeof me.body.expiresAt === 'number', me.body);

  const stats = await admin('GET', '/orders/stats');
  check('GET /orders/stats (לא נתפס כ-:id) → 200 { byStatus, totals }',
    stats.status === 200 && Array.isArray(stats.body.byStatus) && stats.body.totals && typeof stats.body.totals.orders === 'number', stats.body);

  const all = await admin('GET', '/reviews/all');
  check('GET /reviews/all (לא נתפס כ-:id) → 200', all.status === 200 && Array.isArray(all.body), all.status);

  const setting = await admin('GET', '/settings/stats-counting-from');
  check('GET /settings/stats-counting-from → 200 { key, value }',
    setting.status === 200 && setting.body.key === 'stats_counting_from' && 'value' in setting.body, setting.body);
}

// ───────────────────────────── upload ─────────────────────────────

/** Rejected uploads (admin only): nothing is written to disk. */
async function testUploadRejections() {
  console.log('\n── העלאת תמונות — דחיות');

  const notImage = new FormData();
  notImage.append('images', new Blob(['hello'], { type: 'text/plain' }), 'note.txt');
  const text = await call('POST', '/upload-multiple', { raw: notImage, auth: true });
  expectError('קובץ שאינו תמונה → 400', text, 400, 'סוג קובץ לא נתמך');

  const heic = new FormData();
  heic.append('images', new Blob(['x'], { type: 'image/heic' }), 'photo.heic');
  const heicRes = await call('POST', '/upload-multiple', { raw: heic, auth: true });
  check('HEIC → 415', heicRes.status === 415 && hasErrorShape(heicRes), `${heicRes.status} ${errorOf(heicRes)}`);

  const wrongField = new FormData();
  wrongField.append('photo', new Blob(['x'], { type: 'image/png' }), 'a.png');
  const field = await call('POST', '/upload-multiple', { raw: wrongField, auth: true });
  check('שדה בשם אחר מ-images → 400', field.status === 400 && hasErrorShape(field), `${field.status} ${errorOf(field)}`);

  const noFiles = await call('POST', '/upload-multiple', { raw: new FormData(), auth: true });
  expectError('multipart בלי קבצים → 400', noFiles, 400, 'לא נשלחו קבצים בשדה "images"');
}

// ───────────────────────────── auth ─────────────────────────────

/** Login/logout response shapes and cookie attributes. */
async function testAuthContract() {
  console.log('\n── התחברות: צורת התשובות והעוגייה');

  expectError('login בלי גוף → 400 "חסרה סיסמה"', await pub('POST', '/auth/login', {}), 400, 'חסרה סיסמה');
  expectError('login עם סיסמה שגויה → 401', await pub('POST', '/auth/login', { password: 'wrong' }), 401, 'סיסמה שגויה');

  const nonString = await pub('POST', '/auth/login', { password: 12345 });
  check('login עם סיסמה שאינה טקסט נדחה (400/401)', [400, 401].includes(nonString.status) && hasErrorShape(nonString),
    `${nonString.status} ${errorOf(nonString)}`);

  const ok = await call('POST', '/auth/login', { body: { password: process.env.ADMIN_PASSWORD } });
  check('login תקין → 200 { authenticated: true, expiresInHours }',
    ok.status === 200 && ok.body.authenticated === true && typeof ok.body.expiresInHours === 'number'
    && Object.keys(ok.body).length === 2, ok.body);

  const raw = (ok.headers.getSetCookie?.() || []).find((c) => c.startsWith('tamburia_admin='));
  check('העוגייה בנתיב /', /;\s*Path=\//i.test(raw || ''), raw);
  check('העוגייה עם תוקף (Max-Age או Expires)', /Max-Age=\d+|Expires=/i.test(raw || ''), raw);
  check('בפיתוח העוגייה אינה Secure', !/;\s*Secure/i.test(raw || ''), raw);

  const out = await call('POST', '/auth/logout');
  check('logout → 200 { authenticated: false }', out.status === 200 && out.body.authenticated === false, out.body);
}

// ───────────────────────────── public routes ─────────────────────────────

/** Public routes and their documented statuses and shapes. */
async function testPublicRoutes() {
  console.log('\n── נתיבים ציבוריים');

  const health = await pub('GET', '/health');
  check('GET /health → 200 { status, database, uptimeSeconds }',
    health.status === 200 && health.body.status === 'ok' && typeof health.body.database === 'string'
    && typeof health.body.uptimeSeconds === 'number', health.body);

  const products = await pub('GET', '/products');
  check('GET /products → 200 מערך שטוח', products.status === 200 && Array.isArray(products.body), products.status);

  const categories = await pub('GET', '/products/categories');
  check('GET /products/categories → 200 (לא נתפס כ-:id)', categories.status === 200 && !('error' in (categories.body || {})), categories.body);

  const reviews = await pub('GET', '/reviews');
  check('GET /reviews → 200 מערך שטוח', reviews.status === 200 && Array.isArray(reviews.body), reviews.status);

  const reviewStats = await pub('GET', '/reviews/stats');
  check('GET /reviews/stats → 200 אובייקט (לא נתפס כ-:id)', reviewStats.status === 200 && !Array.isArray(reviewStats.body) && !('error' in reviewStats.body), reviewStats.body);

  const formulas = await pub('GET', '/pigment-formulas');
  check('GET /pigment-formulas → 200 מערך שטוח', formulas.status === 200 && Array.isArray(formulas.body), formulas.status);

  expectError('GET /pigment-formulas/0 → 400', await pub('GET', '/pigment-formulas/0'), 400, 'מזהה לא תקין');
  expectError(`GET /pigment-formulas/${MISSING_ID} → 404`, await pub('GET', `/pigment-formulas/${MISSING_ID}`), 404, `גוון ${MISSING_ID} לא נמצא`);
  expectError('GET /pigment-formulas/code/nope_nope → 404 (/code לפני /:id)',
    await pub('GET', '/pigment-formulas/code/nope_nope'), 404, 'הגוון "nope_nope" לא נמצא');
  expectError('GET /pigment-formulas/code/BAD-CODE → 400',
    await pub('GET', '/pigment-formulas/code/BAD-CODE'), 400, 'color_code יכול להכיל');

  expectError('GET /products/0 → 400', await pub('GET', '/products/0'), 400, 'מזהה לא תקין: "0"');
  expectError(`GET /products/${MISSING_ID} → 404`, await pub('GET', `/products/${MISSING_ID}`), 404, `מוצר ${MISSING_ID} לא נמצא`);

  // KNOWN: validation order — delivery_method is checked before the customer name.
  expectError('POST /orders {} → 400', await pub('POST', '/orders', {}), 400, 'delivery_method חייב להיות אחד מ');
  // KNOWN: ...and the items are checked before the customer name.
  expectError('POST /orders בלי פריטים ובלי שם → 400 על הפריטים',
    await pub('POST', '/orders', { delivery_method: 'pickup', customer_phone: '0500000000', items: [] }), 400, 'לפחות פריט אחד');
  expectError('POST /reviews {} → 400', await pub('POST', '/reviews', {}), 400, 'חסר שם הכותב');
  expectError('POST /reviews בלי דירוג → 400',
    await pub('POST', '/reviews', { reviewer_name: 'x', text: 'y', type: 'store' }), 400, 'הדירוג חייב להיות');
  expectError('POST /reviews מסוג product בלי product_id → 400',
    await pub('POST', '/reviews', { reviewer_name: 'x', text: 'y', rating: 5, type: 'product' }), 400, 'product_id');

  expectError('GET /orders/by-phone/123 → 400', await pub('GET', '/orders/by-phone/123'), 400, 'מספר טלפון לא תקין');
  const none = await pub('GET', '/orders/by-phone/0500000000');
  check('GET /orders/by-phone/<אין הזמנות> → 200 []', none.status === 200 && Array.isArray(none.body) && none.body.length === 0, none.body);
  check('by-phone מחזיר כותרות RateLimit',
    none.headers.get('ratelimit-limit') === '20' && none.headers.get('ratelimit-remaining') !== null
    && none.headers.get('ratelimit-reset') !== null, [...none.headers.entries()]);
}

// ───────────────────────────── list queries and pagination ─────────────────────────────

/** Flat array without paging parameters, a wrapped list with them, 400 on bad ones. */
async function testListContract() {
  console.log('\n── רשימות: מערך שטוח, דפדוף ופרמטרים פסולים');

  const flat = await pub('GET', '/products');
  check('בלי limit/offset → מערך שטוח', Array.isArray(flat.body), typeof flat.body);

  const paged = await pub('GET', '/products?limit=2');
  check('עם limit → { products, pagination: { total, limit, offset } }',
    paged.status === 200 && Array.isArray(paged.body.products) && paged.body.products.length <= 2
    && paged.body.pagination.limit === 2 && paged.body.pagination.offset === 0
    && typeof paged.body.pagination.total === 'number', paged.body);

  const offsetOnly = await pub('GET', '/products?offset=0');
  check('offset לבדו גם הוא מדפדף', offsetOnly.status === 200 && Array.isArray(offsetOnly.body.products)
    && offsetOnly.body.pagination.limit === offsetOnly.body.pagination.total, offsetOnly.body.pagination);

  const bad = [
    ['/products?limit=0', 'limit חייב להיות מספר שלם בין 1 ל-500'],
    ['/products?limit=501', 'limit חייב להיות מספר שלם בין 1 ל-500'],
    ['/products?offset=-1', 'offset חייב להיות מספר שלם אי-שלילי'],
    ['/products?sort=bogus', 'sort חייב להיות אחד מ'],
    ['/products?order=sideways', 'order חייב להיות asc או desc'],
    ['/products?in_stock=maybe', 'in_stock חייב להיות true או false'],
    ['/products?active=maybe', 'active חייב להיות true, false או all'],
    ['/products?ids=1,x', 'ids מכיל מזהה לא תקין'],
    // Above INT4 no row can match; PostgreSQL would fail with 22003 (a 500), so these are refused first.
    ['/products?ids=99999999999', 'ids מכיל מזהה לא תקין'],
    ['/products?offset=2147483648', 'offset גדול מדי'],
    ['/products/99999999999', 'מזהה לא תקין: "99999999999"'],
    ['/reviews?product_id=99999999999', 'product_id חייב להיות מזהה מוצר תקין'],
    ['/reviews?offset=2147483648', 'offset גדול מדי'],
    ['/pigment-formulas/99999999999', 'מזהה לא תקין: "99999999999"'],
    ['/pigment-formulas?offset=2147483648', 'offset גדול מדי'],
    ['/reviews?limit=0', 'limit חייב להיות מספר שלם בין 1 ל-500'],
    ['/pigment-formulas?limit=abc', 'limit חייב להיות מספר שלם בין 1 ל-500'],
  ];
  for (const [path, text] of bad) {
    expectError(`GET ${path} → 400`, await pub('GET', path), 400, text);
  }

  const adminOrders = await admin('GET', '/orders');
  check('GET /orders (אדמין) → מערך שטוח', adminOrders.status === 200 && Array.isArray(adminOrders.body), adminOrders.status);
  const adminPaged = await admin('GET', '/orders?limit=1');
  check('GET /orders?limit=1 → { orders, pagination }',
    adminPaged.status === 200 && Array.isArray(adminPaged.body.orders) && adminPaged.body.pagination.limit === 1, adminPaged.body);
  expectError('GET /orders?from=nonsense → 400', await admin('GET', '/orders?from=nonsense'), 400, 'אינו תאריך תקין');

  const reviewsAll = await admin('GET', '/reviews/all?limit=1');
  check('GET /reviews/all?limit=1 → { reviews, pagination }',
    reviewsAll.status === 200 && Array.isArray(reviewsAll.body.reviews) && reviewsAll.body.pagination.limit === 1, reviewsAll.body);

  const formulasPaged = await pub('GET', '/pigment-formulas?limit=1');
  check('GET /pigment-formulas?limit=1 → { formulas, pagination }',
    formulasPaged.status === 200 && Array.isArray(formulasPaged.body.formulas), formulasPaged.body);
}

// ───────────────────────────── products ─────────────────────────────

let product = null;

/** Create → read → update → hide → delete, and what each does to the database. */
async function testProductFlow() {
  console.log('\n── מוצרים: מחזור חיים ותופעות במסד');

  const sku = `${MARKER}-PRODUCT`;
  const created = await admin('POST', '/products', { name: `${MARKER} מוצר`, price: 19.9, category: 'tools', sku });
  if (created.body && created.body.id) createdProducts.push(created.body.id);
  product = created.body;

  check('POST /products → 201', created.status === 201, `${created.status} ${errorOf(created)}`);
  check('המוצר מחזיר את השדות שנשמרו',
    product.name === `${MARKER} מוצר` && product.price === 19.9 && product.category === 'tools' && product.sku === sku, product);
  check('ברירות מחדל: active ו-in_stock true', product.active === true && product.in_stock === true, [product.active, product.in_stock]);
  check('שדות מערך מתחילים ריקים', Array.isArray(product.variants) && Array.isArray(product.colors) && Array.isArray(product.sizes), product);

  const read = await pub('GET', `/products/${product.id}`);
  check('GET /products/:id מחזיר את מה שנשמר', read.status === 200 && read.body.id === product.id && read.body.name === product.name, read.body);

  const listed = await pub('GET', `/products?ids=${product.id}`);
  check('GET /products?ids= מסנן לפי מזהה', listed.status === 200 && listed.body.length === 1 && listed.body[0].id === product.id, listed.body);

  // Partial update keeps every field that was not sent.
  const updated = await admin('PUT', `/products/${product.id}`, { price: 25 });
  check('PUT /products/:id → 200 ומעדכן רק מה שנשלח',
    updated.status === 200 && updated.body.price === 25 && updated.body.name === product.name && updated.body.sku === sku, updated.body);
  const after = await pub('GET', `/products/${product.id}`);
  check('העדכון נשמר במסד', after.body.price === 25, after.body.price);

  // Variants: the product price becomes the cheapest variant.
  const withVariants = await admin('PUT', `/products/${product.id}`, { variants: [{ label: 'גדול', price: 90 }, { label: 'קטן', price: 40 }] });
  check('מחיר מוצר עם גרסאות הוא הזולה שבהן', withVariants.status === 200 && withVariants.body.price === 40, withVariants.body.price);
  await admin('PUT', `/products/${product.id}`, { variants: [], price: 25 });

  // Hidden product: absent for the public (same 404 as a missing one), present for the admin.
  await admin('PUT', `/products/${product.id}`, { active: false });
  expectError('מוצר מוסתר → 404 ללקוח', await pub('GET', `/products/${product.id}`), 404, `מוצר ${product.id} לא נמצא`);
  const adminSees = await admin('GET', `/products/${product.id}`);
  check('מוצר מוסתר גלוי לאדמין', adminSees.status === 200 && adminSees.body.active === false, adminSees.status);

  const publicList = await pub('GET', `/products?ids=${product.id}`);
  check('מוצר מוסתר לא ברשימה הציבורית', publicList.status === 200 && publicList.body.length === 0, publicList.body);
  const publicAll = await pub('GET', `/products?ids=${product.id}&active=all`);
  check('?active=all מהציבור מתעלם מהבקשה', publicAll.status === 200 && publicAll.body.length === 0, publicAll.body);
  const adminAll = await admin('GET', `/products?ids=${product.id}&active=all`);
  check('?active=all לאדמין כולל מוצר מוסתר', adminAll.status === 200 && adminAll.body.length === 1, adminAll.body);
  const adminDefault = await admin('GET', `/products?ids=${product.id}`);
  check('אדמין בלי ?active רואה רק גלויים', adminDefault.status === 200 && adminDefault.body.length === 0, adminDefault.body);

  await admin('PUT', `/products/${product.id}`, { active: true });

  const dup = await admin('POST', '/products', { name: `${MARKER} כפול`, price: 1, sku });
  if (dup.body && dup.body.id) createdProducts.push(dup.body.id);
  // KNOWN: pinned as it is today; whether sku is unique is decided by the schema, not asserted here.
  check('יצירה עם sku קיים מחזירה תשובה עם צורת שגיאה או 201', [201, 409].includes(dup.status), dup.status);
}

/** A product that is ordered cannot be deleted (409); one without orders can. */
async function testProductDelete() {
  console.log('\n── מוצרים: מחיקה');

  const doomed = await admin('POST', '/products', { name: `${MARKER} למחיקה`, price: 5, category: 'tools' });
  createdProducts.push(doomed.body.id);

  const review = await pub('POST', '/reviews', { reviewer_name: MARKER, text: 'ביקורת למוצר', rating: 4, type: 'product', product_id: doomed.body.id });
  if (review.body && review.body.id) createdReviews.push(review.body.id);
  check('ביקורת על המוצר נוצרה', review.status === 201, review.status);

  const del = await admin('DELETE', `/products/${doomed.body.id}`);
  check('DELETE /products/:id → 200 { message, product, deleted: { reviews, files } }',
    del.status === 200 && del.body.message === 'נמחק' && del.body.product.id === doomed.body.id
    && del.body.deleted.reviews === 1 && Array.isArray(del.body.deleted.files), del.body);
  expectError('המוצר נעלם מהמסד', await admin('GET', `/products/${doomed.body.id}`), 404, 'לא נמצא');
  expectError('הביקורת שלו נמחקה איתו', await admin('GET', `/reviews/${review.body.id}`), 404, 'לא נמצאה');

  expectError('מחיקה שנייה → 404', await admin('DELETE', `/products/${doomed.body.id}`), 404, `מוצר ${doomed.body.id} לא נמצא`);
}

// ───────────────────────────── orders ─────────────────────────────

const orderBody = (extra = {}) => ({
  customer_name: `${MARKER} לקוח`,
  customer_phone: '050-777-0001',
  delivery_method: 'delivery',
  delivery_address: 'בר כוכבא 52, פתח תקווה',
  items: [{ id: product.id, name: product.name, price: 25, quantity: 2 }],
  ...extra,
});

/** All orders of this suite currently in the database. */
async function ourOrders() {
  const res = await admin('GET', '/orders');
  return res.body.filter((o) => o.customer_name === `${MARKER} לקוח`);
}

/** Rejected orders leave nothing behind. */
async function testOrderRejections() {
  console.log('\n── הזמנות: דחיות שאינן כותבות כלום');

  const before = (await ourOrders()).length;

  const stale = await pub('POST', '/orders', orderBody({ items: [{ id: product.id, name: product.name, price: 1, quantity: 1 }] }));
  check('מחיר שהשתנה → 409 עם details.prices', stale.status === 409 && Array.isArray(stale.body.details?.prices)
    && stale.body.details.prices[0].id === product.id && stale.body.details.prices[0].price === 25 && hasErrorShape(stale), stale.body);

  expectError('מוצר שאינו בקטלוג → 400', await pub('POST', '/orders',
    orderBody({ items: [{ id: MISSING_ID, name: 'ghost', price: 1, quantity: 1 }] })), 400, 'כבר אינו בקטלוג');
  expectError('פריט בלי מזהה → 400', await pub('POST', '/orders',
    orderBody({ items: [{ name: 'ghost', price: 1, quantity: 1 }] })), 400, 'כבר אינו בקטלוג');
  // An id above INT4 used to reach `ANY($1::int[])` and fail with 22003, a 500.
  expectError('מזהה פריט מעל INT4 → 400 ולא 500', await pub('POST', '/orders',
    orderBody({ items: [{ id: 99999999999, name: 'ghost', price: 1, quantity: 1 }] })), 400, 'כבר אינו בקטלוג');
  // A product id that fits INT4 but does not exist: the database refuses the review (foreign key,
  // 23503). The status stays 409; the text is this API's and never the database's.
  const noProduct = await pub('POST', '/reviews',
    { reviewer_name: 'Dana', text: 'x', rating: 5, type: 'product', product_id: MISSING_ID });
  expectError('חוות דעת על מוצר שאינו קיים → 409', noProduct, 409, 'הפעולה מפרה קישור לרשומה אחרת');
  check('חוות דעת על מוצר שאינו קיים: בלי טקסט PostgreSQL',
    hasErrorShape(noProduct) && !/violates|constraint|foreign key|reviews|fkey|insert or update/i.test(errorOf(noProduct)), errorOf(noProduct));
  expectError('חוות דעת על מזהה מוצר מעל INT4 → 400', await pub('POST', '/reviews',
    { reviewer_name: 'Dana', text: 'x', rating: 5, type: 'product', product_id: 99999999999 }), 400, 'product_id חייב להיות מזהה מוצר תקין');
  expectError('גרסה שאינה קיימת → 400', await pub('POST', '/orders',
    orderBody({ items: [{ id: product.id, name: product.name, price: 25, quantity: 1, selectedVariant: 'nope' }] })), 400, 'אינה קיימת עבור');
  expectError('בלי פריטים → 400', await pub('POST', '/orders', orderBody({ items: [] })), 400, 'לפחות פריט אחד');
  expectError('כמות אפס → 400', await pub('POST', '/orders',
    orderBody({ items: [{ id: product.id, name: 'x', price: 25, quantity: 0 }] })), 400, 'quantity חייב להיות מספר שלם חיובי');
  expectError('טלפון לא תקין → 400', await pub('POST', '/orders', orderBody({ customer_phone: 'abc' })), 400, 'מספר טלפון לא תקין');
  expectError('אימייל לא תקין → 400', await pub('POST', '/orders', orderBody({ customer_email: 'nope' })), 400, 'כתובת האימייל אינה תקינה');
  expectError('אופן קבלה לא מוכר → 400', await pub('POST', '/orders', orderBody({ delivery_method: 'drone' })), 400, 'delivery_method חייב להיות');
  // KNOWN: the same rule has two messages — create says 'חסרה כתובת למשלוח', update says 'משלוח דורש כתובת'.
  expectError('משלוח בלי כתובת → 400', await pub('POST', '/orders', orderBody({ delivery_address: '' })), 400, 'חסרה כתובת למשלוח');
  expectError('משלוח מחוץ לאזור → 400', await pub('POST', '/orders', orderBody({ delivery_address: 'הרצל 1, חיפה' })), 400, 'מצטערים');

  // A hidden product cannot be ordered, even with the right price.
  await admin('PUT', `/products/${product.id}`, { active: false });
  expectError('מוצר מוסתר → 400', await pub('POST', '/orders', orderBody()), 400, 'אינו זמין כרגע');
  await admin('PUT', `/products/${product.id}`, { active: true });

  // A product without a price cannot be ordered.
  const free = await admin('POST', '/products', { name: `${MARKER} בלי מחיר`, price: 0, category: 'tools' });
  createdProducts.push(free.body.id);
  expectError('מוצר בלי מחיר → 400', await pub('POST', '/orders',
    orderBody({ items: [{ id: free.body.id, name: 'x', price: 0, quantity: 1 }] })), 400, 'המחיר שלו עוד לא עודכן');

  const after = (await ourOrders()).length;
  check('אף אחת מהדחיות לא נכתבה למסד', before === after, { before, after });
}

let order = null;

/** Create, read, edit, status, picking, lookup and delete of one order. */
async function testOrderFlow() {
  console.log('\n── הזמנות: מחזור חיים');

  const created = await pub('POST', '/orders', orderBody({ customer_email: 'contract@example.com', notes: 'הערה', subtotal: 1, total: 1 }));
  if (created.body && created.body.id) createdOrders.push(created.body.id);
  order = created.body;

  check('POST /orders → 201', created.status === 201, `${created.status} ${errorOf(created)}`);
  check('הסכומים מחושבים בשרת (50 + 20 = 70)', order.subtotal === 50 && order.delivery_fee === 20 && order.total === 70, order);
  check('סטטוס התחלתי new', order.status === 'new', order.status);
  check('התשובה כוללת emails { store, customer } בוליאניים',
    typeof order.emails?.store === 'boolean' && typeof order.emails?.customer === 'boolean', order.emails);
  check('שורות ההזמנה נושאות את מחיר וקטלוג השרת',
    order.items.length === 1 && order.items[0].price === 25 && order.items[0].quantity === 2 && order.items[0].id === product.id, order.items);

  const stored = await admin('GET', `/orders/${order.id}`);
  check('GET /orders/:id (אדמין) תואם למה שנשמר',
    stored.status === 200 && stored.body.total === 70 && stored.body.customer_phone && stored.body.notes === 'הערה', stored.body);
  check('picked_items מתחיל ריק', Array.isArray(stored.body.picked_items) && stored.body.picked_items.length === 0, stored.body.picked_items);

  const inList = (await ourOrders()).some((o) => o.id === order.id);
  check('ההזמנה מופיעה ב-GET /orders', inList, null);

  // Public lookup by phone: the customer sees the order, but not the picking state.
  const lookup = await pub('GET', '/orders/by-phone/0507770001');
  check('GET /orders/by-phone/:phone מוצא את ההזמנה',
    lookup.status === 200 && lookup.body.some((o) => o.id === order.id), lookup.body);
  check('by-phone אינו חושף picked_items', lookup.body.every((o) => !('picked_items' in o)), lookup.body.map((o) => Object.keys(o)));
  const formatted = await pub('GET', '/orders/by-phone/050-777-0001');
  check('by-phone מנרמל מקפים', formatted.status === 200 && formatted.body.some((o) => o.id === order.id), formatted.status);

  // Edit.
  const edited = await admin('PUT', `/orders/${order.id}`, { notes: 'עודכן' });
  check('PUT /orders/:id → 200 ומעדכן רק מה שנשלח',
    edited.status === 200 && edited.body.notes === 'עודכן' && edited.body.total === 70 && edited.body.status === 'new', edited.body);
  expectError('PUT: משלוח בלי כתובת על המצב הממוזג → 400',
    await admin('PUT', `/orders/${order.id}`, { delivery_address: '' }), 400, 'משלוח דורש כתובת');
  expectError('PUT: סטטוס שאינו מתאים לאופן הקבלה → 400',
    await admin('PUT', `/orders/${order.id}`, { status: 'ready_for_pickup' }), 400, 'מתאים להזמנת איסוף עצמי בלבד');

  // Status: delivery order may ship, may not be "ready for pickup".
  expectError('PUT status ready_for_pickup על משלוח → 400',
    await admin('PUT', `/orders/${order.id}/status`, { status: 'ready_for_pickup' }), 400, 'איסוף עצמי בלבד');
  const shipped = await admin('PUT', `/orders/${order.id}/status`, { status: 'shipped' });
  check('PUT status shipped → 200 עם email_sent בוליאני',
    shipped.status === 200 && shipped.body.status === 'shipped' && typeof shipped.body.email_sent === 'boolean', shipped.body);
  const sameAgain = await admin('PUT', `/orders/${order.id}/status`, { status: 'shipped' });
  check('אותו סטטוס שוב → 200 בלי מייל', sameAgain.status === 200 && sameAgain.body.email_sent === false, sameAgain.body);
  const persisted = await admin('GET', `/orders/${order.id}`);
  check('הסטטוס נשמר במסד', persisted.body.status === 'shipped', persisted.body.status);

  // Picking list.
  const picked = await admin('PUT', `/orders/${order.id}/items/0/picked`, { picked: true });
  check('PUT picked true → 200 עם picked_items [0]',
    picked.status === 200 && JSON.stringify(picked.body.picked_items) === '[0]', picked.body.picked_items);
  const pickedAgain = await admin('PUT', `/orders/${order.id}/items/0/picked`, { picked: true });
  check('סימון חוזר אינו מכפיל', JSON.stringify(pickedAgain.body.picked_items) === '[0]', pickedAgain.body.picked_items);
  expectError('שורה שאינה קיימת → 404',
    await admin('PUT', `/orders/${order.id}/items/99/picked`, { picked: true }), 404, `בהזמנה ${order.id} אין שורה 99`);
  const unpicked = await admin('PUT', `/orders/${order.id}/items/0/picked`, { picked: false });
  check('PUT picked false מבטל את הסימון', JSON.stringify(unpicked.body.picked_items) === '[]', unpicked.body.picked_items);
  const statusKept = await admin('GET', `/orders/${order.id}`);
  check('ליקוט אינו משנה סטטוס', statusKept.body.status === 'shipped', statusKept.body.status);

  // Stats count the order.
  const stats = await admin('GET', '/orders/stats');
  check('/orders/stats סופר את ההזמנות', stats.body.totals.orders >= 1 && stats.body.byStatus.some((r) => r.status === 'shipped'), stats.body);

  // The product is now ordered: it cannot be deleted, and the 409 says why.
  const blocked = await admin('DELETE', `/products/${product.id}`);
  check('מחיקת מוצר עם הזמנות → 409 עם details',
    blocked.status === 409 && blocked.body.details?.reason === 'has_orders' && blocked.body.details.orders >= 1
    && blocked.body.details.active === true && hasErrorShape(blocked), blocked.body);
  const stillThere = await pub('GET', `/products/${product.id}`);
  check('המוצר נשאר אחרי ה-409', stillThere.status === 200, stillThere.status);

  // Delete.
  const del = await admin('DELETE', `/orders/${order.id}`);
  check('DELETE /orders/:id → 200 { message, order }', del.status === 200 && del.body.message === 'נמחק' && del.body.order.id === order.id, del.body);
  expectError('ההזמנה נעלמה → 404', await admin('GET', `/orders/${order.id}`), 404, `הזמנה ${order.id} לא נמצאה`);
  expectError('מחיקה שנייה → 404', await admin('DELETE', `/orders/${order.id}`), 404, `הזמנה ${order.id} לא נמצאה`);
  createdOrders.length = 0;
}

/** Pickup orders: no delivery fee, no address needed, ready_for_pickup allowed, shipped not. */
async function testPickupOrder() {
  console.log('\n── הזמנות: איסוף עצמי');

  const created = await pub('POST', '/orders', orderBody({ delivery_method: 'pickup', delivery_address: undefined }));
  if (created.body && created.body.id) createdOrders.push(created.body.id);
  check('איסוף בלי כתובת → 201, בלי דמי משלוח', created.status === 201 && created.body.delivery_fee === 0 && created.body.total === 50, created.body);

  expectError('shipped על איסוף → 400', await admin('PUT', `/orders/${created.body.id}/status`, { status: 'shipped' }), 400, 'משלוח בלבד');
  const ready = await admin('PUT', `/orders/${created.body.id}/status`, { status: 'ready_for_pickup' });
  check('ready_for_pickup על איסוף → 200', ready.status === 200 && ready.body.status === 'ready_for_pickup', ready.body);

  await admin('DELETE', `/orders/${created.body.id}`);
  createdOrders.length = 0;
}

// ───────────────────────────── reviews ─────────────────────────────

/** A new review waits for approval; the public sees approved ones only. */
async function testReviewFlow() {
  console.log('\n── חוות דעת: מודרציה');

  const created = await pub('POST', '/reviews', { reviewer_name: MARKER, text: 'חוות דעת לבדיקה', rating: 5, type: 'store', approved: true });
  if (created.body && created.body.id) createdReviews.push(created.body.id);
  const id = created.body.id;

  check('POST /reviews → 201', created.status === 201, `${created.status} ${errorOf(created)}`);
  check('חוות דעת חדשה ממתינה לאישור גם אם נשלח approved: true', created.body.approved === false, created.body.approved);
  check('החוות דעת שומרת את השדות', created.body.reviewer_name === MARKER && created.body.rating === 5 && created.body.type === 'store', created.body);

  const hidden = await pub('GET', '/reviews?approved=false');
  check('?approved=false מהציבור אינו חושף ממתינות', hidden.status === 200 && !hidden.body.some((r) => r.id === id), hidden.status);
  const publicBefore = await pub('GET', '/reviews');
  check('הרשימה הציבורית לא כוללת ממתינה', !publicBefore.body.some((r) => r.id === id), null);
  const adminList = await admin('GET', '/reviews/all');
  check('/reviews/all כולל ממתינה', adminList.body.some((r) => r.id === id), null);

  const approved = await admin('PUT', `/reviews/${id}/approve`, { approved: true });
  check('PUT approve → 200 approved true', approved.status === 200 && approved.body.approved === true, approved.body);
  const publicAfter = await pub('GET', '/reviews');
  check('אחרי אישור — ברשימה הציבורית', publicAfter.body.some((r) => r.id === id), null);

  const edited = await admin('PUT', `/reviews/${id}`, { text: 'עודכן', rating: 3 });
  check('PUT /reviews/:id → 200 ומעדכן רק מה שנשלח',
    edited.status === 200 && edited.body.text === 'עודכן' && edited.body.rating === 3 && edited.body.reviewer_name === MARKER, edited.body);
  expectError('דירוג מחוץ לטווח → 400', await admin('PUT', `/reviews/${id}`, { rating: 6 }), 400, 'הדירוג חייב להיות');
  expectError('approved שאינו בוליאני → 400', await admin('PUT', `/reviews/${id}/approve`, { approved: 'maybe' }), 400, 'approved');

  await admin('PUT', `/reviews/${id}/approve`, { approved: false });
  const publicHidden = await pub('GET', '/reviews');
  check('ביטול אישור מסתיר מהציבור', !publicHidden.body.some((r) => r.id === id), null);

  const del = await admin('DELETE', `/reviews/${id}`);
  check('DELETE /reviews/:id → 200 { message, review }', del.status === 200 && del.body.message === 'נמחק' && del.body.review.id === id, del.body);
  expectError('חוות הדעת נעלמה → 404', await admin('GET', `/reviews/${id}`), 404, 'לא נמצאה');
}

// ───────────────────────────── pigment formulas ─────────────────────────────

/** Create, lookup by code and by id, update with the ordering rule, conflict and delete. */
async function testPigmentFlow() {
  console.log('\n── גווני פיגמנט');

  const code = `contract_test_${Date.now()}`;
  const body = { color_code: code.toUpperCase(), color_name_he: 'גוון בדיקה', hex: '#aabbcc', ml_per_liter_light: 5, ml_per_liter_medium: 10, ml_per_liter_dark: 20 };

  const created = await admin('POST', '/pigment-formulas', body);
  if (created.body && created.body.id) createdFormulas.push(created.body.id);
  const formula = created.body;
  check('POST /pigment-formulas → 201', created.status === 201, `${created.status} ${errorOf(created)}`);
  check('הקוד מנורמל לאותיות קטנות וה-hex לגדולות', formula.color_code === code && formula.hex === '#AABBCC', formula);

  const byCode = await pub('GET', `/pigment-formulas/code/${code.toUpperCase()}`);
  check('GET /code/:code מוצא (בלי תלות באותיות)', byCode.status === 200 && byCode.body.id === formula.id, byCode.body);
  const byId = await pub('GET', `/pigment-formulas/${formula.id}`);
  check('GET /:id מחזיר אותו גוון', byId.status === 200 && byId.body.color_code === code, byId.body);

  const dup = await admin('POST', '/pigment-formulas', body);
  if (dup.body && dup.body.id) createdFormulas.push(dup.body.id);
  // errorHandler maps 23505 to 'הערך כבר קיים במערכת' at every status, so a 4xx never carries the
  // raw PostgreSQL text (which names the constraint).
  check('קוד כפול → 409 בצורת { error }', dup.status === 409 && hasErrorShape(dup), `${dup.status} ${errorOf(dup)}`);
  expectError('קוד כפול: ההודעה של ה-API', dup, 409, 'הערך כבר קיים במערכת');
  check('קוד כפול: בלי טקסט PostgreSQL',
    !/duplicate key|unique constraint|violates|pigment_formulas/i.test(errorOf(dup)), errorOf(dup));

  expectError('כמויות שאינן עולות → 400', await admin('POST', '/pigment-formulas', { ...body, color_code: `${code}_x`, ml_per_liter_medium: 5 }), 400, 'חייבת לעלות');
  expectError('hex לא תקין → 400', await admin('POST', '/pigment-formulas', { ...body, color_code: `${code}_y`, hex: 'red' }), 400, 'hex חייב להיות בפורמט');

  const updated = await admin('PUT', `/pigment-formulas/${formula.id}`, { ml_per_liter_dark: 30 });
  check('PUT → 200 ומעדכן רק מה שנשלח', updated.status === 200 && updated.body.ml_per_liter_dark === 30 && updated.body.ml_per_liter_medium === 10, updated.body);
  expectError('PUT: הסדר נבדק על המצב הממוזג → 400', await admin('PUT', `/pigment-formulas/${formula.id}`, { ml_per_liter_light: 50 }), 400, 'חייבת לעלות');
  expectError('PUT בלי שדות → 400', await admin('PUT', `/pigment-formulas/${formula.id}`, {}), 400, 'לא נשלח אף שדה לעדכון');

  const del = await admin('DELETE', `/pigment-formulas/${formula.id}`);
  check('DELETE → 200 { message, formula }', del.status === 200 && del.body.message === 'נמחק' && del.body.formula.id === formula.id, del.body);
  expectError('הגוון נעלם → 404', await pub('GET', `/pigment-formulas/${formula.id}`), 404, 'לא נמצא');
}

// ───────────────────────────── headers and malformed requests ─────────────────────────────

/** Headers every API response carries, and the parser's own errors. */
async function testHeadersAndParsing() {
  console.log('\n── כותרות ופענוח גוף הבקשה');

  const res = await pub('GET', '/products?limit=1');
  const h = (name) => res.headers.get(name);
  check('X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff', h('x-content-type-options'));
  check('X-Frame-Options: DENY', h('x-frame-options') === 'DENY', h('x-frame-options'));
  check('Referrer-Policy', h('referrer-policy') === 'strict-origin-when-cross-origin', h('referrer-policy'));
  check('Permissions-Policy חוסם מצלמה, מיקרופון ומיקום', /camera=\(\)/.test(h('permissions-policy') || '')
    && /microphone=\(\)/.test(h('permissions-policy') || '') && /geolocation=\(\)/.test(h('permissions-policy') || ''), h('permissions-policy'));
  check('אין X-Powered-By', h('x-powered-by') === null, h('x-powered-by'));
  check('בפיתוח אין HSTS', h('strict-transport-security') === null, h('strict-transport-security'));
  check('Content-Type: application/json; charset=utf-8', /^application\/json;\s*charset=utf-8$/i.test(h('content-type') || ''), h('content-type'));

  const errorRes = await pub('GET', '/products/0');
  check('כותרות האבטחה גם על תשובות שגיאה', errorRes.headers.get('x-content-type-options') === 'nosniff', null);

  const cors = await call('GET', '/products?limit=1', { headers: { Origin: 'http://example.test' } });
  check('בפיתוח CORS משקף את ה-Origin', cors.headers.get('access-control-allow-origin') === 'http://example.test', cors.headers.get('access-control-allow-origin'));

  const preflight = await fetch(`${BASE}/orders`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://example.test', 'Access-Control-Request-Method': 'POST' },
  });
  check('OPTIONS preflight → 204', preflight.status === 204, preflight.status);

  // Malformed JSON and oversized bodies are raised by the JSON parser, and the error handler
  // answers them in Hebrew: the parser's own English text (which can quote the body) is not sent.
  const malformed = await call('POST', '/orders', { raw: '{"customer_name":', headers: { 'Content-Type': 'application/json' } });
  check('JSON שבור → 400 בצורת { error }', malformed.status === 400 && hasErrorShape(malformed), `${malformed.status} ${errorOf(malformed)}`);
  expectError('JSON שבור: הודעה בעברית', malformed, 400, 'גוף הבקשה אינו JSON תקין');
  check('JSON שבור: בלי טקסט המנתח ובלי ציטוט הגוף',
    !/Unexpected|JSON|position|customer_name/.test(errorOf(malformed).replace('JSON תקין', '')), errorOf(malformed));

  const huge = await call('POST', '/orders', { body: { notes: 'x'.repeat(250 * 1024) } });
  check('גוף מעל 200KB → 413', huge.status === 413 && hasErrorShape(huge), `${huge.status} ${errorOf(huge)}`);
  expectError('גוף מעל 200KB: הודעה בעברית', huge, 413, 'גוף הבקשה גדול מדי');
  check('גוף מעל 200KB: בלי טקסט המנתח', !/entity|request/i.test(errorOf(huge)), errorOf(huge));

  const encoding = await call('POST', '/orders', { raw: '{}', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'x-unknown' } });
  expectError('קידוד תוכן לא נתמך → 415 בעברית', encoding, 415, 'קידוד הבקשה אינו נתמך');
  check('קידוד תוכן לא נתמך: בצורת { error }', hasErrorShape(encoding), encoding.body);

  const charset = await call('POST', '/orders', { raw: '{}', headers: { 'Content-Type': 'application/json; charset=latin1' } });
  expectError('charset לא נתמך → 415 בעברית', charset, 415, 'קידוד הבקשה אינו נתמך');

  // A malformed path parameter is an error the router raises, with an English message of its own.
  const badPath = await pub('GET', '/products/%E0%A4%A');
  check('אחוז-קידוד שבור בנתיב → 400 בעברית, בלי טקסט הנתב',
    badPath.status === 400 && hasErrorShape(badPath) && !/decode|param/i.test(errorOf(badPath)), `${badPath.status} ${errorOf(badPath)}`);

  const wrongType = await call('POST', '/orders', { raw: 'customer_name=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  check('גוף שאינו JSON נקרא כריק → 400 ולא 500', wrongType.status === 400 && hasErrorShape(wrongType), `${wrongType.status} ${errorOf(wrongType)}`);
}

/** The client build, when it exists: index.html is never cached, and /api never falls back to it. */
async function testClientBoundary() {
  console.log('\n── גבול ה-API מול הקליינט');

  const origin = BASE.replace(/\/api$/, '');
  const index = await fetch(`${origin}/`);
  const html = await index.text();
  if (index.status === 200 && html.includes('<div id="root">')) {
    check('index.html לא נשמר במטמון', /no-store/.test(index.headers.get('cache-control') || ''), index.headers.get('cache-control'));
    const spa = await fetch(`${origin}/some/client/route`);
    check('נתיב קליינט מקבל index.html', spa.status === 200, spa.status);
  } else {
    console.log('  – אין build של הקליינט; בדיקות ההגשה דולגו (smoke-static מדווחת עליהן)');
  }

  const apiMiss = await fetch(`${origin}/api/not-a-route`);
  const body = await apiMiss.json().catch(() => null);
  check('/api/<לא קיים> הוא JSON 404 ולא index.html', apiMiss.status === 404 && body && body.error === 'הנתיב לא נמצא', apiMiss.status);
}

// ───────────────────────────── cleanup and main ─────────────────────────────

/** Deletes every record this suite created, in dependency order. */
async function cleanup() {
  if (!cookie) return;
  for (const id of createdOrders.splice(0)) await admin('DELETE', `/orders/${id}`).catch(() => {});
  for (const id of createdReviews.splice(0)) await admin('DELETE', `/reviews/${id}`).catch(() => {});
  for (const id of createdFormulas.splice(0)) await admin('DELETE', `/pigment-formulas/${id}`).catch(() => {});
  for (const id of createdProducts.splice(0)) await admin('DELETE', `/products/${id}`).catch(() => {});

  // Anything this suite left behind by marker (for example after a crash between steps).
  const orders = await admin('GET', '/orders').catch(() => null);
  for (const o of (orders && Array.isArray(orders.body) ? orders.body : [])) {
    if (String(o.customer_name).startsWith(MARKER)) await admin('DELETE', `/orders/${o.id}`).catch(() => {});
  }
}

/** Confirms the cleanup left nothing of ours in the database. */
async function testCleanup() {
  console.log('\n── ניקוי');
  await cleanup();

  const orders = (await admin('GET', '/orders')).body.filter((o) => String(o.customer_name).startsWith(MARKER));
  check('לא נשארו הזמנות של הבדיקה', orders.length === 0, orders.map((o) => o.id));
  const products = (await admin('GET', '/products?active=all')).body.filter((p) => String(p.name).startsWith(MARKER));
  check('לא נשארו מוצרים של הבדיקה', products.length === 0, products.map((p) => p.id));
  const reviews = (await admin('GET', '/reviews/all')).body.filter((r) => r.reviewer_name === MARKER);
  check('לא נשארו חוות דעת של הבדיקה', reviews.length === 0, reviews.map((r) => r.id));
}

/** Runs the sections in order. */
async function main() {
  cookie = await login(BASE.replace(/\/api$/, ''));

  await testRouting();
  await testUploadsStatic();
  await testAdminRoutesRequireLogin();
  await testAdminProbes();
  await testUploadRejections();
  await testAuthContract();
  await testPublicRoutes();
  await testListContract();
  await testProductFlow();
  await testOrderRejections();
  await testOrderFlow();
  await testPickupOrder();
  await testProductDelete();
  await testReviewFlow();
  await testPigmentFlow();
  await testHeadersAndParsing();
  await testClientBoundary();
  await testCleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

runHttpSuite(async (baseUrl) => {
  BASE = `${baseUrl}/api`;
  await main();
}, cleanup);
