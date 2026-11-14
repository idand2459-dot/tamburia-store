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
const { runHttpSuite } = require('./lib/testServer');
// Set by runHttpSuite: the suite talks only to the server it started itself.
let BASE;

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
  return { status: res.status, headers: res.headers, body: await res.json() };
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

  // the colour and size the orders below choose must be options of the product (P7.4)
  await makeProduct('paint', {
    name: 'צבע לבן בדיקה', price: 100, sku: 'TEST-ORD-PAINT',
    colors: [{ name: 'לבן', hex: '#ffffff' }], sizes: ['5 ליטר'],
  });
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
  customer_phone: '050-000-0000',
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

  // the admin list keeps its phone filter (authenticated; it is not the removed public lookup)
  const byPhone = await call('GET', '/orders?phone=050-000-0000');
  check('the admin phone filter finds the order, with the number normalized',
    byPhone.status === 200 && Array.isArray(byPhone.body) && byPhone.body.some((o) => o.id === id), byPhone.body.length);

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

/**
 * בודק את רשימת הליקוט: סימון, ביטול, שורה והזמנה שאינן קיימות,
 * קלט פסול ובקשה בלי התחברות. הזמנת המשלוח מ-testCreate היא בת
 * שתי שורות, 0 ו-1.
 */
async function testPicked(id) {
  console.log('\n── רשימת ליקוט');
  const pick = (line, picked, orderId = id) => call('PUT', `/orders/${orderId}/items/${line}/picked`, { picked });

  const fresh = await call('GET', `/orders/${id}`);
  check('הזמנה חדשה: אף שורה לא מסומנת',
    Array.isArray(fresh.body.picked_items) && fresh.body.picked_items.length === 0, fresh.body.picked_items);

  const first = await pick(0, true);
  check('סימון שורה 0 → 200, picked_items = [0]',
    first.status === 200 && JSON.stringify(first.body.picked_items) === '[0]', first.body.picked_items);

  const again = await pick(0, true);
  check('סימון חוזר של אותה שורה אינו מכפיל אותה',
    JSON.stringify(again.body.picked_items) === '[0]', again.body.picked_items);

  const both = await pick(1, true);
  check('סימון שורה 1 → [0, 1]', JSON.stringify(both.body.picked_items) === '[0,1]', both.body.picked_items);

  const undo = await pick(0, false);
  check('ביטול שורה 0 → [1]', undo.status === 200 && JSON.stringify(undo.body.picked_items) === '[1]', undo.body.picked_items);

  const kept = await call('GET', `/orders/${id}`);
  check('הסימון נשמר במסד', JSON.stringify(kept.body.picked_items) === '[1]', kept.body.picked_items);
  check('הסימון אינו משנה את הסטטוס', kept.body.status === fresh.body.status, kept.body.status);
  check('הפריטים עצמם לא השתנו', JSON.stringify(kept.body.items) === JSON.stringify(fresh.body.items), kept.body.items);

  const noLine = await pick(2, true);
  check('שורה שאינה קיימת בהזמנה → 404', noLine.status === 404, noLine.status);

  const noOrder = await pick(0, true, 999999);
  check('הזמנה שאינה קיימת → 404', noOrder.status === 404, noOrder.status);

  for (const [name, path, body] of [
    ['מספר שורה לא מספרי → 400', 'abc', { picked: true }],
    ['מספר שורה שלילי → 400', '-1', { picked: true }],
    ['picked כמחרוזת → 400', '0', { picked: 'false' }],
    ['בלי picked → 400', '0', {}],
  ]) {
    const res = await call('PUT', `/orders/${id}/items/${path}/picked`, body);
    check(name, res.status === 400, res.status);
  }

  const saved = authCookie;
  authCookie = null;
  const anon = await pick(0, true);
  authCookie = saved;
  check('בלי התחברות → 401', anon.status === 401, anon.status);
  const after = await call('GET', `/orders/${id}`);
  check('בקשה בלי התחברות לא שינתה דבר', JSON.stringify(after.body.picked_items) === '[1]', after.body.picked_items);
}

/** מספר ההזמנות השמורות כרגע; מוכיח שהזמנה שנדחתה לא כתבה כלום. */
async function storedOrderCount() {
  const res = await call('GET', '/orders');
  return res.body.length;
}

/** מוצר שאזל נדחה ב-409 שהלקוח יודע לזהות, ושום דבר לא נשמר. */
async function testAvailability() {
  console.log('\n── זמינות מלאי (in_stock)');

  await makeProduct('stockout', { name: 'מוצר שאזל בדיקה', price: 60, sku: 'TEST-ORD-STOCKOUT' });
  const order = (items) => ({ ...validOrder(), items });
  const line = (product, extra = {}) => ({ id: product.id, name: product.name, price: product.price, quantity: 1, ...extra });

  const before = await storedOrderCount();
  const inStock = await call('POST', '/orders', order([line(P.stockout)]));
  created.push(inStock.body.id);
  check('מוצר במלאי מתקבל → 201', inStock.status === 201, `${inStock.status} ${inStock.body.error || ''}`);

  await call('PUT', `/products/${P.stockout.id}`, { in_stock: false });

  const refused = await call('POST', '/orders', order([line(P.paint, { price: 100 }), line(P.stockout)]));
  check('מוצר שאזל → 409', refused.status === 409, `${refused.status} ${refused.body.error || ''}`);
  check('התשובה ניתנת לזיהוי: details.reason = out_of_stock',
    refused.body.details?.reason === 'out_of_stock', refused.body.details);
  check('details.unavailable מונה את המוצר שאזל ורק אותו',
    JSON.stringify(refused.body.details?.unavailable?.map((u) => u.id)) === JSON.stringify([P.stockout.id]), refused.body.details);
  check('ההודעה היא ההודעה המוסכמת',
    refused.body.error === `המוצר "${P.stockout.name}" אינו זמין כרגע. ניתן להסיר אותו מהעגלה או ליצור קשר עם החנות לבירור זמינות.`,
    refused.body.error);
  check('גוף התשובה נשאר { error, details }', Object.keys(refused.body).sort().join() === 'details,error', Object.keys(refused.body));

  // זמינות מדווחת לפני מחיר שהשתנה; המחירים נבדקים בניסיון הבא.
  const both = await call('POST', '/orders', order([line(P.paint, { price: 1 }), line(P.stockout)]));
  check('מוצר שאזל ומחיר שהשתנה → דווח קודם על הזמינות',
    both.status === 409 && both.body.details?.reason === 'out_of_stock' && !both.body.details?.prices, both.body.details);
  const next = await call('POST', '/orders', order([line(P.paint, { price: 1 })]));
  check('אחרי הסרת המוצר שאזל — 409 המחיר הרגיל נשמר', next.status === 409 && Array.isArray(next.body.details?.prices), next.body.details);

  const after = await storedOrderCount();
  check('הדחיות לא שמרו הזמנה', after === before + 1, { before, after });

  // בקשה ישירה לא עוקפת את הבדיקה: מצב המוצר במסד מכריע ולא מה שהבקשה טוענת.
  const lying = await call('POST', '/orders', order([{ ...line(P.stockout), in_stock: true, inStock: true }]));
  check('בקשה ישירה שטוענת שהמוצר במלאי נדחית', lying.status === 409, lying.status);

  // הסתרה היא שגיאה ישנה משלה ונשארת 400.
  await call('PUT', `/products/${P.stockout.id}`, { active: false });
  const hidden = await call('POST', '/orders', order([line(P.stockout)]));
  check('מוצר מוסתר נשאר 400', hidden.status === 400, `${hidden.status} ${hidden.body.error || ''}`);
  await call('PUT', `/products/${P.stockout.id}`, { active: true, in_stock: true });

  const back = await call('POST', '/orders', order([line(P.stockout)]));
  created.push(back.body.id);
  check('חזר למלאי → מתקבל שוב', back.status === 201, `${back.status} ${back.body.error || ''}`);
}

/** תקרות הגודל ותקרת NUMERIC(10,2) נענות ב-400 מבוקר, לא ב-500 ממסד הנתונים. */
async function testOrderLimits() {
  console.log('\n── תקרות גודל הזמנה');

  const order = (items, extra = {}) => ({ ...validOrder(), items, ...extra });
  const brush = (quantity = 1) => ({ id: P.brush.id, name: P.brush.name, price: 30, quantity });
  const before = await storedOrderCount();

  const fifty = await call('POST', '/orders', order(Array.from({ length: 50 }, () => brush())));
  created.push(fifty.body.id);
  check('50 שורות → 201', fifty.status === 201 && fifty.body.items.length === 50 && fifty.body.subtotal === 1500,
    `${fifty.status} ${fifty.body.error || ''}`);

  const tooMany = await call('POST', '/orders', order(Array.from({ length: 51 }, () => brush())));
  check('51 שורות → 400', tooMany.status === 400, tooMany.status);
  check('ההודעה מציינת את התקרה', tooMany.body.error === 'ההזמנה יכולה לכלול עד 50 פריטים', tooMany.body.error);

  const max = await call('POST', '/orders', order([brush(999)]));
  created.push(max.body.id);
  check('999 יחידות בשורה → 201 (30 × 999 + 20)', max.status === 201 && max.body.total === 29990,
    `${max.status} ${max.body.error || ''} ${max.body.total}`);

  const over = await call('POST', '/orders', order([brush(1000)]));
  check('1000 יחידות → 400', over.status === 400, over.status);
  check('ההודעה מציינת את התקרה', over.body.error === 'items[0].quantity מוגבל ל-999', over.body.error);

  const zero = await call('POST', '/orders', order([brush(0)]));
  check('כמות 0 עדיין 400 עם ההודעה הקיימת', zero.status === 400 && zero.body.error.includes('מספר שלם חיובי'), zero.body.error);
  const fraction = await call('POST', '/orders', order([brush(1.5)]));
  check('כמות לא שלמה → 400', fraction.status === 400, fraction.status);
  const huge = await call('POST', '/orders', order([brush(1e21)]));
  check('כמות 1e21 → 400 ולא 500', huge.status === 400, huge.status);

  // orders.total הוא NUMERIC(10,2): 99,999,999.99 הוא הערך הגדול ביותר שהוא מחזיק.
  await makeProduct('maxprice', { name: 'מוצר ביוקר מרבי בדיקה', price: 99999999.99, sku: 'TEST-ORD-MAXPRICE' });
  const maxLine = (quantity) => ({ id: P.maxprice.id, name: P.maxprice.name, price: 99999999.99, quantity });
  const pickup = (items) => order(items, { delivery_method: 'pickup', delivery_address: undefined });

  const atLimit = await call('POST', '/orders', pickup([maxLine(1)]));
  if (atLimit.body?.id) created.push(atLimit.body.id);
  check('בדיוק הסכום המרבי באיסוף → 201', atLimit.status === 201 && atLimit.body.total === 99999999.99,
    `${atLimit.status} ${atLimit.body.error || ''}`);

  const withFee = await call('POST', '/orders', order([maxLine(1)]));
  check('הסכום המרבי + דמי משלוח → 400 מבוקר', withFee.status === 400, `${withFee.status} ${withFee.body.error || ''}`);
  check('ההודעה מסבירה את החריגה', typeof withFee.body.error === 'string' && withFee.body.error.includes('חורג'), withFee.body.error);

  const twice = await call('POST', '/orders', pickup([maxLine(2)]));
  check('פעמיים הסכום המרבי → 400, לא 500', twice.status === 400, `${twice.status} ${twice.body.error || ''}`);

  const many = await call('POST', '/orders', pickup(Array.from({ length: 50 }, () => maxLine(999))));
  check('50 שורות × 999 במחיר המרבי → 400, לא 500', many.status === 400, `${many.status} ${many.body.error || ''}`);

  const after = await storedOrderCount();
  check('רק ההזמנות התקינות נשמרו (50 שורות, 999 יחידות, הסכום המרבי)', after === before + 3, { before, after });
}

/** A fresh version-4 request id, like the storefront creates. */
const newRequestId = () => require('crypto').randomUUID();

/** Keys that must never appear in anything the API returns for an order. */
const INTERNAL_KEYS = ['request_id', 'request_hash'];
const hasInternal = (o) => INTERNAL_KEYS.some((key) => key in o);

/**
 * request_id: one order per id, a retry gets the original back, and the database (not the code)
 * decides who wins when requests race.
 */
async function testIdempotency() {
  console.log('\n── idempotency (request_id)');

  const withKey = (key, extra = {}) => ({ ...validOrder(), request_id: key, ...extra });
  const before = await storedOrderCount();

  const key = newRequestId();
  const first = await call('POST', '/orders', withKey(key));
  created.push(first.body.id);
  check('first request with an id → 201', first.status === 201, `${first.status} ${first.body.error || ''}`);
  check('no Idempotent-Replayed header on the first', first.headers.get('idempotent-replayed') === null, null);
  check('the created order does not expose request_id, request_hash or picked_items',
    !hasInternal(first.body) && !('picked_items' in first.body), Object.keys(first.body));

  const again = await call('POST', '/orders', withKey(key));
  check('same id, same order → 200 with the original', again.status === 200 && again.body.id === first.body.id,
    `${again.status} ${again.body.id}`);
  check('marked Idempotent-Replayed', again.headers.get('idempotent-replayed') === 'true', null);
  check('same totals as the original', again.body.total === first.body.total && again.body.subtotal === first.body.subtotal, again.body);
  check('a replay hides request_id, request_hash and picked_items',
    !hasInternal(again.body) && !('picked_items' in again.body), Object.keys(again.body));
  check('a replay reports the email outcome as unknown', again.body.emails?.store === null && again.body.emails?.customer === null, again.body.emails);
  check('no second order was stored', (await storedOrderCount()) === before + 1, null);

  const upper = await call('POST', '/orders', withKey(key.toUpperCase()));
  check('the id is case-insensitive', upper.status === 200 && upper.body.id === first.body.id, upper.status);

  // what an admin does to the order afterwards is not leaked through a replay
  await call('PUT', `/orders/${first.body.id}/items/0/picked`, { picked: true });
  const afterPick = await call('POST', '/orders', withKey(key));
  check('a replay after picking still hides picked_items', afterPick.status === 200 && !('picked_items' in afterPick.body), Object.keys(afterPick.body));

  const stored = await call('GET', `/orders/${first.body.id}`);
  check('the admin read does not expose the internal columns', !hasInternal(stored.body), Object.keys(stored.body));
  const listed = await call('GET', '/orders');
  check('the admin list does not expose them', listed.body.every((o) => !hasInternal(o)), null);

  // the same id with a different order is refused, and the original stays as it was
  const different = await call('POST', '/orders', withKey(key, { customer_name: 'מישהו אחר' }));
  check('same id, different customer → 422', different.status === 422, `${different.status} ${different.body.error || ''}`);
  check('the 422 says why: details.reason', different.body.details?.reason === 'request_id_reused', different.body.details);
  const otherItems = await call('POST', '/orders', withKey(key, { items: [{ id: P.brush.id, name: P.brush.name, price: 30, quantity: 1 }] }));
  check('same id, different items → 422', otherItems.status === 422, otherItems.status);
  const otherColor = await call('POST', '/orders', withKey(key, {
    items: validOrder().items.map((i, n) => (n === 0 ? { ...i, selectedColor: null } : i)),
  }));
  check('same id, a different option → 422', otherColor.status === 422, otherColor.status);
  const unchanged = await call('GET', `/orders/${first.body.id}`);
  check('the 422 left the original order untouched', unchanged.body.customer_name === first.body.customer_name, unchanged.body.customer_name);
  check('and stored nothing', (await storedOrderCount()) === before + 1, null);

  // the id is optional: orders without one are independent, as before
  const plainA = await call('POST', '/orders', validOrder());
  const plainB = await call('POST', '/orders', validOrder());
  created.push(plainA.body.id, plainB.body.id);
  check('without an id every request creates an order', plainA.status === 201 && plainB.status === 201 && plainA.body.id !== plainB.body.id, null);
  check('and its 201 is customer-safe too', !hasInternal(plainA.body) && !('picked_items' in plainA.body), Object.keys(plainA.body));
  const nullKey = await call('POST', '/orders', withKey(null));
  created.push(nullKey.body.id);
  check('request_id: null counts as no id', nullKey.status === 201, nullKey.status);

  // malformed ids are refused before anything is looked up or stored
  const mark = await storedOrderCount();
  for (const bad of ['1', 'abc', '', ' ', 123, {}, [], newRequestId().replace(/-4/, '-1'), `${newRequestId()}x`, 'a'.repeat(300)]) {
    const res = await call('POST', '/orders', withKey(bad));
    check(`malformed request_id ${JSON.stringify(bad).slice(0, 20)} → 400`, res.status === 400, `${res.status} ${res.body.error || ''}`);
  }
  check('malformed ids stored nothing', (await storedOrderCount()) === mark, null);

  // a retry must not be re-priced: the order exists, so a later price change or a sold-out
  // product is not a reason to refuse it
  const priced = newRequestId();
  const line = { id: P.thinner.id, name: P.thinner.name, price: 45, quantity: 1 };
  const original = await call('POST', '/orders', withKey(priced, { items: [line] }));
  created.push(original.body.id);
  check('order for the price/stock replay checks → 201', original.status === 201, original.status);
  await call('PUT', `/products/${P.thinner.id}`, { price: 50 });
  const afterPrice = await call('POST', '/orders', withKey(priced, { items: [line] }));
  check('replay after a price change → 200, not 409', afterPrice.status === 200 && afterPrice.body.id === original.body.id,
    `${afterPrice.status} ${afterPrice.body.error || ''}`);
  check('the replay keeps the original price', afterPrice.body.total === original.body.total, afterPrice.body.total);
  await call('PUT', `/products/${P.thinner.id}`, { in_stock: false });
  const afterStock = await call('POST', '/orders', withKey(priced, { items: [line] }));
  check('replay after the product sold out → 200', afterStock.status === 200 && afterStock.body.id === original.body.id, afterStock.status);
  const fresh = await call('POST', '/orders', withKey(newRequestId(), { items: [line] }));
  check('a new id for that product is refused (409)', fresh.status === 409, fresh.status);
  await call('PUT', `/products/${P.thinner.id}`, { price: 45, in_stock: true });

  // a rejected request leaves no row, so the same id works once the cause is fixed
  const retried = newRequestId();
  const stale = await call('POST', '/orders', withKey(retried, { items: [{ ...line, price: 1 }] }));
  check('a price change is refused (409) and the id is not consumed', stale.status === 409, stale.status);
  const fixed = await call('POST', '/orders', withKey(retried, { items: [line] }));
  created.push(fixed.body.id);
  check('the same id then creates the order', fixed.status === 201, `${fixed.status} ${fixed.body.error || ''}`);
}

/** Requests that race with one id: the unique index lets exactly one of them create the order. */
async function testConcurrentIdempotency() {
  console.log('\n── concurrent requests with one request_id');

  const body = (key, extra = {}) => ({ ...validOrder(), request_id: key, ...extra });
  const before = await storedOrderCount();

  const key = newRequestId();
  const results = await Promise.all(Array.from({ length: 8 }, () => call('POST', '/orders', body(key))));
  const ids = new Set(results.map((r) => r.body.id));
  created.push(...ids);
  const statuses = results.map((r) => r.status).sort();
  check('8 identical concurrent requests → exactly one 201, the rest 200',
    statuses.filter((s) => s === 201).length === 1 && statuses.filter((s) => s === 200).length === 7, statuses);
  check('all of them answer with the same order', ids.size === 1, [...ids]);
  check('one order was stored', (await storedOrderCount()) === before + 1, null);

  // two different orders under one id: one wins, every request for the other is refused
  const raced = newRequestId();
  const orderA = body(raced);
  const orderB = body(raced, { customer_name: 'לקוח אחר' });
  const mixed = await Promise.all([orderA, orderB, orderA, orderB, orderA, orderB].map((o) => call('POST', '/orders', o)));
  const winners = mixed.filter((r) => r.status === 201 || r.status === 200);
  created.push(...new Set(winners.map((r) => r.body.id)));
  const winnerName = winners[0].body.customer_name;
  check('mixed orders: every success is the same order', new Set(winners.map((r) => r.body.id)).size === 1, winners.map((r) => r.body.id));
  check('mixed orders: the others are 422', mixed.every((r) => [200, 201, 422].includes(r.status))
    && mixed.filter((r) => r.status === 422).every((r) => r.body.details?.reason === 'request_id_reused'), mixed.map((r) => r.status));
  check('mixed orders: only the winner\'s payload succeeded',
    winners.every((r) => r.body.customer_name === winnerName), winners.map((r) => r.body.customer_name));
  check('mixed orders: exactly one more order stored', (await storedOrderCount()) === before + 2, null);
}

/** selectedColor and selectedSize must be options of the product; null stays allowed. */
async function testProductOptions() {
  console.log('\n── product options (colour and size)');

  const paint = (extra) => ({
    id: P.paint.id, name: P.paint.name, price: 100, quantity: 1, selectedColor: 'לבן', selectedSize: '5 ליטר', ...extra,
  });
  const order = (items) => ({ ...validOrder(), items });
  const before = await storedOrderCount();

  const valid = await call('POST', '/orders', order([paint()]));
  created.push(valid.body.id);
  check('an option the product defines → 201', valid.status === 201, `${valid.status} ${valid.body.error || ''}`);

  const bundle = await call('POST', '/orders', order([paint({ selectedColor: null, selectedSize: null })]));
  created.push(bundle.body.id);
  check('null colour and size (a calculator bundle line) → 201', bundle.status === 201, `${bundle.status} ${bundle.body.error || ''}`);
  const omitted = await call('POST', '/orders', order([{ id: P.paint.id, name: P.paint.name, price: 100, quantity: 1 }]));
  created.push(omitted.body.id);
  check('options left out → 201', omitted.status === 201, omitted.status);

  const badColor = await call('POST', '/orders', order([paint({ selectedColor: 'ירוק' })]));
  check('a colour the product does not have → 409', badColor.status === 409, `${badColor.status} ${badColor.body.error || ''}`);
  check('details.reason = option_unavailable', badColor.body.details?.reason === 'option_unavailable', badColor.body.details);
  const listedLine = badColor.body.details?.unavailable?.[0];
  check('details.unavailable names the line', listedLine?.id === P.paint.id && listedLine.selectedColor === 'ירוק'
    && listedLine.selectedSize === '5 ליטר' && listedLine.name === P.paint.name, badColor.body.details);
  check('body stays { error, details }', Object.keys(badColor.body).sort().join() === 'details,error', Object.keys(badColor.body));

  const badSize = await call('POST', '/orders', order([paint({ selectedSize: '99 ליטר' })]));
  check('a size the product does not have → 409', badSize.status === 409 && badSize.body.details?.reason === 'option_unavailable', badSize.status);

  const noOptions = await call('POST', '/orders', order([{ id: P.brush.id, name: P.brush.name, price: 30, quantity: 1, selectedColor: 'לבן' }]));
  check('a colour on a product that defines none → 409', noOptions.status === 409, noOptions.status);

  const many = await call('POST', '/orders', order([paint({ selectedColor: 'ירוק' }), paint({ selectedSize: 'x' }), paint()]));
  check('every bad line is listed, the good one is not', many.status === 409 && many.body.details?.unavailable?.length === 2, many.body.details);

  const staleToo = await call('POST', '/orders', order([paint({ selectedColor: 'ירוק', price: 1 })]));
  check('an option is reported before a changed price', staleToo.body.details?.reason === 'option_unavailable', staleToo.body.details);

  const long = await call('POST', '/orders', order([paint({ selectedColor: 'א'.repeat(101) })]));
  check('an over-long option → 400', long.status === 400, long.status);

  check('rejected orders stored nothing', (await storedOrderCount()) === before + 3, null);

  // an order saved with an option the catalog no longer has stays readable
  const read = await call('GET', `/orders/${valid.body.id}`);
  await call('PUT', `/products/${P.paint.id}`, { colors: [{ name: 'כחול', hex: '#0000ff' }] });
  const reread = await call('GET', `/orders/${valid.body.id}`);
  check('an existing order keeps its option after the catalog changes',
    reread.status === 200 && reread.body.items[0].selectedColor === read.body.items[0].selectedColor, reread.body.items);
  await call('PUT', `/products/${P.paint.id}`, { colors: [{ name: 'לבן', hex: '#ffffff' }] });
}

/**
 * The public order lookup is gone (P8.2): no route matches it, with or without the admin cookie and
 * under any spelling of the path, and every order route that remains is for the admin only.
 */
async function testNoPublicLookup(id) {
  console.log('\n── no public order lookup');
  const saved = authCookie;
  const phone = '0500000000';

  const paths = [
    `/orders/by-phone/${phone}`, `/orders/by-phone/050-000-0000`, `/orders/by-phone/${phone}/`,
    `/orders/by-phone/${phone}?phone=${phone}`, `/orders/BY-PHONE/${phone}`, `/orders/lookup/${phone}`,
    `/orders/phone/${phone}`, `/orders/by-phone/${phone}/${id}`,
  ];
  for (const withAdmin of [false, true]) {
    authCookie = withAdmin ? saved : null;
    for (const path of paths) {
      const res = await call('GET', path);
      check(`GET ${path} → 404${withAdmin ? ' (admin)' : ''}`, res.status === 404 && !Array.isArray(res.body), `${res.status}`);
      check(`GET ${path} returns no order data${withAdmin ? ' (admin)' : ''}`,
        !JSON.stringify(res.body).includes('customer_'), Object.keys(res.body));
    }
    const post = await call('POST', `/orders/by-phone/${phone}`, { phone });
    check(`POST /orders/by-phone → 404${withAdmin ? ' (admin)' : ''}`, post.status === 404, post.status);
    const lookup = await call('POST', '/orders/lookup', { order_id: id, phone });
    check(`POST /orders/lookup → 404${withAdmin ? ' (admin)' : ''}`, lookup.status === 404, lookup.status);
  }

  // A one-segment path can only match /:id, which is admin only: never data, with or without a session.
  authCookie = null;
  const bare = await call('GET', '/orders/by-phone');
  check('GET /orders/by-phone matches only /:id: 401 without a session', bare.status === 401, bare.status);
  authCookie = saved;
  const bareAdmin = await call('GET', '/orders/by-phone');
  check('GET /orders/by-phone as admin is a bad id (400), not a list',
    bareAdmin.status === 400 && !Array.isArray(bareAdmin.body), bareAdmin.status);

  // the remaining order routes still need the admin session
  authCookie = null;
  const admin = [
    ['GET', '/orders'], ['GET', '/orders?phone=' + phone], ['GET', '/orders/stats'], ['GET', `/orders/${id}`],
    ['PUT', `/orders/${id}`, { notes: 'x' }], ['PUT', `/orders/${id}/status`, { status: 'processing' }],
    ['PUT', `/orders/${id}/items/0/picked`, { picked: true }], ['DELETE', `/orders/${id}`],
  ];
  for (const [method, path, body] of admin) {
    const res = await call(method, path, body);
    check(`${method} ${path} without a session → 401`, res.status === 401 && !JSON.stringify(res.body).includes('customer_'), res.status);
  }
  authCookie = saved;
  const still = await call('GET', `/orders/${id}`);
  check('the order is untouched and the admin still reads it', still.status === 200 && still.body.id === id, still.status);
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
  await testAvailability();
  await testOrderLimits();
  await testProductOptions();
  await testIdempotency();
  await testConcurrentIdempotency();
  await testUpdate(deliveryId);
  await testPicked(deliveryId);
  await testNoPublicLookup(deliveryId);
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

runHttpSuite(async (baseUrl) => {
  BASE = baseUrl + '/api';
  await main();
}, async () => {
  for (const id of created) if (id) await call('DELETE', `/orders/${id}`).catch(() => {});
  for (const id of createdProducts) if (id) await call('DELETE', `/products/${id}`).catch(() => {});
});
