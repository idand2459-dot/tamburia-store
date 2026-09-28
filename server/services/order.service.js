/**
 * הלוגיקה העסקית של ההזמנות: מתי נשלח מייל ללקוח, מה נחשב הזמנה
 * שאינה קיימת, ומה מוחזר לקורא. הקונטרולר שמעל רק מתרגם HTTP.
 *
 * כישלון בשליחת מייל אינו מכשיל את הפעולה — services/email מחזיר
 * { sent, reason? } ואינו זורק, ולכן הזמנה נשמרת גם כשהמייל לא יצא.
 */
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const mailer = require('./email');
const { broadcast } = require('./realtime');
const {
  assertDeliveryCityAllowed, assertDeliveryAddressPresent,
  assertStatusFitsDeliveryMethod,
} = require('../validators/order.validator');
const { badRequest, notFound } = require('../utils/AppError');

/**
 * המחיר שהחנות תכבד עבור מוצר, או null כשאין לה מחיר עבורו.
 *
 * אותו כלל של client/src/js/utils/pricing.js, בצד השני: גרסה מתומחרת
 * אחת מספיקה כדי שלמוצר יהיה מחיר, ובלי גרסאות קובע המחיר של המוצר
 * עצמו. 0 אינו מחיר — הוא סימן שהמחיר עוד לא הוקלד.
 */
function shopPrice(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const priced = variants
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (priced.length > 0) return Math.min(...priced);

  const price = Number(product.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** ההודעה שהלקוח מקבל על פריט שאין לו מחיר. */
function noPriceError(name) {
  return badRequest(
    `לא ניתן להזמין את "${name}" — המחיר שלו עוד לא עודכן באתר. `
    + 'אנא הסירו אותו מהעגלה והתקשרו לחנות לבירור מחיר'
  );
}

/**
 * זורק 400 כשההזמנה כוללת פריט שאין לו מחיר.
 *
 * במסד יש מוצרים שהמחיר שלהם 0, והחנות לא יכולה למכור אותם. עד עכשיו
 * אפשר היה להזמין אותם: הקליינט הציג "₪0", חיבר אותם לסכום, וההזמנה
 * נשמרה — כך נוצרו שלוש הזמנות עם שורות ב-0. עכשיו החנות משיבה 400.
 *
 * שתי בדיקות ולא אחת, כי המחיר שהלקוח שולח והמחיר שבמסד הם שני
 * דברים. המסד הוא הקובע לגבי המוצר עצמו, והמחיר שנשלח הוא הראיה
 * היחידה שיש לגבי הגרסה שנבחרה — asItems אינה שומרת את שם הגרסה.
 * לפריט בלי מזהה (חבילה של מחשבון) אין מה לבדוק במסד, ונשארת
 * הבדיקה על מה שנשלח.
 *
 * מוצר שנמחק אינו נדחה כאן: אין מחיר במסד להשוות אליו, וזו בעיה
 * אחרת מזו שהבדיקה הזו באה לפתור.
 */
async function assertItemsPriced(items) {
  const ids = [...new Set(items.map((item) => item.id).filter(Boolean))];
  const rows = await Product.findPricesByIds(ids);
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const item of items) {
    const product = item.id ? byId.get(item.id) : null;
    if (product && shopPrice(product) === null) throw noPriceError(product.name);
    if (item.price === 0) throw noPriceError(item.name);
  }
}

/** שולף הזמנה או זורק 404. משמש כל פעולה שדורשת הזמנה קיימת. */
async function requireOrder(id) {
  const order = await Order.findById(id);
  if (!order) throw notFound(`הזמנה ${id} לא נמצאה`);
  return order;
}

/**
 * מחזיר הזמנות לפי אפשרויות הסינון.
 * total מחושב רק כשהתבקש דפדוף, כדי לא להוסיף שאילתת ספירה מיותרת.
 */
async function listOrders(options) {
  const orders = await Order.list(options);

  const wantsPagination = options.limit !== undefined || options.offset !== undefined;
  const total = wantsPagination ? await Order.count(options) : undefined;

  return { orders, total };
}

/** מחזיר הזמנה בודדת, או זורק 404. */
function getOrder(id) {
  return requireOrder(id);
}

/** מחזיר את ההזמנות של מספר טלפון, אחרי נרמול ובדיקת תקינות. */
async function findOrdersByPhone(rawPhone) {
  const phone = Order.digitsOnly(rawPhone);
  if (phone.length < 9) throw badRequest('מספר טלפון לא תקין');
  return Order.findByPhone(phone);
}

/**
 * יוצר הזמנה, משדר אותה למסכי הניהול הפתוחים ומודיע לחנות וללקוח.
 * מחזיר את ההזמנה יחד עם מה שעלה בגורל שני המיילים.
 *
 * השידור הוא החלטה עסקית ולכן הוא כאן ולא בקונטרולר: רק השכבה הזו
 * יודעת שהזמנה *נוצרה בהצלחה*. הוא סינכרוני, לא מחכה לאיש ואינו
 * חלק מ-Promise.all של המיילים — שידור אינו אמור לעכב תשובה ללקוח.
 */
async function createOrder(data) {
  await assertItemsPriced(data.items);

  const order = await Order.create(data);

  broadcast('order:created', { id: order.id, total: order.total });

  const [store, customer] = await Promise.all([
    mailer.sendNewOrderToStore(order),
    mailer.sendOrderConfirmationToCustomer(order),
  ]);

  return { ...order, emails: { store: store.sent, customer: customer.sent } };
}

/**
 * מעדכן פרטי הזמנה. מייל ללקוח נשלח רק אם העדכון כלל סטטוס
 * והסטטוס באמת השתנה — עדכון הערות לבדו לא מטריד את הלקוח.
 */
async function updateOrder(id, data) {
  const existing = await requireOrder(id);

  // בדיקות המשלוח על המצב שאחרי המיזוג, ולא על גוף הבקשה בלבד.
  // עדכון יכול לשנות רק את הכתובת, או רק את אופן הקבלה, ואז הוולידטור
  // לבדו אינו יודע מה הערך השני — רק כאן יש גם את ההזמנה הקיימת.
  // קודם האם יש כתובת בכלל, ורק אחר כך אם היא באזור החלוקה.
  const method = data.delivery_method ?? existing.delivery_method;
  const address = 'delivery_address' in data ? data.delivery_address : existing.delivery_address;
  assertDeliveryAddressPresent(method, address);
  assertDeliveryCityAllowed(method, address);

  // מאותה סיבה: עדכון יכול להחליף את אופן הקבלה, את הסטטוס, או את
  // שניהם, ורק כאן ידוע מה יהיה הזיווג אחרי הכתיבה.
  if (data.status) assertStatusFitsDeliveryMethod(data.status, method);

  const order = await Order.update(id, data);

  if (data.status && data.status !== existing.status) {
    await mailer.sendStatusUpdateToCustomer(order, data.status);
  }

  return order;
}

/**
 * משנה סטטוס הזמנה ומעדכן את הלקוח. סטטוס שאינו מתאים לאופן הקבלה
 * של ההזמנה נדחה ב-400 לפני שנכתב דבר.
 * כשהסטטוס נשלח שוב באותו ערך הכתיבה מתבצעת כרגיל, אבל המייל
 * נחסם — אחרת לחיצה כפולה במסך הניהול הייתה שולחת ללקוח כפילות.
 */
async function updateOrderStatus(id, status) {
  const existing = await requireOrder(id);
  assertStatusFitsDeliveryMethod(status, existing.delivery_method);

  const order = await Order.update(id, { status });

  // TODO: replace with project logger
  console.log(`סטטוס הזמנה #${order.id}: ${existing.status} → ${status}`);

  const mail = status === existing.status
    ? { sent: false, reason: 'הסטטוס לא השתנה' }
    : await mailer.sendStatusUpdateToCustomer(order, status);

  return { ...order, email_sent: mail.sent };
}

/** מוחק הזמנה ומחזיר אותה, או זורק 404 אם לא הייתה. */
async function removeOrder(id) {
  const order = await Order.remove(id);
  if (!order) throw notFound(`הזמנה ${id} לא נמצאה`);
  return order;
}

/** מחזיר סיכום הזמנות והכנסות לפי סטטוס, עם שורת סך-הכל. */
async function getStats() {
  const byStatus = await Order.statsByStatus();

  return {
    byStatus,
    totals: {
      orders: byStatus.reduce((sum, row) => sum + row.orders, 0),
      revenue: byStatus.reduce((sum, row) => sum + row.revenue, 0),
    },
  };
}

module.exports = {
  listOrders,
  getOrder,
  findOrdersByPhone,
  createOrder,
  updateOrder,
  updateOrderStatus,
  removeOrder,
  getStats,
};
