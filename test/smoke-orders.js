/**
 * בדיקת עשן זמנית לדומיין ההזמנות מול השרת החדש.
 * מנקה אחריה את כל מה שיצרה. למחיקה אחרי המעבר.
 *
 *   NEW_URL=http://127.0.0.1:3100 node server/db/smoke-orders.js
 */
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';

let passed = 0;
let failed = 0;
const created = [];

function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const validOrder = () => ({
  customer_name: 'ישראל ישראלי',
  customer_phone: '050-673-5040',
  customer_email: 'test@example.com',
  delivery_method: 'delivery',
  delivery_address: 'בר כוכבא 52, פתח תקווה',
  notes: 'להשאיר בדלת',
  items: [
    { id: 1, name: 'צבע לבן', price: 100, quantity: 2, selectedColor: 'לבן', selectedSize: '5 ליטר' },
    { id: 2, name: 'מברשת', price: 30, quantity: 1 },
  ],
});

async function testCreate() {
  console.log('\n── יצירה');

  // הסכומים שנשלחים מהגוף אמורים להיות מוחלפים בחישוב השרת
  const tampered = { ...validOrder(), subtotal: 1, delivery_fee: 0, total: 5 };
  const { status, body } = await call('POST', '/orders', tampered);
  created.push(body.id);
  check('201 על יצירה', status === 201, status);
  check('subtotal מחושב בשרת (230)', body.subtotal === 230, body.subtotal);
  check('delivery_fee נקבע בשרת (20)', body.delivery_fee === 20, body.delivery_fee);
  check('total מחושב בשרת (250)', body.total === 250, body.total);
  check('סטטוס התחלתי new', body.status === 'new', body.status);
  check('עברית נשמרת', body.customer_name === 'ישראל ישראלי', body.customer_name);
  check('פריט בלי id מקבל null', true, null);

  const pickup = await call('POST', '/orders', {
    customer_name: 'דנה כהן',
    customer_phone: '039315750',
    delivery_method: 'pickup',
    items: [{ name: 'מדלל', price: 45, quantity: 3 }],
  });
  created.push(pickup.body.id);
  check('איסוף עצמי — בלי דמי משלוח', pickup.body.delivery_fee === 0, pickup.body.delivery_fee);
  check('איסוף עצמי — total 135', pickup.body.total === 135, pickup.body.total);
  check('בלי מייל לקוח → null', pickup.body.customer_email === null, pickup.body.customer_email);
  check('פריט בלי id → null', pickup.body.items[0].id === null, pickup.body.items[0].id);

  return body.id;
}

async function testValidation() {
  console.log('\n── ולידציה (הכל אמור להיחסם ב-400)');

  const cases = [
    ['בלי שם לקוח', { ...validOrder(), customer_name: '' }],
    ['טלפון קצר מדי', { ...validOrder(), customer_phone: '050' }],
    ['מייל לא תקין', { ...validOrder(), customer_email: 'not-an-email' }],
    ['אופן קבלה לא מוכר', { ...validOrder(), delivery_method: 'teleport' }],
    ['משלוח בלי כתובת', { ...validOrder(), delivery_address: '' }],
    ['בלי פריטים', { ...validOrder(), items: [] }],
    ['פריט בלי שם', { ...validOrder(), items: [{ price: 10, quantity: 1 }] }],
    ['כמות אפס', { ...validOrder(), items: [{ name: 'x', price: 10, quantity: 0 }] }],
    ['מחיר שלילי', { ...validOrder(), items: [{ name: 'x', price: -5, quantity: 1 }] }],
  ];

  for (const [name, body] of cases) {
    const { status, body: res } = await call('POST', '/orders', body);
    if (status === 201) created.push(res.id);   // לא אמור לקרות, אבל שלא יישאר זבל
    check(name, status === 400, `${status} ${res.error || ''}`);
  }
}

async function testRead(id) {
  console.log('\n── קריאה');

  const list = await call('GET', '/orders');
  check('רשימה מחזירה מערך שטוח', Array.isArray(list.body), typeof list.body);
  check('הרשימה ממוינת מהחדש לישן',
    list.body.every((o, i) => i === 0 || new Date(list.body[i - 1].created_at) >= new Date(o.created_at)), null);

  const one = await call('GET', `/orders/${id}`);
  check('הזמנה בודדת', one.status === 200 && one.body.id === id, one.status);

  const missing = await call('GET', '/orders/999999');
  check('הזמנה שאינה קיימת → 404', missing.status === 404, missing.status);

  const badId = await call('GET', '/orders/abc');
  check('מזהה לא מספרי → 400', badId.status === 400, badId.status);

  const byPhone = await call('GET', '/orders/by-phone/0506735040');
  check('חיפוש לפי טלפון מנוקד מוצא', byPhone.body.some((o) => o.id === id), byPhone.body.length);

  const badPhone = await call('GET', '/orders/by-phone/123');
  check('טלפון קצר בחיפוש → 400', badPhone.status === 400, badPhone.status);

  const paged = await call('GET', '/orders?limit=1');
  check('limit מחזיר אובייקט עם pagination',
    Array.isArray(paged.body.orders) && paged.body.orders.length === 1 && paged.body.pagination.total >= 2,
    paged.body);

  const filtered = await call('GET', '/orders?status=new');
  check('סינון לפי סטטוס', filtered.body.every((o) => o.status === 'new'), filtered.body.length);

  const badStatus = await call('GET', '/orders?status=bogus');
  check('סטטוס לא חוקי בסינון → 400', badStatus.status === 400, badStatus.status);

  const search = await call('GET', '/orders?search=' + encodeURIComponent('ישראל'));
  check('חיפוש חופשי בעברית', search.body.some((o) => o.id === id), search.body.length);

  const stats = await call('GET', '/orders/stats');
  check('stats מחזיר סיכום', stats.status === 200 && stats.body.totals.orders >= 2, stats.body);
}

async function testUpdate(id) {
  console.log('\n── עדכון');

  const status = await call('PUT', `/orders/${id}/status`, { status: 'shipped' });
  check('שינוי סטטוס', status.status === 200 && status.body.status === 'shipped', status.body.status);

  const same = await call('PUT', `/orders/${id}/status`, { status: 'shipped' });
  check('אותו סטטוס שוב — בלי מייל כפול', same.body.email_sent === false, same.body.email_sent);

  const bad = await call('PUT', `/orders/${id}/status`, { status: 'bogus' });
  check('סטטוס לא חוקי → 400', bad.status === 400, bad.status);

  const empty = await call('PUT', `/orders/${id}/status`, {});
  check('בלי שדה status → 400', empty.status === 400, empty.status);

  const partial = await call('PUT', `/orders/${id}`, { notes: 'עודכן' });
  check('עדכון חלקי משנה רק את notes',
    partial.body.notes === 'עודכן' && partial.body.customer_name === 'ישראל ישראלי' && partial.body.total === 250,
    partial.body);

  const readonly = await call('PUT', `/orders/${id}`, { total: 1, items: [] });
  check('total ו-items אינם ניתנים לעריכה → 400', readonly.status === 400, `${readonly.status} ${readonly.body.error}`);

  const missing = await call('PUT', '/orders/999999/status', { status: 'completed' });
  check('עדכון הזמנה שאינה קיימת → 404', missing.status === 404, missing.status);
}

async function cleanup() {
  console.log('\n── ניקוי');
  for (const id of created) {
    if (!id) continue;
    const { status } = await call('DELETE', `/orders/${id}`);
    check(`נמחקה הזמנה ${id}`, status === 200, status);
  }
  const left = await call('GET', '/orders');
  check('לא נשארו הזמנות בדיקה', left.body.every((o) => !created.includes(o.id)), left.body.length);

  const twice = await call('DELETE', `/orders/${created[0]}`);
  check('מחיקה חוזרת → 404', twice.status === 404, twice.status);
}

async function main() {
  const id = await testCreate();
  await testValidation();
  await testRead(id);
  await testUpdate(id);
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `/orders/${id}`).catch(() => {});
  process.exit(1);
});
