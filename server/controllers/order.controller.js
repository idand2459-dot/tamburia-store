/**
 * מטפל בבקשות דומיין ההזמנות: מאמת קלט, קורא לשירות ומחזיר תשובה.
 * אינו ניגש למודל ואינו שולח מיילים — הלוגיקה יושבת ב-services/order.service.
 */
const orderService = require('../services/order.service');
const {
  parseCreate, parseUpdate, parseStatus, parseListQuery,
} = require('../validators/order.validator');
const { sendList } = require('../utils/paginate');

/** GET /api/orders — מחזיר רשימת הזמנות, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const { orders, total } = await orderService.listOrders(options);
  sendList(res, 'orders', orders, total, options);
}

/** GET /api/orders/:id — מחזיר הזמנה בודדת. */
async function getOne(req, res) {
  res.json(await orderService.getOrder(req.id));
}

/** GET /api/orders/by-phone/:phone — מחזיר את ההזמנות של מספר טלפון. */
async function byPhone(req, res) {
  res.json(await orderService.findOrdersByPhone(req.params.phone));
}

/** POST /api/orders — יוצר הזמנה ושולח מייל לחנות וללקוח. */
async function create(req, res) {
  const data = parseCreate(req.body);
  res.status(201).json(await orderService.createOrder(data));
}

/** PUT /api/orders/:id — מעדכן פרטי הזמנה, ושולח מייל אם הסטטוס השתנה. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  res.json(await orderService.updateOrder(req.id, data));
}

/** PUT /api/orders/:id/status — משנה סטטוס ומעדכן את הלקוח במייל. */
async function updateStatus(req, res) {
  const status = parseStatus(req.body);
  res.json(await orderService.updateOrderStatus(req.id, status));
}

/** DELETE /api/orders/:id — מוחק הזמנה. */
async function remove(req, res) {
  const order = await orderService.removeOrder(req.id);
  res.json({ message: 'נמחק', order });
}

/** GET /api/orders/stats — מחזיר סיכום הזמנות והכנסות לפי סטטוס. */
async function stats(req, res) {
  res.json(await orderService.getStats());
}

module.exports = { list, getOne, byPhone, create, update, updateStatus, remove, stats };
