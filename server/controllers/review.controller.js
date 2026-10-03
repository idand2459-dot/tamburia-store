/**
 * מתרגם HTTP לדומיין חוות הדעת: מאמת קלט, קורא לשירות ומחזיר תשובה.
 *
 * כלל המודרציה — הציבור רואה מאושרות בלבד, וחוות דעת חדשה ממתינה
 * לאישור — יושב ב-services/review.service, ולא כאן.
 */
const reviewService = require('../services/review.service');
const {
  parseCreate, parseUpdate, parseApprove, parseListQuery,
} = require('../validators/review.validator');
const { sendList } = require('../utils/paginate');

/** GET /api/reviews — מחזיר חוות דעת מאושרות בלבד. */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const { reviews, total } = await reviewService.listPublic(options);
  sendList(res, 'reviews', reviews, total, options);
}

/** GET /api/reviews/all — מחזיר את כל חוות הדעת, כולל שם המוצר. */
async function listAll(req, res) {
  const options = parseListQuery(req.query, { allowApproved: true });
  const { reviews, total } = await reviewService.listAll(options);
  sendList(res, 'reviews', reviews, total, options);
}

/** GET /api/reviews/:id — מחזיר חוות דעת בודדת. */
async function getOne(req, res) {
  res.json(await reviewService.getReview(req.id));
}

/** POST /api/reviews — יוצר חוות דעת שממתינה לאישור. */
async function create(req, res) {
  const data = parseCreate(req.body);
  res.status(201).json(await reviewService.createReview(data));
}

/** PUT /api/reviews/:id — מעדכן את השדות שנשלחו בלבד. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  res.json(await reviewService.updateReview(req.id, data));
}

/** PUT /api/reviews/:id/approve — מאשר או מבטל אישור. */
async function approve(req, res) {
  const approved = parseApprove(req.body);
  res.json(await reviewService.setApproved(req.id, approved));
}

/** DELETE /api/reviews/:id — מוחק חוות דעת. */
async function remove(req, res) {
  const review = await reviewService.removeReview(req.id);
  res.json({ message: 'נמחק', review });
}

/** GET /api/reviews/stats — מחזיר ממוצע והתפלגות של מאושרות בלבד. */
async function stats(req, res) {
  res.json(await reviewService.publicStats(parseListQuery(req.query)));
}

module.exports = { list, listAll, getOne, create, update, approve, remove, stats };
