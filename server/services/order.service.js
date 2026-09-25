/**
 * הלוגיקה העסקית של ההזמנות: מתי נשלח מייל ללקוח, מה נחשב הזמנה
 * שאינה קיימת, ומה מוחזר לקורא. הקונטרולר שמעל רק מתרגם HTTP.
 *
 * כישלון בשליחת מייל אינו מכשיל את הפעולה — services/email מחזיר
 * { sent, reason? } ואינו זורק, ולכן הזמנה נשמרת גם כשהמייל לא יצא.
 */
const Order = require('../models/order.model');
const mailer = require('./email');
const { badRequest, notFound } = require('../utils/AppError');

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
 * יוצר הזמנה ומודיע לחנות וללקוח במקביל.
 * מחזיר את ההזמנה יחד עם מה שעלה בגורל שני המיילים.
 */
async function createOrder(data) {
  const order = await Order.create(data);

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
  const order = await Order.update(id, data);

  if (data.status && data.status !== existing.status) {
    await mailer.sendStatusUpdateToCustomer(order, data.status);
  }

  return order;
}

/**
 * משנה סטטוס הזמנה ומעדכן את הלקוח.
 * כשהסטטוס נשלח שוב באותו ערך הכתיבה מתבצעת כרגיל, אבל המייל
 * נחסם — אחרת לחיצה כפולה במסך הניהול הייתה שולחת ללקוח כפילות.
 */
async function updateOrderStatus(id, status) {
  const existing = await requireOrder(id);
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
