/**
 * Cleanup of visitor orders and the abuse cap (plan 006, Phase 6), on a real demo server.
 *
 * A visitor order is an order carrying one of the three identity phones whose request_id is empty or
 * not tagged `demo-seed:`. Cleanup deletes only those, only after DEMO_ORDER_TTL_HOURS, at most 200 per
 * run, and only while the marker is present, matches and is 'ready'. A Render instance sleeps, so the
 * triggers are events that wake it: startup, an order create at the cap, and an admin read (throttled
 * to one run per five minutes). Back-dated rows stand in for a long sleep.
 */
const { runDemoSuite, spawnServer } = require('./lib/demoServer');
const { apiClient, loginOwner, loginViewer, demoOrderBody, maxId, uuid } = require('./lib/demoClient');
const { IDENTITIES, SEED_TAG_PREFIX } = require('../server/api/demo/demo.rules');

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

const [first, second] = IDENTITIES;

runDemoSuite(async ({ db, target, databaseId }) => {
  const baseline = { order: await maxId(db, 'orders'), product: await maxId(db, 'products') };

  /** Inserts one order directly, `hoursAgo` old; returns its id. */
  async function insertOrder({ identity = first, phone = identity.customer_phone, hoursAgo = 0, requestId = null } = {}) {
    const { rows } = await db.query(
      `INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_method, items, subtotal, delivery_fee, total, status, created_at, request_id)
       VALUES ($1, $2, $3, 'pickup', '[]', 1, 0, 1, 'new', NOW() - make_interval(hours => $4::int), $5) RETURNING id`,
      [identity.customer_name, phone, identity.customer_email, hoursAgo, requestId]
    );
    return rows[0].id;
  }
  const exists = async (id) => (await db.query('SELECT 1 FROM orders WHERE id = $1', [id])).rowCount === 1;
  const ordersAfterBaseline = async () => (await db.query('SELECT COUNT(*)::int AS total FROM orders WHERE id > $1', [baseline.order])).rows[0].total;
  const clearOrders = () => db.query('DELETE FROM orders WHERE id > $1', [baseline.order]);
  /** Everything cleanup must never touch, as one comparable string. */
  const untouched = async () => {
    const parts = [];
    for (const [table, order] of [['products', 'id'], ['reviews', 'id'], ['pigment_formulas', 'id'], ['settings', 'key'], ['demo_database_marker', 'id']]) {
      const { rows } = await db.query(`SELECT md5(COALESCE(string_agg(t::text, '|' ORDER BY t.${order}), '')) AS h FROM ${table} t`);
      parts.push(rows[0].h);
    }
    return parts.join(',');
  };
  /** Starts a server on the same marker, optionally with other settings. */
  const start = (env = {}) => spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: databaseId, ...env });

  // ── startup cleanup: what goes and what stays
  console.log('\n── ניקוי בעלייה (שרת שהתעורר)');
  {
    const expiredNull = await insertOrder({ hoursAgo: 80 });
    const expiredUuid = await insertOrder({ identity: second, hoursAgo: 100, requestId: uuid() });
    const recent = await insertOrder({ hoursAgo: 1 });
    const justUnder = await insertOrder({ hoursAgo: 71 });
    const seeded = await insertOrder({ hoursAgo: 500, requestId: `${SEED_TAG_PREFIX}99` });
    const foreignPhone = await insertOrder({ phone: '052-9999999', hoursAgo: 500 });
    const before = await untouched();

    const woke = await start();
    check('השרת עלה', woke.ok, woke.output());
    check('הזמנות מבקרים שפג תוקפן נמחקו (בלי request_id ועם UUID)', !(await exists(expiredNull)) && !(await exists(expiredUuid)));
    check('הזמנה טרייה ובת 71 שעות נשארות', (await exists(recent)) && (await exists(justUnder)));
    check('הזמנה זרועה (מתויגת) ישנה נשארת', await exists(seeded));
    check('הזמנה בטלפון שאינו של הזהויות נשארת', await exists(foreignPhone));
    check('מוצרים, חוות דעת, גווני פיגמנט, הגדרות והסימון לא שונו', (await untouched()) === before);
    await woke.stop();

    const again = await start();
    const count = await ordersAfterBaseline();
    await again.stop();
    check('הרצה חוזרת אינה משנה דבר', (await ordersAfterBaseline()) === count && count === 4, count);
    await clearOrders();
  }

  // ── a forged tag cannot be created through the API
  console.log('\n── תג מזויף');
  {
    const server = await start();
    const call = apiClient(server.baseUrl);
    const owner = await loginOwner(call);
    const product = (await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר ניקוי', category: 'tools', price: 10, sku: 'TEST-DEMO-CLN' } })).body;
    const forged = await call('POST', '/api/orders', { body: { ...demoOrderBody(product), request_id: `${SEED_TAG_PREFIX}77` } });
    check('request_id בצורת demo-seed:NN נדחה ב-400', forged.status === 400, forged.status);
    const lower = await call('POST', '/api/orders', { body: { ...demoOrderBody(product), request_id: 'not-a-uuid' } });
    check('request_id שאינו UUID v4 נדחה ב-400', lower.status === 400, lower.status);
    check('שום הזמנה לא נשמרה', (await ordersAfterBaseline()) === 0);

    // ── replay of a request_id whose order was purged creates a new order
    console.log('\n── ניסיון חוזר אחרי מחיקה');
    const requestId = uuid();
    const created = await call('POST', '/api/orders', { body: demoOrderBody(product, { requestId }) });
    check('הזמנה עם request_id נוצרה', created.status === 201, created.status);
    await db.query("UPDATE orders SET created_at = NOW() - interval '80 hours' WHERE id = $1", [created.body.id]);
    await server.stop();
    const woke = await start();
    check('ההזמנה שפג תוקפה נמחקה בעלייה', !(await exists(created.body.id)));
    const replay = await apiClient(woke.baseUrl)('POST', '/api/orders', { body: demoOrderBody(product, { requestId }) });
    check('אותו request_id אחרי המחיקה יוצר הזמנה חדשה (201, בלי Idempotent-Replayed)', replay.status === 201 && replay.headers.get('idempotent-replayed') === null && replay.body.id !== created.body.id, [replay.status]);
    await woke.stop();
    await clearOrders();
    await db.query('DELETE FROM products WHERE id > $1', [baseline.product]);
  }

  // ── an admin read wakes the cleanup, throttled
  console.log('\n── ניקוי בקריאת אדמין (מוגבל לפעם בחמש דקות)');
  {
    const server = await start();
    const call = apiClient(server.baseUrl);
    const viewer = await loginViewer(call);
    const expired = await insertOrder({ hoursAgo: 90 });
    const first200 = await call('GET', '/api/orders', { cookie: viewer });
    check('קריאת הרשימה על ידי צופה → 200', first200.status === 200, first200.status);
    check('הקריאה הראשונה אחרי העלייה ניקתה את ההזמנה שפג תוקפה', !(await exists(expired)));
    const second = await insertOrder({ hoursAgo: 90 });
    await call('GET', '/api/orders/stats', { cookie: viewer });
    check('קריאה נוספת בתוך חמש דקות מוגבלת ואינה מנקה', await exists(second));
    await server.stop();
    await clearOrders();
  }

  // ── the cap
  console.log('\n── תקרת הזמנות מבקרים');
  {
    const server = await start({ DEMO_MAX_VISITOR_ORDERS: '2' });
    const call = apiClient(server.baseUrl);
    const owner = await loginOwner(call);
    const product = (await call('POST', '/api/products', { cookie: owner, body: { name: 'מוצר תקרה', category: 'tools', price: 10, sku: 'TEST-DEMO-CAP' } })).body;
    const bodyA = demoOrderBody(product);
    const a = await call('POST', '/api/orders', { body: bodyA });
    const b = await call('POST', '/api/orders', { body: demoOrderBody(product) });
    check('שתי הזמנות ראשונות מתקבלות', a.status === 201 && b.status === 201, [a.status, b.status]);

    const blocked = await call('POST', '/api/orders', { body: demoOrderBody(product) });
    check('ההזמנה השלישית → 429 demo_order_cap', blocked.status === 429 && blocked.body.details?.reason === 'demo_order_cap', [blocked.status, blocked.body]);
    check('לא נשמרה הזמנה מעבר לתקרה', (await ordersAfterBaseline()) === 2);

    const replayAtCap = await call('POST', '/api/orders', { body: bodyA });
    check('ניסיון חוזר של הזמנה קיימת נענה גם בתקרה (200, לא 429)', replayAtCap.status === 200 && replayAtCap.body.id === a.body.id, replayAtCap.status);

    await db.query("UPDATE orders SET created_at = NOW() - interval '80 hours' WHERE id = $1", [b.body.id]);
    const freed = await call('POST', '/api/orders', { body: demoOrderBody(product) });
    check('אחרי ניקוי של הזמנה שפג תוקפה התקרה משתחררת (201)', freed.status === 201, freed.status);
    check('ההזמנה שפג תוקפה נמחקה', !(await exists(b.body.id)));

    // the marker is no longer 'ready': cleanup must delete nothing, so the cap stays
    await db.query("UPDATE orders SET created_at = NOW() - interval '80 hours' WHERE id > $1", [baseline.order]);
    const seededId = await insertOrder({ hoursAgo: 500, requestId: `${SEED_TAG_PREFIX}98` });
    for (const [label, sql] of [
      ["מצב bootstrapping", "UPDATE demo_database_marker SET state = 'bootstrapping'"],
      ['מזהה שונה', "UPDATE demo_database_marker SET id = gen_random_uuid(), state = 'ready'"],
    ]) {
      await db.query(sql);
      const before = await ordersAfterBaseline();
      const res = await call('POST', '/api/orders', { body: demoOrderBody(product) });
      check(`סימון ב${label}: שום הזמנה לא נמחקה ואין הזמנה חדשה`, (await ordersAfterBaseline()) === before && res.status !== 201, [res.status, before]);
    }
    await db.query("UPDATE demo_database_marker SET id = $1, state = 'ready'", [databaseId]);
    check('הזמנה זרועה ישנה לא נמחקה בכל המצבים', await exists(seededId));
    await server.stop();
    await clearOrders();
    await db.query('DELETE FROM products WHERE id > $1', [baseline.product]);
  }

  // ── a bounded batch
  console.log('\n── אצווה מוגבלת');
  {
    await db.query(
      `INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_method, items, subtotal, delivery_fee, total, status, created_at)
       SELECT $1, $2, $3, 'pickup', '[]', 1, 0, 1, 'new', NOW() - interval '90 hours' - (g || ' minutes')::interval
       FROM generate_series(1, 205) g`,
      [first.customer_name, first.customer_phone, first.customer_email]
    );
    const one = await start();
    const left = await ordersAfterBaseline();
    await one.stop();
    check('עלייה אחת מוחקת עד 200 ומשאירה את השאר', left === 5, left);
    const two = await start();
    const rest = await ordersAfterBaseline();
    await two.stop();
    check('העלייה הבאה מסיימת את השאר', rest === 0, rest);
  }

  await clearOrders().catch(() => {});
  await db.query('DELETE FROM products WHERE id > $1', [baseline.product]).catch(() => {});
  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
});
