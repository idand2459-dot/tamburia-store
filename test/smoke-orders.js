/**
 * בודק את דומיין ההזמנות מקצה לקצה: יצירה, ולידציה, קריאה,
 * עדכון ומחיקה. מנקה בסוף כל רשומה שיצר.
 *
 * הבדיקה פותחת בארבעה מוצרים משלה. זה לא נוי: מאז שהמחירים נקבעים
 * מהקטלוג, הזמנה חייבת להצביע על מוצרים אמיתיים, ובדיקה שתישען על
 * מוצרים שבמסד תשנה משמעות ברגע שמישהו יערוך להם את המחיר. המספרים
 * כאן — 100, 30, 45 ו-250/700 לגרסאות — הם מה שכל טענה על subtotal
 * ו-total נגזרת ממנו.
 */
const { login } = require('./helpers');
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';

let passed = 0;
let failed = 0;
const created = [];
const createdProducts = [];

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

let authCookie = null;

/** שולח בקשה ל-API עם עוגיית האדמין שהתקבלה בהתחברות. */
async function call(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (authCookie) headers.Cookie = authCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/* המוצרים שהבדיקה יוצרת לעצמה, לפי מפתח. מתמלא ב-setupProducts. */
const P = {};

/** יוצר מוצר בדיקה ומחזיר אותו, אחרי שרשם אותו לניקוי. */
async function makeProduct(key, body) {
  const { status, body: product } = await call('POST', '/products', {
    category: 'tools', ...body,
  });
  createdProducts.push(product.id);
  check(`נוצר מוצר בדיקה "${body.name}"`, status === 201, `${status} ${product.error || ''}`);
  P[key] = product;
  return product;
}

/** יוצר את המוצרים שכל שאר הבדיקות מזמינות. */
async function setupProducts() {
  console.log('\n── מוצרי בדיקה');

  await makeProduct('paint', { name: 'צבע לבן בדיקה', price: 100, sku: 'TEST-ORD-PAINT' });
  await makeProduct('brush', { name: 'מברשת בדיקה', price: 30, sku: 'TEST-ORD-BRUSH' });
  await makeProduct('thinner', { name: 'מדלל בדיקה', price: 45, sku: 'TEST-ORD-THINNER' });
  await makeProduct('roller', { name: 'רולר בדיקה', price: 12.9, sku: 'TEST-ORD-ROLLER' });

  // מוצר עם גרסאות: המחיר של המוצר עצמו נגזר מהזולה שבהן
  await makeProduct('bucket', {
    name: 'דלי בדיקה',
    sku: 'TEST-ORD-BUCKET',
    // price חובה ביצירה גם כשיש גרסאות, והוא נדרס בזולה שבהן
    price: 0,
    variants: [{ label: "5 ל'", price: 250 }, { label: "18 ל'", price: 700 }],
  });
  check('מחיר מוצר עם גרסאות הוא הזולה שבהן', P.bucket.price === 250, P.bucket.price);
}

const validOrder = () => ({
  customer_name: 'ישראל ישראלי',
  customer_phone: '050-673-5040',
  customer_email: 'test@example.com',
  delivery_method: 'delivery',
  delivery_address: 'בר כוכבא 52, פתח תקווה',
  notes: 'להשאיר בדלת',
  items: [
    { id: P.paint.id, name: P.paint.name, price: 100, quantity: 2, selectedColor: 'לבן', selectedSize: '5 ליטר' },
    { id: P.brush.id, name: P.brush.name, price: 30, quantity: 1 },
  ],
});

/** בודק יצירה: ערכים שנשמרים, ברירות מחדל ושדות שהשרת קובע. */
async function testCreate() {
  console.log('\n── יצירה');

  const tampered = { ...validOrder(), subtotal: 1, delivery_fee: 0, total: 5 };
  const { status, body } = await call('POST', '/orders', tampered);
  created.push(body.id);
  check('201 על יצירה', status === 201, status);
  check('subtotal מחושב בשרת (230)', body.subtotal === 230, body.subtotal);
  check('delivery_fee נקבע בשרת (20)', body.delivery_fee === 20, body.delivery_fee);
  check('total מחושב בשרת (250)', body.total === 250, body.total);
  check('סטטוס התחלתי new', body.status === 'new', body.status);
  check('עברית נשמרת', body.customer_name === 'ישראל ישראלי', body.customer_name);
  check('המחירים שנשמרו הם של הקטלוג',
    body.items[0].price === 100 && body.items[1].price === 30,
    body.items.map((i) => i.price));

  const pickup = await call('POST', '/orders', {
    customer_name: 'דנה כהן',
    customer_phone: '039315750',
    delivery_method: 'pickup',
    items: [{ id: P.thinner.id, name: P.thinner.name, price: 45, quantity: 3 }],
  });
  created.push(pickup.body.id);
  check('איסוף עצמי — בלי דמי משלוח', pickup.body.delivery_fee === 0, pickup.body.delivery_fee);
  check('איסוף עצמי — total 135', pickup.body.total === 135, pickup.body.total);
  check('בלי מייל לקוח → null', pickup.body.customer_email === null, pickup.body.customer_email);

  return { deliveryId: body.id, pickupId: pickup.body.id };
}

/** בודק שכל קלט פסול נדחה בקוד 400. */
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
    if (status === 201) created.push(res.id);
    check(name, status === 400, `${status} ${res.error || ''}`);
  }
}

/** בודק שליפה בודדת, מזהים שאינם קיימים וקלט לא תקין. */
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

/**
 * בודק שהסטטוס חייב להתאים לאופן הקבלה.
 *
 * "מוכנה לאיסוף" קיים רק להזמנת איסוף עצמי ו"נשלחה" רק להזמנת משלוח.
 * הקליינט כבר מציע רק את המתאימים, ולכן הבדיקה כאן היא שהשרת דוחה גם
 * בקשה שעקפה אותו — בשני מסלולי העדכון, גם /status וגם העדכון הכללי.
 */
async function testStatusRules(pickupId, deliveryId) {
  console.log('\n── סטטוס מול אופן קבלה');

  const pickupWalk = ['processing', 'ready_for_pickup', 'completed'];
  for (const status of pickupWalk) {
    const res = await call('PUT', `/orders/${pickupId}/status`, { status });
    check(`איסוף עצמי → ${status}`, res.status === 200 && res.body.status === status, `${res.status} ${res.body.status}`);
  }

  const deliveryWalk = ['processing', 'shipped', 'completed'];
  for (const status of deliveryWalk) {
    const res = await call('PUT', `/orders/${deliveryId}/status`, { status });
    check(`משלוח → ${status}`, res.status === 200 && res.body.status === status, `${res.status} ${res.body.status}`);
  }

  const pickupShipped = await call('PUT', `/orders/${pickupId}/status`, { status: 'shipped' });
  check('איסוף עצמי → נשלחה → 400', pickupShipped.status === 400, `${pickupShipped.status} ${pickupShipped.body.error}`);

  const deliveryReady = await call('PUT', `/orders/${deliveryId}/status`, { status: 'ready_for_pickup' });
  check('משלוח → מוכנה לאיסוף → 400', deliveryReady.status === 400, `${deliveryReady.status} ${deliveryReady.body.error}`);

  // אותו כלל דרך העדכון הכללי, שאינו עובר ב-parseStatus
  const viaUpdate = await call('PUT', `/orders/${pickupId}`, { status: 'shipped' });
  check('נשלחה דרך עדכון כללי על איסוף → 400', viaUpdate.status === 400, `${viaUpdate.status} ${viaUpdate.body.error}`);

  const stillCompleted = await call('GET', `/orders/${pickupId}`);
  check('הבקשה שנדחתה לא שינתה את הסטטוס', stillCompleted.body.status === 'completed', stillCompleted.body.status);

  // החלפת אופן הקבלה ביחד עם הסטטוס נבדקת על המצב שאחרי המיזוג
  const bothAtOnce = await call('PUT', `/orders/${pickupId}`, {
    delivery_method: 'delivery', delivery_address: 'בר כוכבא 52, פתח תקווה', status: 'shipped',
  });
  check('החלפת אופן קבלה וסטטוס יחד — מותר', bothAtOnce.status === 200 && bothAtOnce.body.status === 'shipped',
    `${bothAtOnce.status} ${bothAtOnce.body.error || bothAtOnce.body.status}`);
}

/** בודק עדכון חלקי ואת הכללים שאסור לעקוף. */
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

/**
 * בודק שהזמנה על מוצר בלי מחיר נדחית.
 *
 * במסד יש מוצרים שהמחיר שלהם 0 — מוצר שהמחיר שלו עוד לא הוקלד — ועד
 * שהבדיקה הזו נוספה אפשר היה להזמין אותם, וגם נוצרו הזמנות כאלה. שתי
 * הבדיקות כאן הן שני הצדדים של אותו כלל: המחיר שבמסד הוא הקובע לגבי
 * המוצר, גם כשהבקשה נוקבת בסכום אחר, והמחיר שנשלח הוא מה שיש לגבי
 * פריט בלי מזהה.
 *
 * המוצר נוצר כאן ולא נשען על אחד מ-124 המוצרים שבמסד: בדיקה שתלויה
 * בנתונים אמיתיים מפסיקה לבדוק ברגע שמישהו יקליד את המחיר.
 */
async function testZeroPrice() {
  console.log('\n── מוצר בלי מחיר');

  const product = await makeProduct('free', {
    name: 'מוצר בדיקה בלי מחיר', price: 0, sku: 'TEST-NO-PRICE',
  });
  check('נוצר מוצר במחיר 0', product.price === 0, product.price);

  const order = (items) => ({ ...validOrder(), items });

  // הבקשה נוקבת ב-99, המסד אומר 0 — המסד מנצח
  const lying = await call('POST', '/orders', order([
    { id: product.id, name: product.name, price: 99, quantity: 1 },
  ]));
  check('מוצר שהמחיר שלו במסד 0 → 400', lying.status === 400, lying.status);
  check('ההודעה בעברית ונוקבת בשם המוצר',
    typeof lying.body.error === 'string' && lying.body.error.includes('מוצר בדיקה בלי מחיר'),
    lying.body.error);
  check('לא נוצרה הזמנה', lying.body.id === undefined, lying.body.id);

  const zero = await call('POST', '/orders', order([
    { id: product.id, name: product.name, price: 0, quantity: 1 },
  ]));
  check('אותו מוצר במחיר 0 → 400', zero.status === 400, zero.status);

  // פריט תקין אחד לא מציל הזמנה שיש בה פריט בלי מחיר
  const mixed = await call('POST', '/orders', order([
    { id: P.brush.id, name: P.brush.name, price: 30, quantity: 1 },
    { id: product.id, name: product.name, price: 50, quantity: 1 },
  ]));
  check('פריט אחד בלי מחיר פוסל את כל ההזמנה', mixed.status === 400, mixed.status);

  // ומצד שני: אחרי שהוקלד מחיר, אותה הזמנה בדיוק עוברת
  await call('PUT', `/products/${product.id}`, { price: 50 });
  const fixed = await call('POST', '/orders', order([
    { id: product.id, name: product.name, price: 50, quantity: 1 },
  ]));
  created.push(fixed.body.id);
  check('אחרי הקלדת מחיר — 201', fixed.status === 201, fixed.status);
  check('הסכום מחושב מהפריט (50 + 20 משלוח)', fixed.body.total === 70, fixed.body.total);
}

/**
 * בודק שהמחיר נקבע בשרת ולא בבקשה.
 *
 * זו הבדיקה של הפרצה עצמה: עד שנסגרה, המחיר של כל פריט הגיע מגוף
 * הבקשה והסכומים חוברו ממנו, כך ש-POST ישיר יכול היה לקנות דלי צבע
 * בשקל. שני הכיוונים נבדקים — מחיר נמוך מזויף ומחיר גבוה מזויף —
 * כי הכלל אינו "אל תשלמו פחות" אלא "הלקוח מאשר בדיוק את מה שראה".
 */
async function testServerPricing() {
  console.log('\n── המחיר נקבע בשרת');

  const order = (items) => ({ ...validOrder(), items });

  const cheap = await call('POST', '/orders', order([
    { id: P.paint.id, name: P.paint.name, price: 1, quantity: 1 },
  ]));
  check('מחיר נמוך מזויף → 409', cheap.status === 409, `${cheap.status} ${cheap.body.error || ''}`);
  check('ההודעה נוקבת במחיר האמיתי',
    typeof cheap.body.error === 'string' && cheap.body.error.includes('100'), cheap.body.error);
  check('התשובה נושאת את המחיר העדכני לתיקון העגלה',
    cheap.body.details?.prices?.[0]?.price === 100, cheap.body.details);
  check('לא נוצרה הזמנה במחיר מזויף', cheap.body.id === undefined, cheap.body.id);

  const dear = await call('POST', '/orders', order([
    { id: P.paint.id, name: P.paint.name, price: 5000, quantity: 1 },
  ]));
  check('מחיר גבוה מזויף → 409', dear.status === 409, dear.status);

  // שם מזויף אינו משנה דבר: גם הוא נלקח מהקטלוג
  const renamed = await call('POST', '/orders', order([
    { id: P.brush.id, name: 'מברשת זהב', price: 30, quantity: 1 },
  ]));
  created.push(renamed.body.id);
  check('השם בהזמנה מגיע מהקטלוג', renamed.body.items[0].name === P.brush.name, renamed.body.items[0].name);

  const noId = await call('POST', '/orders', order([{ name: 'פריט מומצא', price: 10, quantity: 1 }]));
  check('פריט בלי מזהה → 400', noId.status === 400, noId.status);

  const ghost = await call('POST', '/orders', order([
    { id: 999999, name: 'מוצר שנמחק', price: 10, quantity: 1 },
  ]));
  check('מזהה שאינו בקטלוג → 400', ghost.status === 400, ghost.status);
}

/**
 * בודק מחיר עשרוני בהזמנה: ההשוואה למסד והסכומים נעשים באגורות.
 *
 * שני הבאגים שזה סוגר: הוולידטור עיגל את המחיר שהלקוח שלח (12.90 →
 * 13) וההשוואה ב-!== דחתה אותו ב-409 על מחיר שלא השתנה; וסכום של
 * float — 3 × 12.9 — יצא 38.699999999999996.
 */
async function testDecimalPricing() {
  console.log('\n── מחיר עשרוני');

  const order = (items) => ({ ...validOrder(), items });

  const three = await call('POST', '/orders', order([
    { id: P.roller.id, name: P.roller.name, price: 12.9, quantity: 3 },
  ]));
  created.push(three.body.id);
  check('12.9 מול 12.90 במסד → 201 ולא 409', three.status === 201, `${three.status} ${three.body.error || ''}`);
  check('המחיר בהזמנה 12.9', three.body.items?.[0]?.price === 12.9, three.body.items?.[0]?.price);
  check('subtotal מדויק באגורה (38.7)', three.body.subtotal === 38.7, three.body.subtotal);
  check('total מדויק באגורה (58.7)', three.body.total === 58.7, three.body.total);

  const read = await call('GET', `/orders/${three.body.id}`);
  check('הסכומים חוזרים מהמסד כמספרים', read.body.subtotal === 38.7 && read.body.total === 58.7,
    { subtotal: read.body.subtotal, total: read.body.total });

  // אותו מחיר, כתוב אחרת — עדיין אותו מחיר
  const asString = await call('POST', '/orders', order([
    { id: P.roller.id, name: P.roller.name, price: '12.90', quantity: 1 },
  ]));
  created.push(asString.body.id);
  check('"12.90" כמחרוזת → 201', asString.status === 201, `${asString.status} ${asString.body.error || ''}`);

  const offByAgora = await call('POST', '/orders', order([
    { id: P.roller.id, name: P.roller.name, price: 12.91, quantity: 1 },
  ]));
  check('אגורה אחת הפרש → 409', offByAgora.status === 409, offByAgora.status);
  check('ההודעה מציגה ₪12.90 עם שתי ספרות',
    typeof offByAgora.body.error === 'string' && offByAgora.body.error.includes('₪12.90'), offByAgora.body.error);
  check('המחיר העדכני חוזר כמספר', offByAgora.body.details?.prices?.[0]?.price === 12.9, offByAgora.body.details);

  const tooPrecise = await call('POST', '/orders', order([
    { id: P.roller.id, name: P.roller.name, price: 12.901, quantity: 1 },
  ]));
  check('שלוש ספרות אחרי הנקודה → 400', tooPrecise.status === 400, tooPrecise.status);
}

/** בודק שמוצר עם גרסאות מתומחר לפי הגרסה שנבחרה. */
async function testVariantPricing() {
  console.log('\n── תמחור לפי גרסה');

  const order = (items) => ({ ...validOrder(), items });

  const big = await call('POST', '/orders', order([
    { id: P.bucket.id, name: P.bucket.name, price: 700, quantity: 1, selectedVariant: "18 ל'" },
  ]));
  created.push(big.body.id);
  check('הגרסה היקרה מתומחרת לפיה', big.status === 201 && big.body.items[0].price === 700,
    `${big.status} ${big.body.error || big.body.items?.[0]?.price}`);
  check('total לפי הגרסה (700 + 20 משלוח)', big.body.total === 720, big.body.total);
  check('תווית הגרסה נשמרת בהזמנה',
    big.body.items[0].selectedVariant === "18 ל'", big.body.items[0].selectedVariant);

  // המחיר של הגרסה הזולה אינו תקף לגרסה היקרה
  const wrongPrice = await call('POST', '/orders', order([
    { id: P.bucket.id, name: P.bucket.name, price: 250, quantity: 1, selectedVariant: "18 ל'" },
  ]));
  check('מחיר של גרסה אחרת → 409', wrongPrice.status === 409, wrongPrice.status);

  const fake = await call('POST', '/orders', order([
    { id: P.bucket.id, name: P.bucket.name, price: 1, quantity: 1, selectedVariant: "100 ל'" },
  ]));
  check('תווית גרסה שאינה קיימת → 400', fake.status === 400, `${fake.status} ${fake.body.error || ''}`);
  check('ההודעה נוקבת בתווית',
    typeof fake.body.error === 'string' && fake.body.error.includes("100 ל'"), fake.body.error);

  // בלי בחירת גרסה נופלים למחיר המוצר, שהוא הזולה שבגרסאות
  const noVariant = await call('POST', '/orders', order([
    { id: P.bucket.id, name: P.bucket.name, price: 250, quantity: 1 },
  ]));
  created.push(noVariant.body.id);
  check('בלי גרסה — מחיר המוצר (הזולה)', noVariant.body.items[0].price === 250, noVariant.body.items[0].price);
}

/**
 * בודק שכל הזמנה שנשמרה תואמת לקטלוג.
 *
 * לא מקרה קצה אלא הטענה הכוללת: אחרי כל מה שנוצר כאן, אין במסד
 * הזמנת בדיקה שמחיר של פריט בה אינו המחיר שבקטלוג, ואין אחת
 * שהסכום שלה אינו סכום השורות.
 *
 * דמי המשלוח נלקחים מהרשומה ולא מחושבים מחדש מאופן הקבלה:
 * הם נקבעים ביצירה ואינם משתנים כשמסך הניהול מחליף אחר כך את אופן
 * הקבלה, כי הזמנה שנשמרה היא רשומה היסטורית. על הערך הנכון
 * שלהם ביצירה נטען ב-testCreate.
 */
async function testSavedTotalsMatch() {
  console.log('\n── הסכומים שנשמרו');

  for (const id of created) {
    if (!id) continue;
    const { body: order } = await call('GET', `/orders/${id}`);
    if (!order || !Array.isArray(order.items)) continue;

    for (const item of order.items) {
      const { body: product } = await call('GET', `/products/${item.id}`);
      const variant = item.selectedVariant
        ? (product.variants || []).find((v) => v.label === item.selectedVariant)
        : null;
      const expected = variant ? variant.price : product.price;
      check(`הזמנה ${id}: "${item.name}" נשמר במחיר שבקטלוג`,
        item.price === expected, { saved: item.price, catalogue: expected });
    }

    // באגורות, כמו בשרת: 3 × 12.9 ב-float אינו 38.7
    const agorot = (value) => Math.round(value * 100);
    const subtotal = order.items.reduce((sum, i) => sum + agorot(i.price) * i.quantity, 0) / 100;
    check(`הזמנה ${id}: subtotal ו-total מתיישבים עם השורות`,
      agorot(order.subtotal) === agorot(subtotal)
        && agorot(order.total) === agorot(subtotal) + agorot(order.delivery_fee),
      { subtotal: order.subtotal, fee: order.delivery_fee, total: order.total, fromItems: subtotal });
  }
}

/** מוחק את כל מה שהבדיקה יצרה ומאמת שלא נשארו שאריות. */
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

  for (const id of createdProducts) {
    if (!id) continue;
    const { status } = await call('DELETE', `/products/${id}`);
    check(`נמחק מוצר בדיקה ${id}`, status === 200, status);
  }
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  await setupProducts();
  const { deliveryId, pickupId } = await testCreate();
  await testValidation();
  await testRead(deliveryId);
  await testStatusRules(pickupId, deliveryId);
  await testZeroPrice();
  await testServerPricing();
  await testVariantPricing();
  await testDecimalPricing();
  await testSavedTotalsMatch();
  await testUpdate(deliveryId);
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `/orders/${id}`).catch(() => {});
  for (const id of createdProducts) if (id) await call('DELETE', `/products/${id}`).catch(() => {});
  process.exit(1);
});
