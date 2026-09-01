const Order = require('../models/order.model');
const mailer = require('../services/email');
const {
  parseCreate, parseUpdate, parseStatus, parseListQuery,
} = require('../validators/order.validator');
const { badRequest, notFound } = require('../utils/AppError');

/** GET /api/orders — L */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const orders = await Order.list(options);

  // בלי pagination מחזירים מערך שטוח, כדי לא לשבור את מסך האדמין
  if (options.limit === undefined && options.offset === undefined) {
    return res.json(orders);
  }

  const total = await Order.count(options);
  res.json({
    orders,
    pagination: {
      total,
      limit: options.limit ?? total,
      offset: options.offset ?? 0,
    },
  });
}

/** GET /api/orders/:id — R */
async function getOne(req, res) {
  const order = await Order.findById(req.id);
  if (!order) throw notFound(`הזמנה ${req.id} לא נמצאה`);
  res.json(order);
}

/** GET /api/orders/by-phone/:phone — "ההזמנות שלי" בצד הלקוח */
async function byPhone(req, res) {
  const phone = Order.digitsOnly(req.params.phone);
  if (phone.length < 9) throw badRequest('מספר טלפון לא תקין');
  res.json(await Order.findByPhone(phone));
}

/**
 * POST /api/orders — C
 *
 * המיילים נשלחים אחרי השמירה ולא מעכבים כישלון:
 * הזמנה שנשמרה מוחזרת כהצלחה גם אם ה-SMTP נפל.
 */
async function create(req, res) {
  const data = parseCreate(req.body);
  const order = await Order.create(data);

  const [store, customer] = await Promise.all([
    mailer.sendNewOrderToStore(order),
    mailer.sendOrderConfirmationToCustomer(order),
  ]);

  res.status(201).json({ ...order, emails: { store: store.sent, customer: customer.sent } });
}

/** PUT /api/orders/:id — U (עדכון חלקי של פרטי ההזמנה) */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const existing = await Order.findById(req.id);
  if (!existing) throw notFound(`הזמנה ${req.id} לא נמצאה`);

  const order = await Order.update(req.id, data);

  // שינוי סטטוס דרך העדכון הכללי מפעיל את אותו מייל
  if (data.status && data.status !== existing.status) {
    await mailer.sendStatusUpdateToCustomer(order, data.status);
  }
  res.json(order);
}

/** PUT /api/orders/:id/status — הנתיב שמסך האדמין משתמש בו */
async function updateStatus(req, res) {
  const status = parseStatus(req.body);
  const existing = await Order.findById(req.id);
  if (!existing) throw notFound(`הזמנה ${req.id} לא נמצאה`);

  const order = await Order.update(req.id, { status });
  console.log(`סטטוס הזמנה #${order.id}: ${existing.status} → ${status}`);

  // סטטוס שלא השתנה לא מייצר מייל כפול ללקוח
  const mail = status === existing.status
    ? { sent: false, reason: 'הסטטוס לא השתנה' }
    : await mailer.sendStatusUpdateToCustomer(order, status);

  res.json({ ...order, email_sent: mail.sent });
}

/** DELETE /api/orders/:id — D */
async function remove(req, res) {
  const order = await Order.remove(req.id);
  if (!order) throw notFound(`הזמנה ${req.id} לא נמצאה`);
  res.json({ message: 'נמחק', order });
}

/** GET /api/orders/stats — סיכום לפי סטטוס */
async function stats(req, res) {
  const byStatus = await Order.statsByStatus();
  res.json({
    byStatus,
    totals: {
      orders: byStatus.reduce((sum, row) => sum + row.orders, 0),
      revenue: byStatus.reduce((sum, row) => sum + row.revenue, 0),
    },
  });
}

module.exports = { list, getOne, byPhone, create, update, updateStatus, remove, stats };
