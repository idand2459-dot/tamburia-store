/**
 * מטפל בבקשות דומיין ההזמנות: מאמת קלט, קורא לשירות ומחזיר תשובה.
 * אינו ניגש למודל ואינו שולח מיילים — הלוגיקה יושבת ב-api/order/order.service.
 */
const orderService = require('./order.service');
const {
  parseCreate, parseUpdate, parseStatus, parsePicked, parseListQuery,
} = require('./order.validator');
const { sendList } = require('../../utils/paginate');

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

/**
 * POST /api/orders — יוצר הזמנה ושולח מייל לחנות וללקוח.
 * ניסיון חוזר עם אותו request_id מחזיר את ההזמנה המקורית ב-200 וב-Idempotent-Replayed.
 */
async function create(req, res) {
  const data = parseCreate(req.body);
  const { order, replayed } = await orderService.createOrder(data);
  if (replayed) res.set('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(order);
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

/** PUT /api/orders/:id/items/:line/picked — מסמן שורה ברשימת הליקוט. */
async function setPicked(req, res) {
  const { line, picked } = parsePicked(req.params, req.body);
  res.json(await orderService.setItemPicked(req.id, line, picked));
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

module.exports = { list, getOne, create, update, updateStatus, setPicked, remove, stats };
