/**
 * Admin journeys in a real browser: access control, login, the order list, the 30-second polling
 * that shows a new order, inspecting and changing an order, and logout.
 *
 * The polling interval is the production one (POLL_MS = 30000 in hooks/useAdminOrders.js); it is
 * not shortened. The wait for the new order is a condition with a bound just above one interval.
 */
const { check } = require('../lib/harness');
const fx = require('../lib/fixtures');
const b = require('../lib/browser');

/** One poll tick (30 s) plus slack for the request itself. */
const POLL_BOUND_MS = 45_000;

/** A minimal pickup order body for the API. */
function orderBody(catalog, extra = {}) {
  const { brush } = catalog;
  return {
    customer_name: fx.CUSTOMER_NAME,
    customer_phone: fx.CUSTOMER_PHONE,
    delivery_method: 'pickup',
    items: [{ id: brush.id, name: brush.name, price: 30, quantity: 1 }],
    ...extra,
  };
}

/** Waits until the order card `#id` is on the page. */
function waitForCard(page, id, timeout = b.WAIT_MS) {
  return page.waitForFunction((n) => [...document.querySelectorAll('.order-card-number')]
    .some((el) => el.textContent === `#${n}`), { timeout }, id);
}

/** Opens the card `#id` (its head is the toggle button). */
async function openCard(page, id) {
  await page.evaluate((n) => {
    const card = [...document.querySelectorAll('.order-card')]
      .find((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`);
    card.querySelector('.order-card-head').click();
  }, id);
  await page.waitForFunction((n) => [...document.querySelectorAll('.order-card.is-open')]
    .some((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`), {}, id);
}

/** Admin journeys. `ctx` = { baseUrl, browser, db, catalog, api }. */
async function run({ baseUrl, browser, db, catalog, api }, scenario) {
  const password = process.env.ADMIN_PASSWORD;
  const anon = fx.createApi(baseUrl);

  /** Creates an order through the public endpoint, the way the storefront does. */
  async function createOrder(extra) {
    const res = await anon.call('POST', '/orders', orderBody(catalog, extra));
    if (res.status !== 201) throw new Error(`יצירת הזמנה נכשלה: ${res.status}`);
    fx.trackOrder(res.body.id);
    return res.body;
  }

  /** Logs in through the login screen. */
  async function loginThroughUi(page) {
    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', password);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.order-card');
  }

  await scenario('אדמין: מבקר לא מחובר אינו רואה נתוני הזמנות', async () => {
    const seeded = await createOrder();
    const s = await b.newPage(browser);
    try {
      await s.page.goto(`${baseUrl}/admin/orders`, { waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('input[type="password"]');
      check('בלי התחברות מוצג מסך כניסה', true);
      check('אין כרטיסי הזמנה על המסך', (await s.page.$$('.order-card')).length === 0, null);
      const orderRequests = s.requests.filter((r) => r.url.includes('/api/orders'));
      check('המסך לא ביקש הזמנות מהשרת', orderRequests.length === 0, orderRequests);
      const body = await s.page.evaluate(() => document.body.innerText);
      check('שם הלקוח אינו מופיע בדף', !body.includes(fx.CUSTOMER_NAME), null);

      for (const [method, path] of [['GET', '/orders'], ['GET', `/orders/${seeded.id}`], ['GET', '/orders/stats'],
        ['PUT', `/orders/${seeded.id}/status`], ['DELETE', `/orders/${seeded.id}`]]) {
        const res = await anon.call(method, path, method === 'PUT' ? { status: 'completed' } : undefined);
        check(`${method} /api${path} ללא התחברות → 401`, res.status === 401, res.status);
      }
      const forged = await fx.createApi(baseUrl, 'tamburia_admin=not-a-real-token').call('GET', '/orders');
      check('עוגייה מזויפת → 401', forged.status === 401, forged.status);

      // a wrong password gives no access either
      await s.page.type('input[type="password"]', 'wrong-password-e2e');
      await s.page.keyboard.press('Enter');
      await s.page.waitForSelector('.admin-login-error');
      check('סיסמה שגויה → הודעת שגיאה ובלי כניסה', (await s.page.$$('.order-card')).length === 0, null);
      const status = await anon.call('GET', '/auth/me');
      check('/api/auth/me ללא התחברות אינו מאשר', status.status === 401 || status.body?.authenticated === false || status.body?.ok === false, status.status);
    } finally { await s.close(); }
  });

  await scenario('אדמין: כניסה, רשימת הזמנות, polling, בדיקה ושינוי סטטוס, יציאה', async () => {
    const first = await createOrder({ notes: 'e2e first' });
    const s = await b.newPage(browser);
    try {
      await loginThroughUi(s.page);
      await waitForCard(s.page, first.id);
      check('הזמנה קיימת מופיעה ברשימת האדמין', true);

      const cookies = await s.page.cookies();
      const session = cookies.find((c) => c.name === 'tamburia_admin');
      check('עוגיית ההתחברות HttpOnly', Boolean(session?.httpOnly), session && { httpOnly: session.httpOnly });
      check('הטוקן אינו נגיש ל-JavaScript של הדף', !(await s.page.evaluate(() => document.cookie)).includes('tamburia_admin'), null);

      // polling: an order created after the screen loaded appears without any user action
      const requestsBefore = s.requests.filter((r) => r.method === 'GET' && /\/api\/orders$/.test(r.url)).length;
      const second = await createOrder({ notes: 'e2e polled' });
      const startedAt = Date.now();
      await waitForCard(s.page, second.id, POLL_BOUND_MS);
      const waitedMs = Date.now() - startedAt;
      const requestsAfter = s.requests.filter((r) => r.method === 'GET' && /\/api\/orders$/.test(r.url)).length;
      check(`הזמנה חדשה הופיעה דרך ה-polling בתוך ${POLL_BOUND_MS / 1000} שניות (${Math.round(waitedMs / 1000)}s)`, true);
      check('ה-polling הוא בקשת GET /api/orders נוספת', requestsAfter > requestsBefore, { requestsBefore, requestsAfter });

      // inspect
      await openCard(s.page, first.id);
      const facts = await s.page.evaluate((n) => {
        const card = [...document.querySelectorAll('.order-card')]
          .find((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`);
        return card.innerText;
      }, first.id);
      check('כרטיס פתוח מציג שם, טלפון והערה', facts.includes(fx.CUSTOMER_NAME) && facts.includes(fx.CUSTOMER_PHONE) && facts.includes('e2e first'), facts.slice(0, 120));

      // change status through the select, then read PostgreSQL itself
      await s.page.select('.order-card.is-open .order-status-fix select', 'processing');
      await s.page.waitForFunction((n) => {
        const card = [...document.querySelectorAll('.order-card')]
          .find((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`);
        return card && card.querySelector('.order-card-status--processing');
      }, {}, first.id);
      const afterProcessing = await db.query('SELECT status FROM orders WHERE id = $1', [first.id]);
      check('הסטטוס "בטיפול" נשמר ב-PostgreSQL', afterProcessing.rows[0]?.status === 'processing', afterProcessing.rows[0]);

      await s.page.select('.order-card.is-open .order-status-fix select', 'ready_for_pickup');
      await s.page.waitForFunction((n) => {
        const card = [...document.querySelectorAll('.order-card')]
          .find((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`);
        return card && card.querySelector('.order-card-status--ready_for_pickup');
      }, {}, first.id);
      const afterReady = await db.query('SELECT status FROM orders WHERE id = $1', [first.id]);
      check('הסטטוס "מוכנה לאיסוף" נשמר ב-PostgreSQL', afterReady.rows[0]?.status === 'ready_for_pickup', afterReady.rows[0]);

      // the server refuses a pairing that does not fit the method, and the screen does not offer it
      const options = await s.page.$$eval('.order-card.is-open .order-status-fix option', (els) => els.map((el) => el.value));
      check('הרשימה לא מציעה "נשלחה" להזמנת איסוף', !options.includes('shipped'), options);
      const bad = await api.call('PUT', `/orders/${first.id}/status`, { status: 'shipped' });
      check('השרת דוחה "נשלחה" להזמנת איסוף ב-400', bad.status === 400, bad.status);

      // a reload keeps the change (it came from the database, not from the page)
      await s.page.reload({ waitUntil: 'domcontentloaded' });
      await waitForCard(s.page, first.id);
      const shown = await s.page.evaluate((n) => {
        const card = [...document.querySelectorAll('.order-card')]
          .find((c) => c.querySelector('.order-card-number')?.textContent === `#${n}`);
        return card.querySelector('.order-card-status').className;
      }, first.id);
      check('אחרי רענון הסטטוס נשאר "מוכנה לאיסוף"', shown.includes('ready_for_pickup'), shown);

      // logout: the cookie goes, the admin screen is gone, the API refuses this browser
      await b.clickButton(s.page, 'חזור לחנות');
      await s.page.waitForFunction(() => window.location.pathname === '/');
      const after = (await s.page.cookies()).find((c) => c.name === 'tamburia_admin');
      check('אחרי יציאה עוגיית ההתחברות נמחקה מהדפדפן', !after, after && after.name);
      const refused = await s.page.evaluate(async () => (await fetch('/api/orders')).status);
      check('אחרי יציאה GET /api/orders מהדפדפן → 401', refused === 401, refused);
      await s.page.goto(`${baseUrl}/admin/orders`, { waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('input[type="password"]');
      check('אחרי יציאה /admin/orders מציג מסך כניסה, בלי הזמנות', (await s.page.$$('.order-card')).length === 0, null);
    } finally { await s.close(); }
  });
}

module.exports = { run };
