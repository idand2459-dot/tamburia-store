/**
 * הלוגיקה העסקית של ההזמנות: מתי נשלח מייל ללקוח, מה נחשב הזמנה
 * שאינה קיימת, ומה מוחזר לקורא. הקונטרולר שמעל רק מתרגם HTTP.
 *
 * כישלון בשליחת מייל אינו מכשיל את הפעולה — services/email מחזיר
 * { sent, reason? } ואינו זורק, ולכן הזמנה נשמרת גם כשהמייל לא יצא.
 */
const crypto = require('crypto');
const orderRepository = require('./order.repository');
const { priceOrder } = require('./pricing.service');
const mailer = require('../../services/email');
const {
  assertDeliveryCityAllowed, assertDeliveryAddressPresent,
  assertStatusFitsDeliveryMethod,
} = require('./order.rules');
const { notFound, conflict, unprocessable } = require('../../utils/AppError');
const { toAgorot, fromAgorot } = require('../../utils/money');

/** שולף הזמנה או זורק 404. משמש כל פעולה שדורשת הזמנה קיימת. */
async function requireOrder(id) {
  const order = await orderRepository.findById(id);
  if (!order) throw notFound(`הזמנה ${id} לא נמצאה`);
  return order;
}

/**
 * מחזיר הזמנות לפי אפשרויות הסינון.
 * total מחושב רק כשהתבקש דפדוף, כדי לא להוסיף שאילתת ספירה מיותרת.
 */
async function listOrders(options) {
  const orders = await orderRepository.list(options);

  const wantsPagination = options.limit !== undefined || options.offset !== undefined;
  const total = wantsPagination ? await orderRepository.count(options) : undefined;

  return { orders, total };
}

/** מחזיר הזמנה בודדת, או זורק 404. */
function getOrder(id) {
  return requireOrder(id);
}

/**
 * ה-hash של ההזמנה כפי שהוולידטור נירמל אותה, לפני התמחור. מה שנכנס: פרטי הלקוח,
 * אופן הקבלה, הכתובת, ההערות וכל שורה (id, שם, מחיר שהלקוח ראה, כמות, גרסה, צבע ומידה),
 * בסדר קבוע. מה שלא נכנס: request_id עצמו, והסכומים — הם נקבעים בשרת.
 * הלקוח שולח שוב את אותו גוף בדיוק, ולכן אותו חישוב מניב אותו hash. ה-'v1' מאפשר
 * לשנות את הצורה בעתיד בלי לבלבל הזמנות ישנות.
 */
function requestHashOf(data) {
  const lines = data.items.map((i) => [
    i.id, i.name, i.price, i.quantity, i.selectedVariant, i.selectedColor, i.selectedSize,
  ]);
  const canonical = JSON.stringify([
    'v1', data.customer_name, data.customer_phone, data.customer_email, data.delivery_method,
    data.delivery_address, data.notes, lines,
  ]);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** האם שני hash-ים שווים (השוואה בזמן קבוע). */
function sameHash(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * ההזמנה שכבר נוצרה עבור המזהה הזה, בצורה שמתאימה ללקוח: בלי request_hash, בלי
 * picked_items (מצב פנימי של הליקוט) ובלי request_id.
 * מזהה שהגיע עם הזמנה אחרת הוא 422 — זה לא ניסיון חוזר, ואסור להחזיר לו את ההזמנה.
 */
function replayOf(existing, hash) {
  if (!sameHash(existing.request_hash, hash)) {
    throw unprocessable(
      'מזהה הבקשה כבר שימש להזמנה אחרת. אם השליחה הקודמת לא אושרה, בדקו אותה לפני שתשלחו הזמנה חדשה',
      { reason: 'request_id_reused' }
    );
  }
  const { request_hash, picked_items, ...order } = existing;
  // לא ידוע מה עלה בגורל המיילים של השליחה המקורית
  return { order: { ...order, emails: { store: null, customer: null } }, replayed: true };
}

/**
 * יוצר הזמנה ומודיע לחנות וללקוח.
 * מחזיר { order, replayed }: ההזמנה יחד עם מה שעלה בגורל שני המיילים.
 *
 * עם request_id היצירה חד-פעמית. מזהה שכבר קיים מחזיר את ההזמנה המקורית — בלי תמחור
 * מחדש (מחיר או מלאי שהשתנו אחרי ההצלחה אינם סיבה לדחות ניסיון חוזר) ובלי מיילים.
 * כשבקשה מקבילה ניצחה, ה-INSERT לא מחזיר שורה והתוצאה זהה.
 */
async function createOrder(data) {
  const requestId = data.request_id || null;
  const hash = requestId ? requestHashOf(data) : null;

  if (requestId) {
    const existing = await orderRepository.findByRequestId(requestId);
    if (existing) return replayOf(existing, hash);
  }

  // המחירים והסכומים נקבעים מהקטלוג ולא ממה שהגיע בבקשה, וזה נעשה
  // לפני הכתיבה: הזמנה שנדחתה על מחיר לא נשמרת ולא שולחת מייל.
  const priced = await priceOrder(data);

  let order;
  if (requestId) {
    order = await orderRepository.createOnce({ ...priced, request_hash: hash });
    if (!order) {
      const winner = await orderRepository.findByRequestId(requestId);
      if (!winner) throw conflict('ההזמנה לא נשמרה. אפשר לנסות שוב');
      return replayOf(winner, hash);
    }
  } else {
    order = await orderRepository.create(priced);
  }

  const [store, customer] = await Promise.all([
    mailer.sendNewOrderToStore(order),
    mailer.sendOrderConfirmationToCustomer(order),
  ]);

  // The customer gets the same fields as a replay and the phone lookup: picked_items is the
  // warehouse's state, not part of what the customer is told.
  const { picked_items, ...customerOrder } = order;
  return { order: { ...customerOrder, emails: { store: store.sent, customer: customer.sent } }, replayed: false };
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

  const order = await orderRepository.update(id, data);

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

  const order = await orderRepository.update(id, { status });

  console.log(`סטטוס הזמנה #${order.id}: ${existing.status} → ${status}`);

  const mail = status === existing.status
    ? { sent: false, reason: 'הסטטוס לא השתנה' }
    : await mailer.sendStatusUpdateToCustomer(order, status);

  return { ...order, email_sent: mail.sent };
}

/**
 * מסמן שורה ברשימת הליקוט כמוכנה, או מבטל את הסימון.
 *
 * line הוא האינדקס של השורה ב-items. שורה שאינה קיימת בהזמנה היא
 * 404 ולא 400: הבקשה תקינה בצורתה, פשוט אין לה על מה לחול. הסטטוס
 * אינו משתנה כאן גם כשכל השורות מסומנות — ההחלטה להתקדם נשארת אצל
 * מי שמטפל בהזמנה.
 */
async function setItemPicked(id, line, picked) {
  const existing = await requireOrder(id);
  const items = Array.isArray(existing.items) ? existing.items : [];
  if (line >= items.length) throw notFound(`בהזמנה ${id} אין שורה ${line}`);

  // null כאן — ההזמנה נמחקה בין הקריאה לכתיבה
  const order = await orderRepository.setLinePicked(id, line, picked);
  if (!order) throw notFound(`הזמנה ${id} לא נמצאה`);
  return order;
}

/** מוחק הזמנה ומחזיר אותה, או זורק 404 אם לא הייתה. */
async function removeOrder(id) {
  const order = await orderRepository.remove(id);
  if (!order) throw notFound(`הזמנה ${id} לא נמצאה`);
  return order;
}

/** מחזיר סיכום הזמנות והכנסות לפי סטטוס, עם שורת סך-הכל. */
async function getStats() {
  const byStatus = await orderRepository.statsByStatus();

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
  createOrder,
  updateOrder,
  updateOrderStatus,
  setItemPicked,
  removeOrder,
  getStats,
};
