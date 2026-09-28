/**
 * בודק את services/order.service.js בבידוד: בלי HTTP, בלי מסד ובלי
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

const SERVICE_PATH = path.resolve(__dirname, '../server/services/order.service.js');
const MODEL_PATH = path.resolve(__dirname, '../server/models/order.model.js');
const MAILER_PATH = path.resolve(__dirname, '../server/services/email/index.js');
const PRICING_PATH = path.resolve(__dirname, '../server/services/pricing.service.js');

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
 *
 * digitsOnly מקבל את ההתנהגות האמיתית (השמטת כל מה שאינו ספרה),
 * כי הבדיקה כאן היא שהשירות מעביר הלאה את התוצאה המנורמלת.
 */
function loadService({ order = {}, mail = {}, pricing = {} } = {}) {
  const Order = {
    findById: spy(null),
    findByPhone: spy([]),
    create: spy(null),
    update: spy(null),
    remove: spy(null),
    list: spy([]),
    count: spy(0),
    statsByStatus: spy([]),
    digitsOnly: spy((value) => String(value).replace(/\D/g, '')),
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

  const created = sampleOrder();
  const { service, Order, mailer, pricing } = loadService({ order: { create: spy(created) } });

  const data = { customer_name: 'ישראל ישראלי', items: [{ name: 'צבע', price: 100, quantity: 1 }] };
  const result = await service.createOrder(data);

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

  const degraded = await failing.service.createOrder(data);
  check('emails מדווח false כששליחה נכשלה',
    degraded.emails.store === false && degraded.emails.customer === false, degraded.emails);
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

/** findOrdersByPhone — נרמול ובדיקת אורך לפני הפנייה למודל. */
async function testFindOrdersByPhone() {
  console.log('\n── findOrdersByPhone');

  const short = loadService();
  const err = await captureError(() => short.service.findOrdersByPhone('123'));
  check('טלפון קצר → 400', err && err.status === 400, err && err.status);
  check('טלפון קצר — לא פונים למודל',
    short.Order.findByPhone.calls.length === 0, short.Order.findByPhone.calls.length);

  const orders = [sampleOrder()];
  const ok = loadService({ order: { findByPhone: spy(orders) } });
  const result = await ok.service.findOrdersByPhone('050-673-5040');
  check('טלפון מנוקד עובר נרמול לפני החיפוש',
    ok.Order.findByPhone.calls[0][0] === '0506735040', ok.Order.findByPhone.calls[0]);
  check('מוחזרות ההזמנות מהמודל', result === orders, result);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  await testCreateOrder();
  await testUpdateOrder();
  await testUpdateOrderStatus();
  await testStatusFitsDeliveryMethod();
  await testRemoveOrder();
  await testFindOrdersByPhone();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
