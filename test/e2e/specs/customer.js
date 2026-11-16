/**
 * Customer journeys in a real browser: browse, product page, cart, checkout, confirmation, the
 * order as PostgreSQL holds it, and the absence of any public order lookup.
 */
const { check } = require('../lib/harness');
const fx = require('../lib/fixtures');
const b = require('../lib/browser');

/** Runs in the page: whether the cart row of `rowName` shows the quantity `wanted`. */
function quantityIs([rowName, wanted]) {
  const row = [...document.querySelectorAll('.cart-row')]
    .find((r) => r.querySelector('.cart-row-name').textContent.trim() === rowName);
  return Boolean(row) && row.querySelector('.cart-row-qty-value').textContent.trim() === String(wanted);
}

/** Customer journeys. `ctx` = { baseUrl, browser, db, catalog }. */
async function run({ baseUrl, browser, db, catalog }, scenario) {
  const { hammer, brush } = catalog;
  const posts = (s) => s.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/api/orders')).length;

  await scenario('לקוח: גלישה בחנות ועמוד מוצר', async () => {
    const s = await b.newPage(browser);
    try {
      await s.page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await b.waitForText(s.page, 'טכניק טמבור');
      check('דף הבית נטען עם שם החנות', true);

      await s.page.goto(`${baseUrl}/category/tools`, { waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('.product-card');
      const names = await s.page.$$eval('.product-card-name', (els) => els.map((el) => el.textContent.trim()));
      check('עמוד הקטגוריה מציג את מוצרי הבדיקה', names.includes(hammer.name) && names.includes(brush.name), names.slice(0, 5));

      await s.page.locator(`::-p-aria([role="link"][name="${hammer.name}"])`).click();
      await s.page.waitForFunction((id) => window.location.pathname === `/product/${id}`, {}, hammer.id);
      await s.page.waitForSelector('.product-detail-price');
      const price = await s.page.$eval('.product-detail-price', (el) => el.textContent);
      check('עמוד המוצר מציג את המחיר מהקטלוג (100)', price.includes('100'), price);
    } finally { await s.close(); }
  });

  await scenario('לקוח: עגלה — הוספה, שינוי כמות, הסרה', async () => {
    const s = await b.newPage(browser);
    try {
      await b.addToCartFromProductPage(s.page, baseUrl, hammer);
      await b.addToCartFromProductPage(s.page, baseUrl, brush);
      check('מונה העגלה מראה 2 פריטים', await b.cartCount(s.page) === 2, await b.cartCount(s.page));

      await b.openCart(s.page);
      const rows = await s.page.$$eval('.cart-row-name', (els) => els.map((el) => el.textContent.trim()));
      check('שתי השורות בעגלה', rows.length === 2 && rows.includes(hammer.name) && rows.includes(brush.name), rows);

      // raise the hammer quantity to 3, one click at a time: a locator waits until the button is
      // stable (the drawer is still sliding in), and each click is confirmed before the next
      const rowIndex = rows.indexOf(hammer.name) + 1;
      const qtyButton = (label) => s.page.locator(`.cart-row:nth-child(${rowIndex}) button[aria-label="${label}"]`);
      await qtyButton('הוסף כמות').click();
      await s.page.waitForFunction(quantityIs, {}, [hammer.name, 2]);
      await qtyButton('הוסף כמות').click();
      await s.page.waitForFunction(quantityIs, {}, [hammer.name, 3]);
      const subtotal = await s.page.evaluate(() => document.querySelector('.cart-summary-row')?.textContent || '');
      check('הסכום החלקי מתעדכן (3×100 + 30 = 330)', subtotal.includes('330'), subtotal);

      // lower it by one, then remove the brush
      await qtyButton('הפחת כמות').click();
      await s.page.waitForFunction(quantityIs, {}, [hammer.name, 2]);
      await b.clickByLabelPrefix(s.page, `הסר: ${brush.name}`);
      await s.page.waitForFunction(() => document.querySelectorAll('.cart-row').length === 1);
      const left = await s.page.$$eval('.cart-row-name', (e) => e.map((x) => x.textContent.trim()));
      check('הסרת פריט משאירה שורה אחת', left.length === 1 && left[0] === hammer.name, left);

      const stored = await s.page.evaluate(() => JSON.parse(localStorage.getItem('tamburia-cart')));
      check('העגלה נשמרת במכשיר עם הכמות 2', stored.length === 1 && stored[0].quantity === 2, stored);
      await s.page.reload({ waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('.navbar-cart-btn');
      check('העגלה שורדת רענון', await b.cartCount(s.page) === 2, await b.cartCount(s.page));
    } finally { await s.close(); }
  });

  await scenario('לקוח: תשלום עד אישור, התמדה ב-PostgreSQL ואין חיפוש הזמנות ציבורי', async () => {
    const s = await b.newPage(browser);
    try {
      await b.addToCartFromProductPage(s.page, baseUrl, hammer);
      await b.addToCartFromProductPage(s.page, baseUrl, brush);
      await b.openCart(s.page);
      await b.chooseDelivery(s.page, 'pickup');
      await b.continueToDetails(s.page);

      // an incomplete form is refused in the browser and nothing is sent
      await b.submitOrder(s.page);
      await s.page.waitForSelector('.checkout-error');
      check('טופס חסר שדות חובה לא נשלח לשרת', posts(s) === 0, posts(s));

      await b.fillCheckout(s.page, {
        name: fx.CUSTOMER_NAME, phone: fx.CUSTOMER_PHONE, email: fx.CUSTOMER_EMAIL, notes: 'e2e: אין לאסוף',
      });
      await b.submitOrder(s.page);
      await s.page.waitForSelector('.order-success');
      const idText = await s.page.$eval('.order-success-id', (el) => el.textContent);
      const id = Number(idText.replace('#', ''));
      fx.trackOrder(id);
      check('מסך האישור מציג מספר הזמנה', Number.isInteger(id) && id > 0, idText);
      const total = await s.page.$eval('.order-success-total', (el) => el.textContent);
      check('הסכום באישור הוא 130 (100+30, איסוף עצמי)', total.includes('130'), total);

      check('אחרי ההצלחה העגלה ריקה', await b.cartCount(s.page) === 0, await b.cartCount(s.page));
      check('אחרי ההצלחה לא נשאר ניסיון שמור', (await b.storedAttempt(s.page)) === null, null);

      const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
      const row = rows[0];
      check('ההזמנה נשמרה ב-PostgreSQL', Boolean(row), rows.length);
      if (row) {
        check('שם וטלפון נשמרו', row.customer_name === fx.CUSTOMER_NAME && row.customer_phone === fx.CUSTOMER_PHONE, [row.customer_name, row.customer_phone]);
        check('אופן הקבלה איסוף, סטטוס חדשה', row.delivery_method === 'pickup' && row.status === 'new', [row.delivery_method, row.status]);
        check('הסכומים חושבו בשרת: 130, משלוח 0', Number(row.total) === 130 && Number(row.delivery_fee) === 0, [row.total, row.delivery_fee]);
        const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
        check('שני הפריטים נשמרו עם הכמויות', Array.isArray(items) && items.length === 2
          && items.find((i) => i.id === hammer.id)?.quantity === 1, items);
        check('נשמר request_id בתבנית UUID', /^[0-9a-f-]{36}$/.test(row.request_id || ''), row.request_id);
      }
      const count = (await fx.ordersOfCustomer(db)).length;
      check('נוצרה הזמנה אחת בלבד', count === 1, count);

      // there is no public way to read the order back
      const anon = fx.createApi(baseUrl);
      for (const path of [`/orders/${id}`, '/orders', `/orders?phone=${fx.CUSTOMER_PHONE}`]) {
        const res = await anon.call('GET', path);
        check(`GET /api${path.split('?')[0]} ללא התחברות → 401 בלי נתוני לקוח`,
          res.status === 401 && !res.text.includes(fx.CUSTOMER_NAME), res.status);
      }
      for (const path of [`/orders/by-phone/${fx.CUSTOMER_PHONE}`, '/orders/lookup']) {
        const res = await anon.call('GET', path);
        check(`GET /api${path} → 404/401 ללא נתוני לקוח`, [401, 404].includes(res.status) && !res.text.includes(fx.CUSTOMER_NAME), res.status);
      }
      const lookupPost = await anon.call('POST', '/orders/lookup', { order_id: id, phone: fx.CUSTOMER_PHONE });
      check('POST /api/orders/lookup אינו קיים', [401, 404].includes(lookupPost.status) && !lookupPost.text.includes(fx.CUSTOMER_NAME), lookupPost.status);

      await s.page.goto(`${baseUrl}/orders/lookup`, { waitUntil: 'domcontentloaded' });
      await b.waitForText(s.page, '404');
      check('/orders/lookup בדפדפן הוא דף 404 רגיל', true);
    } finally { await s.close(); }
  });

  await scenario('לקוח: משלוח — כתובת חובה ודמי משלוח', async () => {
    const s = await b.newPage(browser);
    try {
      await b.addToCartFromProductPage(s.page, baseUrl, brush);
      await b.openCart(s.page);
      await b.chooseDelivery(s.page, 'delivery');
      await b.continueToDetails(s.page);
      await b.fillCheckout(s.page, { name: fx.CUSTOMER_NAME, phone: fx.CUSTOMER_PHONE });
      await b.submitOrder(s.page);
      await s.page.waitForSelector('#checkout-address-error, .checkout-error');
      check('משלוח בלי כתובת נחסם בדפדפן', posts(s) === 0, posts(s));

      await s.page.type('#checkout-address', 'בר כוכבא 52, פתח תקווה');
      await b.submitOrder(s.page);
      await s.page.waitForSelector('.order-success');
      const id = Number((await s.page.$eval('.order-success-id', (el) => el.textContent)).replace('#', ''));
      fx.trackOrder(id);
      const { rows } = await db.query('SELECT total, delivery_fee, delivery_address FROM orders WHERE id = $1', [id]);
      check('משלוח: 30 + 20 = 50 ב-PostgreSQL', Number(rows[0]?.total) === 50 && Number(rows[0]?.delivery_fee) === 20, rows[0]);
      check('כתובת המשלוח נשמרה', (rows[0]?.delivery_address || '').includes('פתח תקווה'), rows[0]);
    } finally { await s.close(); }
  });
}

module.exports = { run };
