/**
 * בודק את api/order/order.service.js בבידוד: בלי HTTP, בלי מסד ובלי
 * מיילים. המודל ושירות המייל מוחלפים בכפילים שמתעדים איך נקראו.
 *
 * למה בנפרד מחבילות ה-smoke: שם הכל נבדק דרך הרשת מקצה לקצה, ולכן
 * אפשר לראות רק מה חזר. כאן אפשר לבדוק גם מה *נקרא* — שהמייל לא
 * נשלח כשהסטטוס לא השתנה, ושכשההזמנה אינה קיימת בכלל לא מגיעים
 * לעדכון. אלה בדיוק ההחלטות שהשירות אחראי להן.
 *
 * ההחלפה נעשית בהזרקה ל-require.cache לפי הנתיב המוחלט, לפני
 * שהשירות נטען. אין כאן ספריית mocking — הפרויקט בכוונה בלי
 * תלויות בדיקה, והחבילה הזו לא תהיה הראשונה להוסיף אחת.
 */
const path = require('path');
const Module = require('module');

const SERVICE_PATH = path.resolve(__dirname, '../server/api/order/order.service.js');
const MODEL_PATH = path.resolve(__dirname, '../server/api/order/order.repository.js');
const MAILER_PATH = path.resolve(__dirname, '../server/services/email/index.js');
const PRICING_PATH = path.resolve(__dirname, '../server/api/order/pricing.service.js');

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

/** עוטף ערך או מימוש בפונקציה שמתעדת את הקריאות אליה. */
function spy(result) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return typeof result === 'function' ? result(...args) : result;
  };
  fn.calls = calls;
  return fn;
}

/** מכניס מודול מזויף ל-require.cache תחת נתיב מוחלט נתון. */
function injectFake(resolvedPath, fakeExports) {
  const fake = new Module(resolvedPath);
  fake.exports = fakeExports;
  fake.loaded = true;
  require.cache[resolvedPath] = fake;
}

/**
 * טוען את השירות מחדש מעל כפילים טריים ומחזיר אותם יחד איתו.
 * מחיקת השירות מה-cache הכרחית: בלעדיה הייתה חוזרת ההרצה הקודמת,
 * שכבר קשורה לכפילים של הבדיקה הקודמת.
 */
function loadService({ order = {}, mail = {}, pricing = {} } = {}) {
  const Order = {
    findById: spy(null),
    create: spy(null),
    createOnce: spy(null),
    findByRequestId: spy(null),
    update: spy(null),
    remove: spy(null),
    list: spy([]),
    count: spy(0),
    statsByStatus: spy([]),
    ...order,
  };

  const mailer = {
    sendNewOrderToStore: spy({ sent: true }),
    sendOrderConfirmationToCustomer: spy({ sent: true }),
    sendStatusUpdateToCustomer: spy({ sent: true }),
    ...mail,
  };

  /* תמחור שמעביר הלאה את מה שקיבל. תמחור אמיתי שולף מהמסד,
     והחבילה הזו בודקת את ההחלטות של שירות ההזמנות בלבד. התמחור
     עצמו נבדק מקצה לקצה ב-smoke-orders, מול מוצרים אמיתיים. */
  const pricingService = { priceOrder: spy((data) => data), ...pricing };

  injectFake(MODEL_PATH, Order);
  injectFake(MAILER_PATH, mailer);
  injectFake(PRICING_PATH, pricingService);
  delete require.cache[SERVICE_PATH];

  return { service: require(SERVICE_PATH), Order, mailer, pricing: pricingService };
}

/** מריץ פונקציה ומחזיר את השגיאה שנזרקה, או null אם לא נזרקה. */
async function captureError(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
}

/* delivery_method הוא חלק מהצילום ולא קישוט: השירות בודק מול הסטטוס
   מה אופן הקבלה של ההזמנה הקיימת, ובמסד העמודה NOT NULL. */
const sampleOrder = (over = {}) => ({
  id: 7,
  customer_name: 'ישראל ישראלי',
  customer_phone: '0501234567',
  delivery_method: 'delivery',
  delivery_address: 'בר כוכבא 52, פתח תקווה',
  status: 'new',
  total: 250,
  ...over,
});

/** createOrder — יצירה ושני המיילים הנלווים. */
async function testCreateOrder() {
  console.log('\n── createOrder');

  const created = { ...sampleOrder(), picked_items: [] };
  const { service, Order, mailer, pricing } = loadService({ order: { create: spy(created) } });

  const data = { customer_name: 'ישראל ישראלי', items: [{ name: 'צבע', price: 100, quantity: 1 }] };
  const { order: result, replayed } = await service.createOrder(data);

  check('בלי request_id זו לא הפעלה חוזרת', replayed === false, replayed);
  check('בלי request_id לא מחפשים מזהה ולא כותבים בהגנה', Order.findByRequestId.calls.length === 0
    && Order.createOnce.calls.length === 0, null);
  check('Order.create נקרא פעם אחת', Order.create.calls.length === 1, Order.create.calls.length);
  check('Order.create קיבל את מה שהתמחור החזיר',
    Order.create.calls[0][0] === data, Order.create.calls[0][0]);
  check('התמחור רץ לפני הכתיבה, על אותם נתונים',
    pricing.priceOrder.calls.length === 1 && pricing.priceOrder.calls[0][0] === data,
    pricing.priceOrder.calls.length);

  check('מייל לחנות נשלח פעם אחת',
    mailer.sendNewOrderToStore.calls.length === 1, mailer.sendNewOrderToStore.calls.length);
  check('מייל ללקוח נשלח פעם אחת',
    mailer.sendOrderConfirmationToCustomer.calls.length === 1,
    mailer.sendOrderConfirmationToCustomer.calls.length);
  check('שני המיילים קיבלו את ההזמנה שנוצרה',
    mailer.sendNewOrderToStore.calls[0][0] === created
      && mailer.sendOrderConfirmationToCustomer.calls[0][0] === created,
    null);

  check('ההזמנה מוחזרת עם שדותיה', result.id === 7 && result.total === 250, result);
  check('picked_items אינו חלק מהתשובה ללקוח, והמיילים קיבלו את ההזמנה כמות שנשמרה',
    !('picked_items' in result) && 'picked_items' in mailer.sendNewOrderToStore.calls[0][0], Object.keys(result));
  check('emails משקף את תוצאת השליחה',
    result.emails.store === true && result.emails.customer === true, result.emails);

  // כישלון שליחה אינו אמור להפיל את היצירה — services/email אינו זורק.
  const failing = loadService({
    order: { create: spy(created) },
    mail: {
      sendNewOrderToStore: spy({ sent: false, reason: 'כתובת חסרה' }),
      sendOrderConfirmationToCustomer: spy({ sent: false, reason: 'אין מייל ללקוח' }),
    },
  });
  const err = await captureError(() => failing.service.createOrder(data));
  check('מייל שנכשל אינו זורק', err === null, err && err.message);

  const { order: degraded } = await failing.service.createOrder(data);
  check('emails מדווח false כששליחה נכשלה',
    degraded.emails.store === false && degraded.emails.customer === false, degraded.emails);
}

const REQUEST_ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';

/** הזמנה כפי שהוולידטור מחזיר אותה, עם מזהה בקשה. */
const parsedOrder = (over = {}) => ({
  customer_name: 'ישראל ישראלי',
  customer_phone: '0501234567',
  customer_email: 'a@example.com',
  delivery_method: 'pickup',
  delivery_address: null,
  notes: null,
  items: [{ id: 1, name: 'צבע', price: 100, quantity: 2, selectedVariant: null, selectedColor: 'לבן', selectedSize: null }],
  status: 'new',
  request_id: REQUEST_ID,
  ...over,
});

/** ההזמנה כפי שה-INSERT מחזיר אותה: בלי request_hash, עם picked_items. */
const storedOrder = (over = {}) => ({ ...sampleOrder({ delivery_method: 'pickup' }), picked_items: [], ...over });

/** createOrder עם request_id — יצירה חד-פעמית והפעלה חוזרת. */
async function testIdempotentCreate() {
  console.log('\n── createOrder עם request_id');

  // יצירה ראשונה: ה-hash נכתב עם השורה, ושליחה רצה פעם אחת
  const first = loadService({ order: { findByRequestId: spy(null), createOnce: spy(storedOrder()) } });
  const data = parsedOrder();
  const created = await first.service.createOrder(data);
  const written = first.Order.createOnce.calls[0][0];
  check('מחפשים את המזהה לפני התמחור', first.Order.findByRequestId.calls[0][0] === REQUEST_ID, null);
  check('נכתב עם request_id ו-request_hash של 64 תווים',
    written.request_id === REQUEST_ID && /^[0-9a-f]{64}$/.test(written.request_hash), written.request_hash);
  check('יצירה ראשונה אינה הפעלה חוזרת', created.replayed === false, created.replayed);
  check('נשלחו שני מיילים', first.mailer.sendNewOrderToStore.calls.length === 1
    && first.mailer.sendOrderConfirmationToCustomer.calls.length === 1, null);

  // הפעלה חוזרת: אותו מזהה ואותו גוף → ההזמנה המקורית, בלי תמחור ומיילים
  const hash = written.request_hash;
  const existing = { ...storedOrder({ picked_items: [0, 1] }), request_hash: hash };
  const replay = loadService({ order: { findByRequestId: spy(existing), createOnce: spy(null) } });
  const again = await replay.service.createOrder(parsedOrder());
  check('הפעלה חוזרת מוחזרת כ-replayed', again.replayed === true, again.replayed);
  check('ההזמנה המקורית מוחזרת', again.order.id === 7 && again.order.total === 250, again.order);
  check('picked_items לא נחשף בהפעלה חוזרת', !('picked_items' in again.order), Object.keys(again.order));
  check('request_hash ו-request_id לא נחשפים', !('request_hash' in again.order) && !('request_id' in again.order), Object.keys(again.order));
  check('emails לא ידוע בהפעלה חוזרת', again.order.emails.store === null && again.order.emails.customer === null, again.order.emails);
  check('בלי תמחור מחדש', replay.pricing.priceOrder.calls.length === 0, replay.pricing.priceOrder.calls.length);
  check('בלי כתיבה', replay.Order.createOnce.calls.length === 0 && replay.Order.create.calls.length === 0, null);
  check('בלי מיילים', replay.mailer.sendNewOrderToStore.calls.length === 0
    && replay.mailer.sendOrderConfirmationToCustomer.calls.length === 0, null);

  // אותו מזהה עם גוף אחר → 422, ואין החזרה של הזמנה זרה
  const other = loadService({ order: { findByRequestId: spy(existing), createOnce: spy(null) } });
  const differentItems = parsedOrder({ items: [{ ...parsedOrder().items[0], quantity: 3 }] });
  const err = await captureError(() => other.service.createOrder(differentItems));
  check('מזהה שנעשה בו שימוש עם גוף אחר → 422', err && err.status === 422, err && err.status);
  check('עם reason ייעודי', err && err.details && err.details.reason === 'request_id_reused', err && err.details);
  check('בלי תמחור ובלי כתיבה', other.pricing.priceOrder.calls.length === 0 && other.Order.createOnce.calls.length === 0, null);

  // כל שדה בגוף משנה את ה-hash (צבע ושם לקוח לדוגמה); המזהה עצמו לא
  const hashOf = async (over) => {
    const s = loadService({ order: { findByRequestId: spy(null), createOnce: spy(storedOrder()) } });
    await s.service.createOrder(parsedOrder(over));
    return s.Order.createOnce.calls[0][0].request_hash;
  };
  const base = await hashOf({});
  check('אותו גוף → אותו hash', base === hash, null);
  check('שם לקוח אחר → hash אחר', (await hashOf({ customer_name: 'אחר' })) !== base, null);
  check('צבע אחר → hash אחר', (await hashOf({ items: [{ ...parsedOrder().items[0], selectedColor: 'שחור' }] })) !== base, null);
  check('מזהה אחר → אותו hash (המזהה אינו חלק מהתוכן)', (await hashOf({ request_id: '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6d' })) === base, null);

  // מרוץ: ה-INSERT לא החזיר שורה כי בקשה מקבילה ניצחה
  const winnerRow = { ...storedOrder(), request_hash: hash };
  // the first lookup (before pricing) finds nothing; the one after the lost INSERT finds the winner
  const afterLoss = () => {
    let lookups = 0;
    return spy(() => (lookups++ === 0 ? null : winnerRow));
  };
  const racing = loadService({ order: { findByRequestId: afterLoss(), createOnce: spy(null) } });
  const lost = await racing.service.createOrder(parsedOrder());
  check('הפסד במרוץ מחזיר את הזמנת המנצחת', lost.replayed === true && lost.order.id === 7, lost);
  check('ההפסד במרוץ לא שולח מיילים ולא משדר', racing.mailer.sendNewOrderToStore.calls.length === 0
    && racing.mailer.sendOrderConfirmationToCustomer.calls.length === 0, null);

  const differentLoser = loadService({ order: { findByRequestId: afterLoss(), createOnce: spy(null) } });
  const loserErr = await captureError(() => differentLoser.service.createOrder(differentItems));
  check('הפסד במרוץ עם גוף אחר → 422', loserErr && loserErr.status === 422, loserErr && loserErr.status);

  // תמחור שנדחה אינו משאיר דבר
  const rejected = loadService({
    order: { findByRequestId: spy(null), createOnce: spy(storedOrder()) },
    pricing: { priceOrder: spy(() => { const e = new Error('409'); e.status = 409; throw e; }) },
  });
  const rejectedErr = await captureError(() => rejected.service.createOrder(parsedOrder()));
  check('דחיית תמחור → לא נכתב דבר', rejectedErr && rejected.Order.createOnce.calls.length === 0, null);
}

/** updateOrder — מתי נשלח מייל סטטוס ומתי לא. */
async function testUpdateOrder() {
  console.log('\n── updateOrder');

  // הזמנה שאינה קיימת
  const missing = loadService({ order: { findById: spy(null) } });
  const err = await captureError(() => missing.service.updateOrder(999, { status: 'shipped' }));
  check('הזמנה שאינה קיימת זורקת', err !== null, err);
  check('השגיאה היא 404', err && err.status === 404, err && err.status);
  check('לא מעדכנים הזמנה שאינה קיימת',
    missing.Order.update.calls.length === 0, missing.Order.update.calls.length);
  check('לא שולחים מייל על הזמנה שאינה קיימת',
    missing.mailer.sendStatusUpdateToCustomer.calls.length === 0,
    missing.mailer.sendStatusUpdateToCustomer.calls.length);

  // אותו סטטוס
  const existing = sampleOrder({ status: 'shipped' });
  const unchanged = loadService({
    order: { findById: spy(existing), update: spy(sampleOrder({ status: 'shipped' })) },
  });
  await unchanged.service.updateOrder(7, { status: 'shipped' });
  check('סטטוס זהה — ההזמנה בכל זאת מתעדכנת',
    unchanged.Order.update.calls.length === 1, unchanged.Order.update.calls.length);
  check('סטטוס זהה — בלי מייל',
    unchanged.mailer.sendStatusUpdateToCustomer.calls.length === 0,
    unchanged.mailer.sendStatusUpdateToCustomer.calls.length);

  // סטטוס שהשתנה
  const updatedOrder = sampleOrder({ status: 'completed' });
  const changed = loadService({
    order: { findById: spy(sampleOrder({ status: 'shipped' })), update: spy(updatedOrder) },
  });
  const result = await changed.service.updateOrder(7, { status: 'completed' });
  check('סטטוס שהשתנה — מייל אחד',
    changed.mailer.sendStatusUpdateToCustomer.calls.length === 1,
    changed.mailer.sendStatusUpdateToCustomer.calls.length);
  check('המייל קיבל את ההזמנה המעודכנת ואת הסטטוס החדש',
    changed.mailer.sendStatusUpdateToCustomer.calls[0][0] === updatedOrder
      && changed.mailer.sendStatusUpdateToCustomer.calls[0][1] === 'completed',
    changed.mailer.sendStatusUpdateToCustomer.calls[0]);
  check('מוחזרת ההזמנה המעודכנת', result === updatedOrder, result);

  // עדכון בלי סטטוס בכלל
  const noStatus = loadService({
    order: { findById: spy(existing), update: spy(sampleOrder({ notes: 'עודכן' })) },
  });
  await noStatus.service.updateOrder(7, { notes: 'עודכן' });
  check('עדכון בלי שדה status — בלי מייל',
    noStatus.mailer.sendStatusUpdateToCustomer.calls.length === 0,
    noStatus.mailer.sendStatusUpdateToCustomer.calls.length);
}

/** updateOrderStatus — כולל המקרה שבו הסטטוס נשלח שוב באותו ערך. */
async function testUpdateOrderStatus() {
  console.log('\n── updateOrderStatus');

  // אותו סטטוס
  const same = loadService({
    order: {
      findById: spy(sampleOrder({ status: 'shipped' })),
      update: spy(sampleOrder({ status: 'shipped' })),
    },
  });
  const sameResult = await same.service.updateOrderStatus(7, 'shipped');
  check('סטטוס זהה — email_sent false', sameResult.email_sent === false, sameResult.email_sent);
  check('סטטוס זהה — המייל לא נקרא כלל',
    same.mailer.sendStatusUpdateToCustomer.calls.length === 0,
    same.mailer.sendStatusUpdateToCustomer.calls.length);
  check('סטטוס זהה — ההזמנה מוחזרת עם שדותיה',
    sameResult.id === 7 && sameResult.status === 'shipped', sameResult);

  // סטטוס שהשתנה
  const updatedOrder = sampleOrder({ status: 'completed' });
  const changed = loadService({
    order: { findById: spy(sampleOrder({ status: 'shipped' })), update: spy(updatedOrder) },
  });
  const changedResult = await changed.service.updateOrderStatus(7, 'completed');
  check('סטטוס שהשתנה — מייל אחד',
    changed.mailer.sendStatusUpdateToCustomer.calls.length === 1,
    changed.mailer.sendStatusUpdateToCustomer.calls.length);
  check('Order.update קיבל את הסטטוס החדש',
    changed.Order.update.calls[0][1].status === 'completed', changed.Order.update.calls[0][1]);
  check('email_sent משקף את תוצאת השליחה',
    changedResult.email_sent === true, changedResult.email_sent);

  // שליחה שנכשלה
  const failing = loadService({
    order: { findById: spy(sampleOrder({ status: 'shipped' })), update: spy(updatedOrder) },
    mail: { sendStatusUpdateToCustomer: spy({ sent: false, reason: 'אין מייל מוגדר' }) },
  });
  const failed = await failing.service.updateOrderStatus(7, 'completed');
  check('שליחה שנכשלה — email_sent false ובלי שגיאה',
    failed.email_sent === false, failed.email_sent);

  // הזמנה שאינה קיימת
  const missing = loadService({ order: { findById: spy(null) } });
  const err = await captureError(() => missing.service.updateOrderStatus(999, 'completed'));
  check('הזמנה שאינה קיימת → 404', err && err.status === 404, err && err.status);
  check('לא מעדכנים סטטוס להזמנה שאינה קיימת',
    missing.Order.update.calls.length === 0, missing.Order.update.calls.length);
}

/**
 * הכלל שסטטוס חייב להתאים לאופן הקבלה, בשני מסלולי העדכון.
 *
 * מה שאפשר לראות כאן ולא בחבילת ה-smoke: שכשהזיווג פסול בכלל לא
 * מגיעים ל-Order.update ולא למייל — הבקשה נדחית לפני שנכתב דבר.
 */
async function testStatusFitsDeliveryMethod() {
  console.log('\n── סטטוס מול אופן קבלה');

  const pickup = sampleOrder({ delivery_method: 'pickup', delivery_address: null });

  // נשלחה על הזמנת איסוף עצמי
  const shippedOnPickup = loadService({ order: { findById: spy(pickup) } });
  const err1 = await captureError(() => shippedOnPickup.service.updateOrderStatus(7, 'shipped'));
  check('איסוף עצמי → נשלחה זורק 400', err1 && err1.status === 400, err1 && err1.status);
  check('הזיווג הפסול לא הגיע לכתיבה',
    shippedOnPickup.Order.update.calls.length === 0, shippedOnPickup.Order.update.calls.length);
  check('הזיווג הפסול לא שלח מייל',
    shippedOnPickup.mailer.sendStatusUpdateToCustomer.calls.length === 0,
    shippedOnPickup.mailer.sendStatusUpdateToCustomer.calls.length);

  // מוכנה לאיסוף על הזמנת משלוח
  const readyOnDelivery = loadService({ order: { findById: spy(sampleOrder()) } });
  const err2 = await captureError(() => readyOnDelivery.service.updateOrderStatus(7, 'ready_for_pickup'));
  check('משלוח → מוכנה לאיסוף זורק 400', err2 && err2.status === 400, err2 && err2.status);
  check('גם כאן בלי כתיבה',
    readyOnDelivery.Order.update.calls.length === 0, readyOnDelivery.Order.update.calls.length);

  // הזיווגים המותרים עוברים
  const readyOnPickup = loadService({
    order: { findById: spy(pickup), update: spy({ ...pickup, status: 'ready_for_pickup' }) },
  });
  const okReady = await readyOnPickup.service.updateOrderStatus(7, 'ready_for_pickup');
  check('איסוף עצמי → מוכנה לאיסוף עובר', okReady.status === 'ready_for_pickup', okReady.status);

  const shippedOnDelivery = loadService({
    order: { findById: spy(sampleOrder()), update: spy(sampleOrder({ status: 'shipped' })) },
  });
  const okShipped = await shippedOnDelivery.service.updateOrderStatus(7, 'shipped');
  check('משלוח → נשלחה עובר', okShipped.status === 'shipped', okShipped.status);

  // completed משותף לשני המסלולים
  const completedOnPickup = loadService({
    order: { findById: spy(pickup), update: spy({ ...pickup, status: 'completed' }) },
  });
  const okDone = await completedOnPickup.service.updateOrderStatus(7, 'completed');
  check('הושלמה מותר בשני המסלולים', okDone.status === 'completed', okDone.status);

  // ובמסלול העדכון הכללי הבדיקה היא על המצב שאחרי המיזוג: הבקשה
  // מחליפה את אופן הקבלה, ולכן הסטטוס נמדד מול החדש ולא מול הקיים
  const switching = loadService({
    order: {
      findById: spy(pickup),
      update: spy({ ...pickup, delivery_method: 'delivery', status: 'shipped' }),
    },
  });
  const merged = await switching.service.updateOrder(7, {
    delivery_method: 'delivery', delivery_address: 'בר כוכבא 52, פתח תקווה', status: 'shipped',
  });
  check('החלפת אופן קבלה וסטטוס יחד נמדדת על המצב הממוזג',
    merged.status === 'shipped', merged.status);

  const stillPickup = loadService({ order: { findById: spy(pickup) } });
  const err3 = await captureError(() => stillPickup.service.updateOrder(7, { status: 'shipped' }));
  check('עדכון כללי בלי החלפת אופן קבלה → 400', err3 && err3.status === 400, err3 && err3.status);
}

/** removeOrder — מחיקה מוצלחת מול הזמנה שאינה קיימת. */
async function testRemoveOrder() {
  console.log('\n── removeOrder');

  const removed = sampleOrder();
  const ok = loadService({ order: { remove: spy(removed) } });
  const result = await ok.service.removeOrder(7);
  check('מוחזרת ההזמנה שנמחקה', result === removed, result);
  check('Order.remove קיבל את המזהה', ok.Order.remove.calls[0][0] === 7, ok.Order.remove.calls[0]);

  const missing = loadService({ order: { remove: spy(null) } });
  const err = await captureError(() => missing.service.removeOrder(999));
  check('מחיקה של הזמנה שאינה קיימת → 404', err && err.status === 404, err && err.status);
}

/** The public order lookup was removed (P8.2): the service offers no way to read orders by phone. */
function testNoPublicLookup() {
  console.log('\n── no public lookup');

  const { service } = loadService();
  const names = Object.keys(service);
  check('the service has no lookup by phone', !names.some((name) => /phone/i.test(name)), names);
  check('the service exports exactly the order operations',
    JSON.stringify(names.sort()) === JSON.stringify([
      'createOrder', 'getOrder', 'getStats', 'listOrders', 'removeOrder',
      'setItemPicked', 'updateOrder', 'updateOrderStatus',
    ]), names);
}

/** setItemPicked — רשימת הליקוט. */
async function testSetItemPicked() {
  console.log('\n── setItemPicked');

  const twoLines = sampleOrder({ items: [{ name: 'א' }, { name: 'ב' }], picked_items: [] });

  const ok = loadService({ order: { findById: spy(twoLines), setLinePicked: spy({ ...twoLines, picked_items: [1] }) } });
  const result = await ok.service.setItemPicked(7, 1, true);
  check('שורה קיימת: המודל מקבל (id, line, picked)',
    JSON.stringify(ok.Order.setLinePicked.calls[0]) === '[7,1,true]', ok.Order.setLinePicked.calls[0]);
  check('מוחזרת ההזמנה המעודכנת', JSON.stringify(result.picked_items) === '[1]', result.picked_items);
  check('הסימון אינו נוגע בסטטוס ואינו שולח מייל',
    ok.Order.update.calls.length === 0 && ok.mailer.sendStatusUpdateToCustomer.calls.length === 0, null);

  const outOfRange = loadService({ order: { findById: spy(twoLines), setLinePicked: spy(twoLines) } });
  const err = await captureError(() => outOfRange.service.setItemPicked(7, 2, true));
  check('שורה מעבר לסוף ההזמנה → 404', err && err.status === 404, err && err.status);
  check('ולא פונים למודל לכתיבה', outOfRange.Order.setLinePicked.calls.length === 0, outOfRange.Order.setLinePicked.calls.length);

  const missing = loadService({ order: { setLinePicked: spy(null) } });
  const gone = await captureError(() => missing.service.setItemPicked(9, 0, true));
  check('הזמנה שאינה קיימת → 404', gone && gone.status === 404, gone && gone.status);

  const raced = loadService({ order: { findById: spy(twoLines), setLinePicked: spy(null) } });
  const deleted = await captureError(() => raced.service.setItemPicked(7, 0, true));
  check('הזמנה שנמחקה בין הקריאה לכתיבה → 404', deleted && deleted.status === 404, deleted && deleted.status);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  await testCreateOrder();
  await testIdempotentCreate();
  await testUpdateOrder();
  await testUpdateOrderStatus();
  await testStatusFitsDeliveryMethod();
  await testRemoveOrder();
  testNoPublicLookup();
  await testSetItemPicked();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
