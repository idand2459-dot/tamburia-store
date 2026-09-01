const config = require('../config/env');
const { badRequest } = require('../utils/AppError');

/** הסטטוסים שהאדמין מציג. חייב להישאר מסונכרן עם STATUS_CONFIG ב-Admin.js */
const STATUSES = ['new', 'processing', 'shipped', 'completed'];

const DELIVERY_METHODS = ['pickup', 'delivery'];

/** שדות שהאדמין רשאי לערוך בהזמנה קיימת. פריטים וסכומים אינם ביניהם. */
const EDITABLE = [
  'customer_name', 'customer_phone', 'customer_email',
  'delivery_method', 'delivery_address', 'notes', 'status',
];

const MAX = { customer_name: 200, customer_phone: 50, customer_email: 200 };

function asTrimmedString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

function asNonNegativeInt(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw badRequest(`השדה ${field} חייב להיות מספר אי-שלילי`);
  }
  return Math.round(num);
}

/** טלפון: 9–15 ספרות אחרי ניקוי. מכסה קווי (9) ונייד (10), גם עם קידומת בינלאומית. */
function asPhone(value) {
  const raw = asTrimmedString(value, 'customer_phone', { maxLength: MAX.customer_phone });
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    throw badRequest('מספר טלפון לא תקין');
  }
  return raw;
}

/** מייל אופציונלי — מחרוזת ריקה נשמרת כ-NULL, לא כ-'' */
function asOptionalEmail(value) {
  if (value == null) return null;
  const email = asTrimmedString(value, 'customer_email', { maxLength: MAX.customer_email });
  if (!email) return null;
  // בדיקה מכוונת רופפת: תופסת שגיאות הקלדה בלי לפסול כתובות חוקיות ומוזרות
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('כתובת האימייל אינה תקינה');
  }
  return email;
}

function asDeliveryMethod(value) {
  const method = asTrimmedString(value ?? '', 'delivery_method').toLowerCase();
  if (!DELIVERY_METHODS.includes(method)) {
    throw badRequest(`delivery_method חייב להיות אחד מ: ${DELIVERY_METHODS.join(', ')}`);
  }
  return method;
}

function asStatus(value) {
  const status = asTrimmedString(value ?? '', 'status').toLowerCase();
  if (!STATUSES.includes(status)) {
    throw badRequest(`status חייב להיות אחד מ: ${STATUSES.join(', ')}`);
  }
  return status;
}

/**
 * פריטי ההזמנה — צילום מצב של העגלה בזמן ההזמנה.
 * המחירים נלקחים מהלקוח, בדיוק כמו קודם: וריאנטים ומידות
 * מייצרים מחיר שאינו בהכרח price של המוצר בטבלה.
 */
function asItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest('ההזמנה חייבת לכלול לפחות פריט אחד');
  }
  return value.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw badRequest(`items[${i}] חייב להיות אובייקט`);
    }
    const name = String(item.name ?? '').trim();
    if (!name) throw badRequest(`items[${i}].name חסר`);

    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      throw badRequest(`items[${i}].price חייב להיות מספר אי-שלילי`);
    }

    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw badRequest(`items[${i}].quantity חייב להיות מספר שלם חיובי`);
    }

    const id = Number(item.id);

    return {
      id: Number.isInteger(id) && id > 0 ? id : null,
      name,
      price: Math.round(price),
      quantity,
      selectedColor: item.selectedColor ? String(item.selectedColor).trim() : null,
      selectedSize: item.selectedSize ? String(item.selectedSize).trim() : null,
    };
  });
}

/**
 * יצירת הזמנה.
 *
 * subtotal, delivery_fee ו-total מחושבים כאן ולא נלקחים מגוף הבקשה.
 * הנוסחה זהה לזו שבקליינט, כך שהתוצאה אינה משתנה עבור לקוח תקין —
 * אבל בקשה ידנית כבר לא יכולה לקבוע לעצמה total=1.
 */
function parseCreate(body = {}) {
  const delivery_method = asDeliveryMethod(body.delivery_method);
  const items = asItems(body.items);

  let delivery_address = null;
  if (delivery_method === 'delivery') {
    delivery_address = asTrimmedString(body.delivery_address ?? '', 'delivery_address');
    if (!delivery_address) throw badRequest('חסרה כתובת למשלוח');
  }

  const customer_name = asTrimmedString(body.customer_name ?? '', 'customer_name', { maxLength: MAX.customer_name });
  if (!customer_name) throw badRequest('חסר שם לקוח');

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery_fee = delivery_method === 'delivery' ? config.orders.deliveryFee : 0;

  return {
    customer_name,
    customer_phone: asPhone(body.customer_phone),
    customer_email: asOptionalEmail(body.customer_email),
    delivery_method,
    delivery_address,
    notes: body.notes == null ? null : (asTrimmedString(body.notes, 'notes') || null),
    items,
    subtotal,
    delivery_fee,
    total: subtotal + delivery_fee,
    status: 'new',
  };
}

/** ממיר שדה בודד לערך המוכן ל-DB */
function parseEditableField(field, value) {
  switch (field) {
    case 'customer_name': {
      const name = asTrimmedString(value ?? '', 'customer_name', { maxLength: MAX.customer_name });
      if (!name) throw badRequest('שם הלקוח לא יכול להיות ריק');
      return name;
    }
    case 'customer_phone':  return asPhone(value);
    case 'customer_email':  return asOptionalEmail(value);
    case 'delivery_method': return asDeliveryMethod(value);
    case 'status':          return asStatus(value);
    case 'delivery_address':
    case 'notes':
      if (value == null) return null;
      return asTrimmedString(value, field) || null;
    default:
      return value;
  }
}

/**
 * עדכון חלקי, כמו במוצרים: רק שדות שנשלחו בפועל.
 * הסכומים והפריטים אינם ניתנים לעריכה — הזמנה שנשמרה
 * היא רשומה היסטורית, ושינוי מחיר בדיעבד היה שובר את הדוחות.
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
  if (data.delivery_method === 'delivery' && data.delivery_address === null) {
    throw badRequest('משלוח דורש כתובת');
  }
  return data;
}

/** PUT /:id/status — גוף הבקשה הוא { status } בלבד */
function parseStatus(body = {}) {
  if (body.status == null) throw badRequest('חסר שדה status');
  return asStatus(body.status);
}

const SORTABLE = ['id', 'created_at', 'total', 'status'];

/** קצה התאריך — 'to' ניתן כיום שלם, ולכן נסגר בסופו */
function asDate(value, field, { endOfDay = false } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} אינו תאריך תקין`);
  // רק תאריך בלי שעה — סוגרים את היום, אחרת הזמנות מאותו יום נופלות מהסינון
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/** פרמטרים של ה-List — כולם אופציונליים */
function parseListQuery(query = {}) {
  const options = {};

  if (query.status !== undefined) options.status = asStatus(query.status);
  if (query.phone) options.phone = String(query.phone).trim();
  if (query.search) options.search = String(query.search).trim();
  if (query.from) options.from = asDate(query.from, 'from');
  if (query.to) options.to = asDate(query.to, 'to', { endOfDay: true });

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
  parseCreate, parseUpdate, parseStatus, parseListQuery,
  STATUSES, DELIVERY_METHODS, EDITABLE, SORTABLE,
};
