/**
 * מטפל בבקשות דומיין ההזמנות, כולל שליחת המיילים הנלווים.
 * כישלון בשליחת מייל אינו מכשיל את הבקשה עצמה.
 */
const Order = require('../models/order.model');
const mailer = require('../services/email');
const {
  parseCreate, parseUpdate, parseStatus, parseListQuery,
} = require('../validators/order.validator');
const { badRequest, notFound } = require('../utils/AppError');

/** GET /api/orders — מחזיר רשימת הזמנות, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const orders = await Order.list(options);

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

/** GET /api/orders/:id — מחזיר הזמנה בודדת. */
async function getOne(req, res) {
  const order = await Order.findById(req.id);
  if (!order) throw notFound(`הזמנה ${req.id} לא נמצאה`);
  res.json(order);
}

/** GET /api/orders/by-phone/:phone — מחזיר את ההזמנות של מספר טלפון. */
async function byPhone(req, res) {
  const phone = Order.digitsOnly(req.params.phone);
  if (phone.length < 9) throw badRequest('מספר טלפון לא תקין');
  res.json(await Order.findByPhone(phone));
}

/** POST /api/orders — יוצר הזמנה ושולח מייל לחנות וללקוח. */
async function create(req, res) {
  const data = parseCreate(req.body);
  const order = await Order.create(data);

  const [store, customer] = await Promise.all([
    mailer.sendNewOrderToStore(order),
    mailer.sendOrderConfirmationToCustomer(order),
  ]);

  res.status(201).json({ ...order, emails: { store: store.sent, customer: customer.sent } });
}

/** PUT /api/orders/:id — מעדכן פרטי הזמנה, ושולח מייל אם הסטטוס השתנה. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const existing = await Order.findById(req.id);
  if (!existing) throw notFound(`הזמנה ${req.id} לא נמצאה`);

  const order = await Order.update(req.id, data);

  if (data.status && data.status !== existing.status) {
    await mailer.sendStatusUpdateToCustomer(order, data.status);
  }
  res.json(order);
}

/** PUT /api/orders/:id/status — משנה סטטוס ומעדכן את הלקוח במייל. */
async function updateStatus(req, res) {
  const status = parseStatus(req.body);
  const existing = await Order.findById(req.id);
  if (!existing) throw notFound(`הזמנה ${req.id} לא נמצאה`);

  const order = await Order.update(req.id, { status });
  console.log(`סטטוס הזמנה #${order.id}: ${existing.status} → ${status}`);

  const mail = status === existing.status
    ? { sent: false, reason: 'הסטטוס לא השתנה' }
    : await mailer.sendStatusUpdateToCustomer(order, status);

  res.json({ ...order, email_sent: mail.sent });
}

/** DELETE /api/orders/:id — מוחק הזמנה. */
async function remove(req, res) {
  const order = await Order.remove(req.id);
  if (!order) throw notFound(`הזמנה ${req.id} לא נמצאה`);
  res.json({ message: 'נמחק', order });
}

/** GET /api/orders/stats — מחזיר סיכום הזמנות והכנסות לפי סטטוס. */
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
