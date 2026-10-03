/**
 * כללי המודרציה של חוות הדעת: מה הציבור רואה, ומה רק המנהל.
 *
 * הכלל המרכזי יושב כאן ולא בקונטרולר או בוולידטור: הרשימה הציבורית
 * והסטטיסטיקה הציבורית הן תמיד של מאושרות בלבד, ו-approved נקבע כאן
 * ולא מתוך הבקשה — כך ש-?approved=false מהציבור אינו יכול לעקוף אותו.
 * חוות דעת חדשה נשמרת תמיד לא-מאושרת (הוולידטור כבר מחזיר false, וכאן
 * זה נאכף שוב, כי זה הכלל ולא פרט של הפענוח).
 */
const Review = require('../models/review.model');
const { notFound } = require('../utils/AppError');

/** האם התבקש דפדוף — ורק אז שווה להריץ שאילתת ספירה. */
const wantsPagination = (options) => options.limit !== undefined || options.offset !== undefined;

/** מחזיר { reviews, total }; total רק כשהתבקש דפדוף. */
async function listWith(options) {
  const reviews = await Review.list(options);
  const total = wantsPagination(options) ? await Review.count(options) : undefined;
  return { reviews, total };
}

/** שולף חוות דעת או זורק 404. */
async function requireReview(id) {
  const review = await Review.findById(id);
  if (!review) throw notFound(`חוות דעת ${id} לא נמצאה`);
  return review;
}

/** הרשימה הציבורית: מאושרות בלבד, בלי קשר למה שנשלח. */
function listPublic(options) {
  return listWith({ ...options, approved: true });
}

/** רשימת הניהול: הכל, כולל שם המוצר שחוות הדעת עליו. */
function listAll(options) {
  return listWith({ ...options, withProductName: true });
}

/** חוות דעת בודדת (ניהול), או 404. */
function getReview(id) {
  return requireReview(id);
}

/** יוצר חוות דעת שממתינה לאישור. */
function createReview(data) {
  return Review.create({ ...data, approved: false });
}

/** מעדכן את השדות שנשלחו, או 404. */
async function updateReview(id, data) {
  const review = await Review.update(id, data);
  if (!review) throw notFound(`חוות דעת ${id} לא נמצאה`);
  return review;
}

/** מאשר או מבטל אישור, או 404. */
function setApproved(id, approved) {
  return updateReview(id, { approved });
}

/** מוחק חוות דעת ומחזיר אותה, או 404. */
async function removeReview(id) {
  const review = await Review.remove(id);
  if (!review) throw notFound(`חוות דעת ${id} לא נמצאה`);
  return review;
}

/** ממוצע והתפלגות — של מאושרות בלבד, כמו הרשימה הציבורית. */
function publicStats(options) {
  return Review.stats({ ...options, approved: true });
}

module.exports = {
  listPublic, listAll, getReview, createReview, updateReview, setApproved, removeReview, publicStats,
};
