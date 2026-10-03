/**
 * הלוגיקה העסקית של ההזמנות: מתי נשלח מייל ללקוח, מה נחשב הזמנה
 * שאינה קיימת, ומה מוחזר לקורא. הקונטרולר שמעל רק מתרגם HTTP.
 *
 * כישלון בשליחת מייל אינו מכשיל את הפעולה — services/email מחזיר
 * { sent, reason? } ואינו זורק, ולכן הזמנה נשמרת גם כשהמייל לא יצא.
 */
const Order = require('../models/order.model');
const { priceOrder } = require('./pricing.service');
const mailer = require('./email');
const { broadcast } = require('./realtime');
const {
  assertDeliveryCityAllowed, assertDeliveryAddressPresent,
  assertStatusFitsDeliveryMethod,
} = require('../validators/order.validator');
const { badRequest, notFound } = require('../utils/AppError');
const { toAgorot, fromAgorot } = require('../utils/money');

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
  // המחירים והסכומים נקבעים מהקטלוג ולא ממה שהגיע בבקשה, וזה נעשה
  // לפני הכתיבה: הזמנה שנדחתה על מחיר לא נשמרת ולא שולחת מייל.
  const order = await Order.create(await priceOrder(data));

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
      revenue: fromAgorot(byStatus.reduce((sum, row) => sum + toAgorot(row.revenue), 0)),
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
