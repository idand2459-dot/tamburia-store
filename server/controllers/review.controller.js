const Review = require('../models/review.model');
const {
  parseCreate, parseUpdate, parseApprove, parseListQuery,
} = require('../validators/review.validator');
const { notFound } = require('../utils/AppError');

/** עוטף תשובה ב-pagination רק אם התבקש limit/offset */
function respond(res, key, rows, options, total) {
  if (options.limit === undefined && options.offset === undefined) {
    return res.json(rows);
  }
  return res.json({
    [key]: rows,
    pagination: { total, limit: options.limit ?? total, offset: options.offset ?? 0 },
  });
}

/**
 * GET /api/reviews — L (ציבורי)
 * מאושרות בלבד. approved נכפה כאן ולא מגיע מה-query,
 * אחרת ?approved=false היה חושף חוות דעת שטרם עברו אישור.
 */
async function list(req, res) {
  const options = { ...parseListQuery(req.query), approved: true };
  const reviews = await Review.list(options);
  respond(res, 'reviews', reviews, options, await countIfPaged(options));
}

/** GET /api/reviews/all — L (אדמין): הכל, כולל שם המוצר */
async function listAll(req, res) {
  const options = {
    ...parseListQuery(req.query, { allowApproved: true }),
    withProductName: true,
  };
  const reviews = await Review.list(options);
  respond(res, 'reviews', reviews, options, await countIfPaged(options));
}

/** ספירה נוספת רק כשבאמת מחזירים pagination */
function countIfPaged(options) {
  if (options.limit === undefined && options.offset === undefined) return undefined;
  return Review.count(options);
}

/** GET /api/reviews/:id — R */
async function getOne(req, res) {
  const review = await Review.findById(req.id);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** POST /api/reviews — C. נשמרת כלא-מאושרת וממתינה לאדמין. */
async function create(req, res) {
  const data = parseCreate(req.body);
  const review = await Review.create(data);
  res.status(201).json(review);
}

/** PUT /api/reviews/:id — U (עדכון חלקי) */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const review = await Review.update(req.id, data);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** PUT /api/reviews/:id/approve — הנתיב שמסך האדמין קורא אליו */
async function approve(req, res) {
  const approved = parseApprove(req.body);
  const review = await Review.update(req.id, { approved });
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json(review);
}

/** DELETE /api/reviews/:id — D */
async function remove(req, res) {
  const review = await Review.remove(req.id);
  if (!review) throw notFound(`חוות דעת ${req.id} לא נמצאה`);
  res.json({ message: 'נמחק', review });
}

/**
 * GET /api/reviews/stats — ממוצע והתפלגות.
 * ציבורי, ולכן סופר מאושרות בלבד — אחרת הממוצע היה מסגיר
 * חוות דעת שעדיין לא אושרו.
 */
async function stats(req, res) {
  const options = { ...parseListQuery(req.query), approved: true };
  res.json(await Review.stats(options));
}

module.exports = { list, listAll, getOne, create, update, approve, remove, stats };
