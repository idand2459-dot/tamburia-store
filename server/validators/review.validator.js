const { badRequest } = require('../utils/AppError');

/** 'store' = חוות דעת על החנות, 'product' = על מוצר מסוים */
const TYPES = ['store', 'product'];

/** שדות שהאדמין רשאי לערוך. type ו-product_id אינם ביניהם — ראה parseUpdate. */
const EDITABLE = ['reviewer_name', 'rating', 'text', 'approved'];

const MAX = { reviewer_name: 200, text: 2000 };

function asTrimmedString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

/** דירוג 1–5. ה-CHECK ב-DB תופס את זה גם כן, אבל 400 עדיף על שגיאת DB. */
function asRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest('הדירוג חייב להיות מספר שלם בין 1 ל-5');
  }
  return rating;
}

function asType(value) {
  const type = asTrimmedString(value ?? 'store', 'type').toLowerCase();
  if (!TYPES.includes(type)) {
    throw badRequest(`type חייב להיות אחד מ: ${TYPES.join(', ')}`);
  }
  return type;
}

function asProductId(value, field = 'product_id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`${field} חייב להיות מזהה מוצר תקין`);
  return id;
}

function asBoolean(value, field) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`השדה ${field} חייב להיות true או false`);
}

/**
 * יצירת חוות דעת.
 *
 * approved נקבע כאן ל-false תמיד ולא נלקח מגוף הבקשה —
 * אחרת אפשר היה לפרסם חוות דעת שעוקפת את האישור של האדמין.
 */
function parseCreate(body = {}) {
  const reviewer_name = asTrimmedString(body.reviewer_name ?? '', 'reviewer_name', { maxLength: MAX.reviewer_name });
  if (!reviewer_name) throw badRequest('חסר שם הכותב');

  const text = asTrimmedString(body.text ?? '', 'text', { maxLength: MAX.text });
  if (!text) throw badRequest('חסר תוכן חוות הדעת');

  const type = asType(body.type);

  // חוות דעת על מוצר חייבת לדעת על איזה מוצר. בשרת הישן היא יכלה
  // להישמר בלי product_id ואז פשוט לא הופיעה בשום מקום.
  let product_id = null;
  if (type === 'product') {
    if (body.product_id == null) throw badRequest('חוות דעת על מוצר חייבת לכלול product_id');
    product_id = asProductId(body.product_id);
  }

  return {
    reviewer_name,
    rating: asRating(body.rating),
    text,
    type,
    product_id,
    approved: false,
  };
}

/** ממיר שדה בודד לערך המוכן ל-DB */
function parseEditableField(field, value) {
  switch (field) {
    case 'reviewer_name': {
      const name = asTrimmedString(value ?? '', 'reviewer_name', { maxLength: MAX.reviewer_name });
      if (!name) throw badRequest('שם הכותב לא יכול להיות ריק');
      return name;
    }
    case 'text': {
      const text = asTrimmedString(value ?? '', 'text', { maxLength: MAX.text });
      if (!text) throw badRequest('תוכן חוות הדעת לא יכול להיות ריק');
      return text;
    }
    case 'rating':   return asRating(value);
    case 'approved': return asBoolean(value, 'approved');
    default:         return value;
  }
}

/**
 * עדכון חלקי, כמו במוצרים ובהזמנות.
 * type ו-product_id אינם ניתנים לשינוי: העברת חוות דעת ממוצר
 * למוצר אחר משנה את משמעותה, ולא זו מטרת מסך הניהול.
 */
function parseUpdate(body = {}) {
  const data = {};
  for (const field of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = parseEditableField(field, body[field]);
    }
  }
  if (Object.keys(data).length === 0) {
    throw badRequest('לא נשלח אף שדה לעדכון');
  }
  return data;
}

/** PUT /:id/approve — גוף הבקשה הוא { approved } בלבד */
function parseApprove(body = {}) {
  if (body.approved == null) throw badRequest('חסר שדה approved');
  return asBoolean(body.approved, 'approved');
}

const SORTABLE = ['id', 'created_at', 'rating'];

/**
 * פרמטרים משותפים ל-/reviews, ל-/reviews/all ול-/reviews/stats.
 * allowApproved נדלק רק במסך האדמין — בנתיב הציבורי הסינון
 * לחוות דעת מאושרות נכפה בקונטרולר ואינו ניתן לעקיפה.
 */
function parseListQuery(query = {}, { allowApproved = false } = {}) {
  const options = {};

  if (query.type !== undefined) options.type = asType(query.type);
  if (query.product_id !== undefined) options.productId = asProductId(query.product_id);
  if (query.search) options.search = String(query.search).trim();
  if (query.rating !== undefined) options.rating = asRating(query.rating);
  if (allowApproved && query.approved !== undefined) {
    options.approved = asBoolean(query.approved, 'approved');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw badRequest('limit חייב להיות מספר שלם בין 1 ל-500');
    }
    options.limit = limit;
  }

  if (query.offset !== undefined) {
    const offset = Number(query.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw badRequest('offset חייב להיות מספר שלם אי-שלילי');
    }
    options.offset = offset;
  }

  if (query.sort !== undefined) {
    if (!SORTABLE.includes(query.sort)) {
      throw badRequest(`sort חייב להיות אחד מ: ${SORTABLE.join(', ')}`);
    }
    options.sort = query.sort;
  }

  if (query.order !== undefined) {
    const order = String(query.order).toUpperCase();
    if (!['ASC', 'DESC'].includes(order)) throw badRequest('order חייב להיות asc או desc');
    options.order = order;
  }

  return options;
}

module.exports = {
  parseCreate, parseUpdate, parseApprove, parseListQuery,
  TYPES, EDITABLE, SORTABLE,
};
