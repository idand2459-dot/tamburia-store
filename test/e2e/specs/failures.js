/**
 * The highest-risk behaviours: an order that may or may not have been created, a duplicate or
 * concurrent submission, a request_id reused for a different order, inventory that changed while
 * the customer was checking out, and the 48-hour expiry of a stored checkout attempt.
 *
 * The server side of idempotency is covered in depth by test/smoke-orders.js and
 * test/unit-order-service.js (malformed ids, hashing, the database constraint, mixed concurrent
 * bodies). This file does not repeat that: it checks the same guarantees once over real HTTP, and
 * then what only a browser can show - what the customer sees and what survives a refresh.
 */
const crypto = require('crypto');
const { check } = require('../lib/harness');
const fx = require('../lib/fixtures');
const b = require('../lib/browser');

const UNCERTAIN_TEXT = 'לא קיבלנו אישור מהשרת';
const PENDING_TITLE = 'יש הזמנה שלא אושרה';
const RETRY_BUTTON = 'שלחו שוב את ההזמנה הקודמת';
const HOURS_49_MS = 49 * 60 * 60 * 1000;

/** Failure scenarios. `ctx` = { baseUrl, browser, db, catalog, api }. */
async function run({ baseUrl, browser, db, catalog, api }, scenario) {
  const { brush, stock } = catalog;
  const anon = fx.createApi(baseUrl);
  const posts = (s) => s.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/api/orders'));
  const orderCount = async () => (await fx.ordersOfCustomer(db)).length;

  /** A valid order body for the API, with the given request_id. */
  const apiOrder = (requestId, extra = {}) => ({
    request_id: requestId,
    customer_name: fx.CUSTOMER_NAME,
    customer_phone: fx.CUSTOMER_PHONE,
    delivery_method: 'pickup',
    items: [{ id: brush.id, name: brush.name, price: 30, quantity: 1 }],
    ...extra,
  });

  /** Puts `product` in the cart through the UI and fills the checkout form, ready to submit. */
  async function readyToSubmit(page, product) {
    await b.addToCartFromProductPage(page, baseUrl, product);
    await b.openCart(page);
    await b.chooseDelivery(page, 'pickup');
    await b.continueToDetails(page);
    await b.fillCheckout(page, { name: fx.CUSTOMER_NAME, phone: fx.CUSTOMER_PHONE });
  }

  await scenario('כשל: אותו request_id — כפילות, מקביליות וגוף שונה (HTTP)', async () => {
    const before = await orderCount();
    const id = crypto.randomUUID();
    const first = await anon.call('POST', '/orders', apiOrder(id));
    fx.trackOrder(first.body?.id);
    check('שליחה ראשונה → 201', first.status === 201, first.status);
    const again = await anon.call('POST', '/orders', apiOrder(id));
    check('שליחה חוזרת של אותו גוף → 200 עם ההזמנה המקורית', again.status === 200 && again.body.id === first.body.id, [again.status, again.body?.id]);
    check('נשלח Idempotent-Replayed', again.headers.get('idempotent-replayed') === 'true', null);
    check('התשובה לא חושפת request_id', !('request_id' in again.body) && !('request_hash' in again.body), Object.keys(again.body));

    const different = await anon.call('POST', '/orders', apiOrder(id, { customer_name: `${fx.E2E_PREFIX} אחר` }));
    check('אותו מזהה וגוף שונה → 422 request_id_reused', different.status === 422 && different.body.details?.reason === 'request_id_reused', [different.status, different.body]);
    check('הגוף השונה לא נשמר', (await db.query('SELECT count(*)::int AS n FROM orders WHERE customer_name = $1', [`${fx.E2E_PREFIX} אחר`])).rows[0].n === 0, null);

    const racing = crypto.randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, () => anon.call('POST', '/orders', apiOrder(racing))));
    results.forEach((r) => fx.trackOrder(r.body?.id));
    const created = results.filter((r) => r.status === 201).length;
    const replayed = results.filter((r) => r.status === 200).length;
    check('6 בקשות מקבילות באותו מזהה → בדיוק 201 אחד והשאר 200', created === 1 && replayed === 5, results.map((r) => r.status));
    check('כולן מחזירות את אותה הזמנה', new Set(results.map((r) => r.body.id)).size === 1, null);
    check('נוספו בדיוק שתי הזמנות ב-PostgreSQL (אחת לכל מזהה)', await orderCount() - before === 2, await orderCount() - before);
  });

  await scenario('כשל: התשובה אבדה אחרי שהשרת שמר — ניסיון חוזר, רענון והזמנה אחת', async () => {
    const before = await orderCount();
    const s = await b.newPage(browser);
    try {
      await b.interceptOrderPosts(s.page, async (request, n) => {
        if (n === 1) await b.forwardThenDrop(request);
        else await request.continue();
      });
      await readyToSubmit(s.page, brush);
      await b.submitOrder(s.page);
      await b.waitForText(s.page, UNCERTAIN_TEXT);
      check('הלקוח רואה שהתוצאה לא ודאית', true);
      await b.waitForText(s.page, PENDING_TITLE);
      check('מוצגת הודעת "הזמנה שלא אושרה" במקום כפתור שליחה', (await s.page.$$('.checkout-pending')).length === 1, null);

      const attempt = await b.storedAttempt(s.page);
      check('הניסיון נשמר במכשיר עם request_id', /^[0-9a-f-]{36}$/.test(attempt?.requestId || ''), attempt && attempt.requestId);
      check('בשרת נוצרה הזמנה אחת', await orderCount() - before === 1, await orderCount() - before);
      const firstId = JSON.parse(posts(s)[0].body).request_id;
      check('ה-request_id ששודר זהה לשמור', firstId === attempt.requestId, null);

      // a refresh does not lose it, and does not send anything by itself
      await s.page.goto(`${baseUrl}/checkout`, { waitUntil: 'domcontentloaded' });
      await b.waitForText(s.page, PENDING_TITLE);
      check('אחרי רענון ההודעה עדיין מוצגת', true);
      check('רענון לא שלח הזמנה מעצמו', posts(s).length === 1, posts(s).length);

      await b.clickButton(s.page, RETRY_BUTTON);
      await s.page.waitForSelector('.order-success');
      const second = posts(s)[1];
      check('הניסיון החוזר נשלח עם אותו request_id', second && JSON.parse(second.body).request_id === firstId, null);
      const shownId = Number((await s.page.$eval('.order-success-id', (el) => el.textContent)).replace('#', ''));
      const rows = await fx.ordersOfCustomer(db);
      check('לא נוצרה הזמנה כפולה', rows.length - before === 1, rows.length - before);
      check('מסך האישור מציג את ההזמנה המקורית', rows.some((r) => r.id === shownId && r.request_id === firstId), shownId);
      check('אחרי ההצלחה הניסיון השמור נמחק', (await b.storedAttempt(s.page)) === null, null);
      check('אחרי ההצלחה העגלה ריקה', await b.cartCount(s.page) === 0, null);
    } finally { await s.close(); }
  });

  await scenario('כשל: השרת לא עונה (timeout של הלקוח) — שליחה חוזרת בטוחה', async () => {
    const before = await orderCount();
    const s = await b.newPage(browser);
    try {
      await b.interceptOrderPosts(s.page, async (request, n) => {
        if (n === 1) return; // hung: never answered; the page gives up after ORDER_TIMEOUT_MS (20 s)
        await request.continue();
      });
      await readyToSubmit(s.page, brush);
      await b.submitOrder(s.page);
      await b.waitForText(s.page, UNCERTAIN_TEXT, 30_000);
      check('אחרי 20 שניות בלי תשובה מוצגת הודעה על תוצאה לא ודאית', true);
      check('לא נוצרה הזמנה (הבקשה לא הגיעה לשרת)', await orderCount() === before, await orderCount() - before);
      check('הניסיון נשמר', Boolean((await b.storedAttempt(s.page))?.requestId), null);
      check('לא נשלחה בקשה שנייה מעצמה', posts(s).length === 1, posts(s).length);

      await b.clickButton(s.page, RETRY_BUTTON);
      await s.page.waitForSelector('.order-success');
      check('השליחה החוזרת יצרה בדיוק הזמנה אחת', await orderCount() - before === 1, await orderCount() - before);
    } finally { await s.close(); }
  });

  await scenario('כשל: ניסיון שמור פג אחרי 48 שעות — בלי שליחה אוטומטית', async () => {
    const before = await orderCount();
    const s = await b.newPage(browser);
    try {
      await b.interceptOrderPosts(s.page, async (request, n) => {
        if (n === 1) await request.abort('connectionreset');
        else await request.continue();
      });
      await readyToSubmit(s.page, brush);
      await b.submitOrder(s.page);
      await b.waitForText(s.page, PENDING_TITLE);
      const attempt = await b.storedAttempt(s.page);
      check('לפני התפוגה הגוף שמור (כולל פרטי הלקוח)', JSON.stringify(attempt).includes(fx.CUSTOMER_NAME), null);

      // make the stored attempt 49 hours old, then load the page the way a returning customer would
      await s.page.evaluate((ageMs) => {
        const key = 'tamburia-checkout-attempt';
        const stored = JSON.parse(localStorage.getItem(key));
        stored.submittedAt = Date.now() - ageMs;
        localStorage.setItem(key, JSON.stringify(stored));
      }, HOURS_49_MS);
      const sent = posts(s).length;
      await s.page.goto(`${baseUrl}/checkout`, { waitUntil: 'domcontentloaded' });
      await b.waitForText(s.page, 'עברו 48 שעות');
      check('אחרי 48 שעות מוצגת הודעת פקיעה', true);

      const record = await b.storedAttempt(s.page);
      check('פרטי הלקוח נמחקו מהמכשיר', record && !JSON.stringify(record).includes(fx.CUSTOMER_NAME) && !('body' in record), record && Object.keys(record));
      check('נשארה רק רשומת "פג" עם ה-request_id', Boolean(record?.expired) && record.requestId === attempt.requestId, record);
      check('אין כפתור שליחה חוזרת', (await s.page.$$eval('button', (els, label) => els.filter((el) => el.textContent.includes(label)).length, RETRY_BUTTON)) === 0, null);
      check('אין כפתור "שלח הזמנה" חדש עד שהלקוח מבטל', (await s.page.$$eval('button', (els) => els.filter((el) => el.textContent.trim() === 'שלח הזמנה').length)) === 0, null);
      check('לא נשלחה שום בקשה אוטומטית אחרי הפקיעה', posts(s).length === sent, posts(s).length - sent);
      check('לא נוצרה הזמנה', await orderCount() === before, await orderCount() - before);
      check('לא נוצר request_id חדש', JSON.stringify(s.requests).split('request_id').length - 1 === 1, null);

      // only the customer's own cancellation frees the checkout
      await b.clickButton(s.page, 'בטלו והתחילו מחדש');
      await b.clickButton(s.page, 'כן, בטלו את ההזמנה הקודמת');
      await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some((el) => el.textContent.trim() === 'שלח הזמנה'));
      check('אחרי ביטול מפורש אפשר שוב לשלוח הזמנה חדשה', (await b.storedAttempt(s.page)) === null, null);
      check('הביטול עצמו לא שלח דבר', posts(s).length === sent, posts(s).length - sent);
    } finally { await s.close(); }
  });

  await scenario('כשל: מלאי השתנה באמצע ההזמנה → 409 ברור, בלי הזמנה ובלי איבוד העגלה', async () => {
    const before = await orderCount();
    const s = await b.newPage(browser);
    try {
      await readyToSubmit(s.page, stock);
      // the product sells out after the customer has filled the form
      const sold = await api.call('PUT', `/products/${stock.id}`, { name: stock.name, price: 50, category: 'tools', in_stock: false });
      check('המוצר סומן כאזל באדמין', sold.status === 200, sold.status);

      await b.submitOrder(s.page);
      await s.page.waitForSelector('.checkout-alert');
      const alertText = await s.page.$eval('.checkout-alert', (el) => el.textContent);
      check('הלקוח רואה הודעה שהמוצר אזל', alertText.includes(stock.name) || alertText.includes('אזל') || alertText.includes('זמין'), alertText);
      check('הבקשה נשלחה פעם אחת ונדחתה', posts(s).length === 1, posts(s).length);
      check('לא נוצרה הזמנה', await orderCount() === before, await orderCount() - before);
      check('דחייה ב-4xx לא משאירה ניסיון שמור', (await b.storedAttempt(s.page)) === null, null);
      check('העגלה לא נמחקה', await b.cartCount(s.page) === 1, await b.cartCount(s.page));
      check('אין מסך הצלחה', (await s.page.$$('.order-success')).length === 0, null);
      const direct = await anon.call('POST', '/orders', apiOrder(crypto.randomUUID(), { items: [{ id: stock.id, name: stock.name, price: 50, quantity: 1 }] }));
      check('אותו מוצר ישירות מה-API → 409 out_of_stock', direct.status === 409 && direct.body.details?.reason === 'out_of_stock', [direct.status, direct.body]);
    } finally { await s.close(); }
  });
}

module.exports = { run };
