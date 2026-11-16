/**
 * The demo-only checkout (plan 006, Phase 4) on a real demo server: an order is accepted only with
 * one of the three fictional identities, so the database never holds a visitor's real data.
 * Reviews and image uploads are off for everyone. The existing order guarantees (idempotency,
 * availability, rate limits, admin-only reads, no mail) still hold.
 */
const { runDemoSuite, spawnServer } = require('./lib/demoServer');
const {
  apiClient, loginOwner, loginViewer, demoOrderBody, invariantViolations, maxId, uuid,
} = require('./lib/demoClient');
const { IDENTITIES, DEMO_NOTE } = require('../server/api/demo/demo.rules');

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

runDemoSuite(async ({ baseUrl, db, target, databaseId, output }) => {
  const call = apiClient(baseUrl);
  const baseline = { order: await maxId(db, 'orders'), review: await maxId(db, 'reviews'), product: await maxId(db, 'products') };
  const orderCount = async () => (await db.query('SELECT COUNT(*)::int AS total FROM orders WHERE id > $1', [baseline.order])).rows[0].total;

  try {
    const owner = await loginOwner(call);
    const viewer = await loginViewer(call);

    const product = (await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר בדיקת קופה', category: 'tools', price: 20, sku: 'TEST-DEMO-CHK' } })).body;
    const unavailable = (await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר שאזל', category: 'tools', price: 20, sku: 'TEST-DEMO-OOS', in_stock: false } })).body;

    console.log('\n── הזמנה עם זהות הדגמה');
    const [first, second, third] = IDENTITIES;
    let res = await call('POST', '/api/orders', { body: demoOrderBody(product, { identity: first }) });
    check('איסוף עצמי עם זהות 1 → 201', res.status === 201 && res.body.customer_name === first.customer_name, res.body);
    const pickupId = res.body.id;
    check('התשובה אינה כוללת request_id או request_hash', !('request_id' in res.body) && !('request_hash' in res.body), Object.keys(res.body));
    check('אף מייל לא נשלח (emails=false)', res.body.emails.store === false && res.body.emails.customer === false, res.body.emails);

    res = await call('POST', '/api/orders', { body: demoOrderBody(product, { identity: second, delivery: 'delivery', quantity: 2 }) });
    check('משלוח עם זהות 2 וכתובת ההדגמה → 201', res.status === 201 && res.body.delivery_address === second.delivery_address, res.body);
    check('סכום ההזמנה כולל דמי משלוח (2×20 + 20)', Number(res.body.total) === 60, res.body.total);

    res = await call('POST', '/api/orders', { body: demoOrderBody(product, { identity: third, notes: DEMO_NOTE }) });
    check('הערה קבועה מותרת → 201', res.status === 201, res.body);

    const listed = await call('GET', '/api/orders', { cookie: owner });
    const orders = listed.body.orders || listed.body;
    check('ההזמנה מופיעה אצל הבעלים', orders.some((order) => order.id === pickupId), orders.length);
    check('ההזמנה מופיעה אצל הצופה', (await call('GET', `/api/orders/${pickupId}`, { cookie: viewer })).status === 200);

    console.log('\n── פרטים שאינם של הזהויות נדחים, ושום דבר לא נשמר');
    const before = await orderCount();
    const real = demoOrderBody(product, { identity: first });
    const variants = {
      'שם אמיתי': { ...real, customer_name: 'אברהם כהן' },
      'טלפון אמיתי': { ...real, customer_phone: '052-1234567' },
      'אימייל אמיתי': { ...real, customer_email: 'avraham@gmail.com' },
      'ללא אימייל': { ...real, customer_email: undefined },
      'שם של זהות 1 וטלפון של זהות 2': { ...real, customer_phone: second.customer_phone },
      'משלוח לכתובת אחרת': { ...demoOrderBody(product, { identity: first, delivery: 'delivery' }), delivery_address: 'הרצל 1, פתח תקווה' },
      'משלוח לכתובת של זהות אחרת': { ...demoOrderBody(product, { identity: first, delivery: 'delivery' }), delivery_address: second.delivery_address },
      'הערות חופשיות': { ...real, notes: 'נא להתקשר אלי למספר שלי' },
      'שם עם רווחים בלבד': { ...real, customer_name: ' ' },
    };
    for (const [name, body] of Object.entries(variants)) {
      const bad = await call('POST', '/api/orders', { body });
      check(`${name} → 400`, bad.status === 400, bad.status);
      if (name !== 'שם עם רווחים בלבד') check(`${name}: הסיבה demo_identity_only`, bad.body.details?.reason === 'demo_identity_only', bad.body);
    }
    check('אף הזמנה לא נשמרה מהניסיונות', (await orderCount()) === before, await orderCount());
    {
      // the validator drops an address that comes with a pickup order, so none is ever stored
      const pickupWithAddress = await call('POST', '/api/orders', { body: { ...real, request_id: uuid(), delivery_address: 'הרצל 1, פתח תקווה' } });
      check('איסוף שנשלחה איתו כתובת: הכתובת נזרקת ואינה נשמרת', pickupWithAddress.status === 201 && pickupWithAddress.body.delivery_address === null, pickupWithAddress.body);
    }

    console.log('\n── ערבויות קיימות');
    const requestId = uuid();
    const body = demoOrderBody(product, { identity: first, requestId });
    const created = await call('POST', '/api/orders', { body });
    const replay = await call('POST', '/api/orders', { body });
    check('אותו request_id → 200 עם Idempotent-Replayed ואותה הזמנה', created.status === 201 && replay.status === 200
      && replay.headers.get('idempotent-replayed') === 'true' && replay.body.id === created.body.id, [created.status, replay.status]);
    const reused = await call('POST', '/api/orders', { body: { ...body, items: [{ ...body.items[0], quantity: 3 }] } });
    check('אותו request_id עם הזמנה אחרת → 422', reused.status === 422, reused.status);

    res = await call('POST', '/api/orders', { body: demoOrderBody(unavailable, { identity: first }) });
    check('מוצר שאזל → 409 out_of_stock', res.status === 409 && res.body.details?.reason === 'out_of_stock', res.body);
    res = await call('POST', '/api/orders', { body: { ...demoOrderBody(product, { identity: first }), items: [{ id: product.id, name: product.name, price: 1, quantity: 1 }] } });
    check('מחיר שהשתנה → 409', res.status === 409, res.status);

    check('GET /api/orders בלי עוגייה → 401', (await call('GET', '/api/orders')).status === 401);
    check('GET /api/orders/:id בלי עוגייה → 401', (await call('GET', `/api/orders/${pickupId}`)).status === 401);
    check('GET /api/orders/stats בלי עוגייה → 401', (await call('GET', '/api/orders/stats')).status === 401);
    check('אין חיפוש ציבורי לפי טלפון (/by-phone → 401)', (await call('GET', '/api/orders/by-phone?phone=0500000011')).status === 401);
    check('אין גישה להזמנה לפי טלפון', (await call('GET', `/api/orders?phone=${first.customer_phone}`)).status === 401);

    console.log('\n── עריכת הבעלים באותה מגבלה');
    res = await call('PUT', `/api/orders/${pickupId}`, { cookie: owner, body: { customer_name: 'אברהם כהן' } });
    check('הבעלים לא יכול לשים שם אמיתי → 400', res.status === 400, res.status);
    res = await call('PUT', `/api/orders/${pickupId}`, { cookie: owner, body: { notes: 'הערה חופשית' } });
    check('הבעלים לא יכול לשים הערה חופשית → 400', res.status === 400, res.status);
    res = await call('PUT', `/api/orders/${pickupId}`, { cookie: owner, body: { delivery_method: 'delivery' } });
    check('החלפת איסוף למשלוח בלי כתובת → 400', res.status === 400, res.status);
    res = await call('PUT', `/api/orders/${pickupId}/status`, { cookie: owner, body: { status: 'processing' } });
    check('הבעלים משנה סטטוס → 200', res.status === 200 && res.body.status === 'processing', res.status);
    res = await call('PUT', `/api/orders/${pickupId}`, { cookie: owner, body: { customer_name: second.customer_name, customer_phone: second.customer_phone, customer_email: second.customer_email } });
    check('החלפה לזהות אחרת מהקבוצה → 200', res.status === 200, res.body);

    console.log('\n── חוות דעת והעלאות מושבתות');
    for (const [who, cookie] of [['מבקר', undefined], ['צופה', viewer], ['בעלים', owner]]) {
      const review = await call('POST', '/api/reviews', { cookie, body: { reviewer_name: 'בדיקה', rating: 5, text: 'טקסט', type: 'store' } });
      check(`POST /api/reviews של ${who} → 403 demo_disabled`, review.status === 403 && review.body.details?.reason === 'demo_disabled', [review.status, review.body]);
      const upload = await call('POST', '/api/upload-multiple', { cookie });
      check(`POST /api/upload-multiple של ${who} → 403 demo_disabled`, upload.status === 403 && upload.body.details?.reason === 'demo_disabled', [upload.status, upload.body]);
    }
    check('אף חוות דעת לא נשמרה', (await maxId(db, 'reviews')) === baseline.review);
    check('GET /api/reviews ציבורי עובד', (await call('GET', '/api/reviews')).status === 200);
    check('GET /api/reviews/stats ציבורי עובד', (await call('GET', '/api/reviews/stats')).status === 200);

    console.log('\n── הגבלת קצב להזמנות');
    {
      const limited = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: databaseId, ORDER_RATE_MAX: '3', ORDER_RATE_WINDOW_MS: '60000' });
      check('שרת עם מגבלת הזמנות נמוכה עלה', limited.ok, limited.output());
      if (limited.ok) {
        const limitedCall = apiClient(limited.baseUrl);
        const codes = [];
        for (let i = 0; i < 4; i += 1) codes.push((await limitedCall('POST', '/api/orders', { body: demoOrderBody(product, { identity: first }) })).status);
        check('הניסיון הרביעי → 429', codes.join() === '201,201,201,429', codes);
        await limited.stop();
      }
    }

    console.log('\n── מייל');
    const log = output();
    check('נרשם [mail disabled] ולא נשלח מייל', log.includes('[mail disabled]') && !log.includes('mail sent |') && !log.includes('mail failed |'), log.split('\n').filter((line) => /mail/.test(line)).slice(0, 3));

    console.log('\n── נתונים');
    const violations = await invariantViolations(db, { baselineOrderId: baseline.order, baselineReviewId: baseline.review });
    check('כל ערכי הלקוחות בנתונים מהקבוצה הפיקטיבית', violations.length === 0, violations);
  } finally {
    await db.query('DELETE FROM orders WHERE id > $1', [baseline.order]).catch(() => {});
    await db.query('DELETE FROM reviews WHERE id > $1', [baseline.review]).catch(() => {});
    await db.query('DELETE FROM products WHERE id > $1', [baseline.product]).catch(() => {});
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
});
