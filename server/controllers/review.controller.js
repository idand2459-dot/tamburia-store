/**
 * מטפל בבקשות דומיין חוות הדעת, ומפריד בין הרשימה הציבורית
 * שמציגה מאושרות בלבד לבין רשימת הניהול שמציגה הכל.
 */
const Review = require('../models/review.model');
const {
  parseCreate, parseUpdate, parseApprove, parseListQuery,
} = require('../validators/review.validator');
const { notFound } = require('../utils/AppError');

/** עוטף את התשובה בפרטי דפדוף רק אם התבקש limit או offset. */
function respond(res, key, rows, options, total) {
  if (options.limit === undefined && options.offset === undefined) {
    return res.json(rows);
  }
  return res.json({
    [key]: rows,
    pagination: { total, limit: options.limit ?? total, offset: options.offset ?? 0 },
  });
}

/** מחזיר ספירה רק כשהתשובה כוללת דפדוף. */
function countIfPaged(options) {
  if (options.limit === undefined && options.offset === undefined) return undefined;
  return Review.count(options);
}

/** GET /api/reviews — מחזיר חוות דעת מאושרות בלבד. */
async function list(req, res) {
  const options = { ...parseListQuery(req.query), approved: true };
  const reviews = await Review.list(options);
  respond(res, 'reviews', reviews, options, await countIfPaged(options));
}

/** GET /api/reviews/all — מחזיר את כל חוות הדעת, כולל שם המוצר. */
async function listAll(req, res) {
  const options = {
    ...parseListQuery(req.query, { allowApproved: true }),
    withProductName: true,
  };
  const reviews = await Review.list(options);
  respond(res, 'reviews', reviews, options, await countIfPaged(options));
}

/** GET /api/reviews/:id — מחזיר חוות דעת בודדת. */
async function getOne(req, res) {
  const review = await Review.findById(req.id);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** POST /api/reviews — יוצר חוות דעת שממתינה לאישור. */
async function create(req, res) {
  const data = parseCreate(req.body);
  const review = await Review.create(data);
  res.status(201).json(review);
}

/** PUT /api/reviews/:id — מעדכן את השדות שנשלחו בלבד. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const review = await Review.update(req.id, data);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** PUT /api/reviews/:id/approve — מאשר או מבטל אישור. */
async function approve(req, res) {
  const approved = parseApprove(req.body);
  const review = await Review.update(req.id, { approved });
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** DELETE /api/reviews/:id — מוחק חוות דעת. */
async function remove(req, res) {
  const review = await Review.remove(req.id);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json({ message: 'נמחק', review });
}

/** GET /api/reviews/stats — מחזיר ממוצע והתפלגות של מאושרות בלבד. */
async function stats(req, res) {
  const options = { ...parseListQuery(req.query), approved: true };
  res.json(await Review.stats(options));
}

module.exports = { list, listAll, getOne, create, update, approve, remove, stats };
