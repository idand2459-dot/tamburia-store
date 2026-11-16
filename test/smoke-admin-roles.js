/**
 * The two admin roles on a real demo server (plan 006, Phase 3): table-driven, one row per protected
 * endpoint (test/lib/adminRoutes.js, kept honest by unit-admin-routes-covered).
 *
 *   no cookie  → 401 on every row;
 *   viewer     → the seven allowlisted reads are 200 (GET and HEAD), every other row is 403 and no table
 *                changes (compared by content before and after);
 *   owner      → no row is 401 or 403, except the upload route, which is switched off in demo mode for
 *                everyone (403 demo_disabled).
 * Plus the exposure proof (no request_id, request_hash or secret in a viewer response; customer values
 * only from the fictional set) and the escalation attempts (forged, legacy and foreign tokens, a role in
 * the body, query or headers, method override, guessed passwords).
 */
const crypto = require('crypto');
const { runDemoSuite, spawnServer } = require('./lib/demoServer');
const {
  apiClient, adminCookie, loginOwner, loginViewer, demoOrderBody, invariantViolations, maxId, contentFingerprint,
  COOKIE_NAME,
} = require('./lib/demoClient');
const { ROUTES } = require('./lib/adminRoutes');

let passed = 0;
let failed = 0;

/** רושם תוצאה של בדיקה בודדת. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

const SECRET = 'a'.repeat(64); // the SESSION_SECRET test/lib/demoServer.js gives the child
const b64 = (value) => Buffer.from(value).toString('base64url');

/** Signs a token payload with `secret` the way api/auth/auth.service does. */
function signed(payload, secret = SECRET) {
  const part = b64(JSON.stringify(payload));
  return `${part}.${b64(crypto.createHmac('sha256', secret).update(part).digest())}`;
}

const now = () => Math.floor(Date.now() / 1000);

/** The key the upload route is reported under: it is off for everyone in demo mode. */
const UPLOAD = 'POST /api/upload-multiple';

runDemoSuite(async ({ baseUrl, db, target, databaseId }) => {
  const call = apiClient(baseUrl);
  const baseline = {
    order: await maxId(db, 'orders'), review: await maxId(db, 'reviews'), product: await maxId(db, 'products'),
  };
  const created = { pigmentCodes: ['viewer_test', 'viewer_fixture'] };

  try {
    const owner = await loginOwner(call);
    const viewer = await loginViewer(call);

    console.log('\n── כניסת צופה');
    {
      const res = await call('POST', '/api/auth/demo-login');
      const setCookie = res.setCookie.find((c) => c.startsWith(`${COOKIE_NAME}=`)) || '';
      check('demo-login → 200 עם תפקיד viewer ובלי סיסמה', res.status === 200 && res.body.role === 'viewer' && res.body.expiresInHours === 4, res.body);
      check('העוגייה HttpOnly, SameSite=Strict, Secure ותוקף ארבע שעות', /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie)
        && /Secure/i.test(setCookie) && /Max-Age=14400/i.test(setCookie), setCookie.replace(/=[^;]+/, '=<token>'));
      check('האסימון אינו בגוף התשובה', !JSON.stringify(res.body).includes('.'), res.body);
      const me = await call('GET', '/api/auth/me', { cookie: viewer });
      check('GET /api/auth/me של צופה: role=viewer', me.status === 200 && me.body.role === 'viewer', me.body);
      const meOwner = await call('GET', '/api/auth/me', { cookie: owner });
      check('GET /api/auth/me של בעלים: role=owner', meOwner.status === 200 && meOwner.body.role === 'owner', meOwner.body);
      const login = await call('POST', '/api/auth/login', { body: { password: 'wrong-wrong-wrong-wrong-0' } });
      check('התחברות בעלים עם סיסמה שגויה → 401 וללא עוגייה', login.status === 401 && adminCookie(login) === null, login.status);
    }

    // ── fixtures the rows operate on
    const productRes = await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר בדיקת תפקידים', category: 'tools', price: 10, sku: 'TEST-DEMO-ROLES' } });
    const product = productRes.body;
    check('מוצר בדיקה נוצר', productRes.status === 201, productRes.status);
    const orderRes = await call('POST', '/api/orders', { body: demoOrderBody(product) });
    check('הזמנת בדיקה נוצרה', orderRes.status === 201, orderRes.body);
    const orderId = orderRes.body.id;
    const { rows: [review] } = await db.query(
      "INSERT INTO reviews (reviewer_name, rating, text, type, approved) VALUES ('לקוח לדוגמה', 4, 'חוות דעת לבדיקה', 'store', false) RETURNING id"
    );
    await call('PUT', '/api/settings/stats-counting-from', { cookie: owner, body: { value: new Date().toISOString() } });
    // the pigment rows operated on are this suite's own: the shop's 20 shades are never deleted
    const pigment = await call('POST', '/api/pigment-formulas', { cookie: owner, body: { color_code: 'viewer_fixture', color_name_he: 'גוון בדיקה', hex: '#abcdef', ml_per_liter_light: 10, ml_per_liter_medium: 20, ml_per_liter_dark: 30 } });
    check('גוון בדיקה נוצר', pigment.status === 201, pigment.body);
    const pigmentId = pigment.body.id;

    /** Fills :id, :line and :key of a route template. */
    const urlOf = (row, ids = {}) => {
      const group = row.path.split('/')[2];
      const id = ids[group] ?? { orders: orderId, products: product.id, 'pigment-formulas': pigmentId, reviews: review.id }[group];
      return row.path.replace(':id', id).replace(':line', '0').replace(':key', 'stats-counting-from');
    };
    const keyOf = (row) => `${row.method} ${row.path}`;

    // ── no cookie
    console.log('\n── בלי התחברות');
    for (const row of ROUTES) {
      const res = await call(row.method, urlOf(row), { body: row.body });
      const expected = keyOf(row) === UPLOAD ? 403 : 401;
      check(`${keyOf(row)} → ${expected}`, res.status === expected, res.status);
    }

    // ── viewer
    console.log('\n── צופה: קריאות מותרות');
    const beforeReads = await contentFingerprint(db);
    for (const row of ROUTES.filter((item) => item.access === 'read')) {
      const res = await call(row.method, urlOf(row), { cookie: viewer });
      check(`${keyOf(row)} → 200`, res.status === 200, res.status);
      const head = await call('HEAD', urlOf(row), { cookie: viewer });
      check(`HEAD ${urlOf(row)} → 200`, head.status === 200, head.status);
    }
    check('אחרי כל הקריאות (GET ו-HEAD) תוכן כל הטבלאות זהה', (await contentFingerprint(db)) === beforeReads);

    console.log('\n── צופה: כל השאר 403, ושום דבר לא משתנה');
    const beforeWrites = await contentFingerprint(db);
    for (const row of ROUTES.filter((item) => item.access === 'owner')) {
      const res = await call(row.method, urlOf(row), { cookie: viewer, body: row.body });
      const reason = res.body.details?.reason;
      const expectedReason = keyOf(row) === UPLOAD ? 'demo_disabled' : 'demo_read_only';
      check(`${keyOf(row)} → 403 (${expectedReason})`, res.status === 403 && reason === expectedReason, { status: res.status, reason });
    }
    check('אחרי כל הניסיונות תוכן כל הטבלאות זהה', (await contentFingerprint(db)) === beforeWrites);

    // ── exposure
    console.log('\n── חשיפה');
    {
      const responses = [
        await call('GET', '/api/orders', { cookie: viewer }),
        await call('GET', `/api/orders/${orderId}`, { cookie: viewer }),
        await call('GET', '/api/orders/stats', { cookie: viewer }),
        await call('GET', '/api/reviews/all', { cookie: viewer }),
        await call('GET', `/api/reviews/${review.id}`, { cookie: viewer }),
        await call('GET', '/api/settings/stats-counting-from', { cookie: viewer }),
        await call('GET', '/api/auth/me', { cookie: viewer }),
        await call('GET', '/api/products?active=all', { cookie: viewer }),
      ];
      const text = responses.map((res) => res.text).join('\n');
      check('אין request_id ו-request_hash בתשובות הצופה', !/request_id|request_hash/.test(text));
      check('אין סיסמה, סוד או טוקן בתשובות הצופה', !/password|secret|SESSION|tamburia_admin/i.test(text));
      check('כל הערכים של לקוחות והמבקרים בנתונים שנוצרו הם מהקבוצה הפיקטיבית',
        (await invariantViolations(db, { baselineOrderId: baseline.order, baselineReviewId: baseline.review })).length === 0,
        await invariantViolations(db, { baselineOrderId: baseline.order, baselineReviewId: baseline.review }));
      const hidden = await call('GET', '/api/products?active=all', { cookie: viewer });
      check('הצופה מקבל את רשימת המוצרים המלאה (כולל מוסתרים של ההדגמה)', hidden.status === 200, hidden.status);
    }

    // ── owner
    console.log('\n── בעלים: אף שורה אינה 401 או 403 (חוץ מהעלאה)');
    for (const row of ROUTES) {
      const res = await call(row.method, urlOf(row), { cookie: owner, body: row.body });
      const reason = res.body.details?.reason;
      if (keyOf(row) === UPLOAD) {
        check(`${keyOf(row)} → 403 demo_disabled גם לבעלים`, res.status === 403 && reason === 'demo_disabled', { status: res.status, reason });
      } else {
        check(`${keyOf(row)} → לא 401 ולא 403`, res.status !== 401 && res.status !== 403, res.status);
      }
    }

    // ── escalation attempts
    console.log('\n── ניסיונות הסלמה');
    {
      const target403 = { method: 'DELETE', path: `/api/orders/${orderId}` };
      // the owner pass above deleted the first product, so this part has its own product and order
      const spare = (await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר בדיקה נוסף', category: 'tools', price: 10, sku: 'TEST-DEMO-ROLES-2' } })).body;
      const live = await call('POST', '/api/orders', { body: demoOrderBody(spare) });
      const liveId = live.body.id;
      check('הזמנת הניסיונות נוצרה', live.status === 201 && Number.isInteger(liveId), live.body);
      const [viewerPayload, viewerSignature] = viewer.slice(COOKIE_NAME.length + 1).split('.');
      const claims = JSON.parse(Buffer.from(viewerPayload, 'base64url').toString());

      const attempts = {
        'חתימה ישנה על payload עם role=owner': `${COOKIE_NAME}=${b64(JSON.stringify({ ...claims, role: 'owner' }))}.${viewerSignature}`,
        'חתימה בסוד אחר': `${COOKIE_NAME}=${signed({ ...claims, role: 'owner' }, 'another-secret-value')}`,
        'אסימון ישן בלי role (חתום כראוי)': `${COOKIE_NAME}=${signed({ sub: 'admin', iat: now(), exp: now() + 3600 })}`,
        'role לא מוכר (חתום כראוי)': `${COOKIE_NAME}=${signed({ sub: 'admin', role: 'root', iat: now(), exp: now() + 3600 })}`,
        'אסימון שפג': `${COOKIE_NAME}=${signed({ sub: 'admin', role: 'owner', iat: now() - 100, exp: now() - 50 })}`,
      };
      for (const [name, cookie] of Object.entries(attempts)) {
        const del = await call(target403.method, `/api/orders/${liveId}`, { cookie });
        const read = await call('GET', '/api/orders', { cookie });
        check(`${name} → 401 בכתיבה ובקריאה`, del.status === 401 && read.status === 401, [del.status, read.status]);
      }

      const stillThere = async () => (await db.query('SELECT 1 FROM orders WHERE id = $1', [liveId])).rowCount === 1;
      let res = await call('PUT', `/api/orders/${liveId}?role=owner`, {
        cookie: viewer, body: { role: 'owner', notes: 'x' }, headers: { 'X-Role': 'owner', 'X-Admin-Role': 'owner' },
      });
      check('role בגוף, בשאילתה ובכותרות אינו מעלה צופה', res.status === 403, res.status);
      res = await call('POST', `/api/orders/${liveId}`, { cookie: viewer, headers: { 'X-HTTP-Method-Override': 'DELETE' }, body: {} });
      check('X-HTTP-Method-Override אינו הופך POST ל-DELETE', res.status !== 200 && res.status !== 204 && await stillThere(), res.status);
      res = await call('GET', `/api/orders/${liveId}?_method=DELETE`, { cookie: viewer });
      check('_method=DELETE בשאילתה אינו מוחק', res.status === 200 && await stillThere(), res.status);
      res = await call('DELETE', `/api/orders/${liveId}`, { cookie: viewer });
      check('DELETE ישיר של צופה → 403 וההזמנה נשארת', res.status === 403 && await stillThere(), res.status);
      res = await call('OPTIONS', `/api/orders/${liveId}`, { cookie: viewer });
      check('OPTIONS אינו מוחק דבר', await stillThere(), res.status);

      res = await call('POST', '/api/auth/login', { body: { password: 'guess-guess-guess-guess-1' }, cookie: viewer });
      check('צופה שמנחש סיסמה → 401 ולא עוגיית בעלים', res.status === 401 && adminCookie(res) === null, res.status);
    }

    // ── login limiter: demo-login shares it and does not reset it
    console.log('\n── הגבלת קצב בהתחברות');
    {
      const strict = await spawnServer(target, {
        DEMO_MODE: 'true', DEMO_DATABASE_ID: databaseId, LOGIN_MAX_ATTEMPTS: '3', LOGIN_WINDOW_MS: '60000',
      });
      check('שרת שני עם מגבלת התחברות נמוכה עלה', strict.ok, strict.output());
      if (strict.ok) {
        const strictCall = apiClient(strict.baseUrl);
        const codes = [];
        codes.push((await strictCall('POST', '/api/auth/login', { body: { password: 'nope-nope-nope-nope-nope' } })).status);
        codes.push((await strictCall('POST', '/api/auth/login', { body: { password: 'nope-nope-nope-nope-nope' } })).status);
        codes.push((await strictCall('POST', '/api/auth/demo-login')).status);
        codes.push((await strictCall('POST', '/api/auth/login', { body: { password: 'nope-nope-nope-nope-nope' } })).status);
        check('demo-login נספר באותה מגבלה ואינו מאפס אותה (ניחוש רביעי → 429)', codes.join() === '401,401,200,429', codes);
        const right = await strictCall('POST', '/api/auth/login', { body: { password: 'demo-test-owner-password-24' } });
        check('אחרי המיצוי גם הסיסמה הנכונה נחסמת', right.status === 429, right.status);
        await strict.stop();
      }
    }
  } finally {
    // remove what this suite created, by baseline (other suites' rows are not touched)
    await db.query('DELETE FROM orders WHERE id > $1', [baseline.order]).catch(() => {});
    await db.query('DELETE FROM reviews WHERE id > $1', [baseline.review]).catch(() => {});
    await db.query('DELETE FROM products WHERE id > $1', [baseline.product]).catch(() => {});
    await db.query('DELETE FROM pigment_formulas WHERE color_code = ANY($1::text[])', [created.pigmentCodes]).catch(() => {});
    await db.query("DELETE FROM settings WHERE key = 'stats_counting_from'").catch(() => {});
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
});
