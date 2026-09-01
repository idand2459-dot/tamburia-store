/**
 * מאמת ומנרמל את גוף הבקשה ואת פרמטרי החיפוש של גווני הפיגמנט,
 * כולל הכלל שכמות הפיגמנט חייבת לעלות מגוון בהיר לכהה.
 */
const { badRequest } = require('../utils/AppError');

const ML_FIELDS = ['ml_per_liter_light', 'ml_per_liter_medium', 'ml_per_liter_dark'];

const EDITABLE = ['color_name_he', 'hex', ...ML_FIELDS, 'sort_order'];

const MAX = { color_code: 50, color_name_he: 100 };

const MAX_ML = 1000;

/** מוודא שהערך טקסט, מקצץ רווחים ובודק אורך מרבי. */
function asTrimmedString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

/** מאמת את הקוד הטבעי: אותיות אנגליות קטנות, ספרות וקו תחתון. */
function asColorCode(value) {
  const code = asTrimmedString(value ?? '', 'color_code', { maxLength: MAX.color_code }).toLowerCase();
  if (!code) throw badRequest('חסר color_code');
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw badRequest('color_code יכול להכיל אותיות אנגליות קטנות, ספרות וקו תחתון בלבד');
  }
  return code;
}

/** מאמת צבע בפורמט #RRGGBB ומחזיר אותו באותיות גדולות. */
function asHex(value) {
  const hex = asTrimmedString(value ?? '', 'hex');
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw badRequest('hex חייב להיות בפורמט #RRGGBB');
  }
  return hex.toUpperCase();
}

/** מוודא שכמות הפיגמנט היא מספר שלם בטווח סביר. */
function asMl(value, field) {
  const ml = Number(value);
  if (!Number.isInteger(ml) || ml < 1 || ml > MAX_ML) {
    throw badRequest(`${field} חייב להיות מספר שלם בין 1 ל-${MAX_ML}`);
  }
  return ml;
}

/** מוודא שסדר התצוגה הוא מספר שלם אי-שלילי. */
function asSortOrder(value) {
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw badRequest('sort_order חייב להיות מספר שלם אי-שלילי');
  }
  return sortOrder;
}

/**
 * מוודא שכמות הפיגמנט עולה מבהיר לבינוני לכהה.
 * בלי הבדיקה, טעות הקלדה מייצרת מחשבון שנותן פחות פיגמנט לגוון עמוק יותר.
 */
function assertAscending(formula) {
  const [light, medium, dark] = ML_FIELDS.map((field) => formula[field]);
  if (!(light < medium && medium < dark)) {
    throw badRequest(
      `כמות הפיגמנט חייבת לעלות מבהיר לכהה (התקבל: ${light} / ${medium} / ${dark})`
    );
  }
}

/** ממיר שדה בודד לערך המוכן למסד, לפי הכללים של אותו שדה. */
function parseField(field, value) {
  switch (field) {
    case 'color_code':    return asColorCode(value);
    case 'color_name_he': {
      const name = asTrimmedString(value ?? '', 'color_name_he', { maxLength: MAX.color_name_he });
      if (!name) throw badRequest('חסר color_name_he');
      return name;
    }
    case 'hex':        return asHex(value);
    case 'sort_order': return asSortOrder(value);
    default:           return asMl(value, field);
  }
}

/** מאמת גוף בקשה ליצירת גוון. כל השדות חובה פרט ל-sort_order. */
function parseCreate(body = {}) {
  const data = {
    color_code: parseField('color_code', body.color_code),
    color_name_he: parseField('color_name_he', body.color_name_he),
    hex: parseField('hex', body.hex),
  };
  for (const field of ML_FIELDS) {
    data[field] = parseField(field, body[field]);
  }
  data.sort_order = body.sort_order == null ? 0 : asSortOrder(body.sort_order);

  assertAscending(data);
  return data;
}

/**
 * מאמת גוף בקשה לעדכון גוון ומחזיר רק את השדות שנשלחו.
 * מקבל את הרשומה הקיימת כדי לבדוק את סדר הכמויות על המצב המשולב.
 */
function parseUpdate(body = {}, existing) {
  const data = {};
  for (const field of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = parseField(field, body[field]);
    }
  }

  if (Object.keys(data).length === 0) {
    throw badRequest('לא נשלח אף שדה לעדכון');
  }
  if (ML_FIELDS.some((field) => field in data)) {
    assertAscending({ ...existing, ...data });
  }
  return data;
}

const SORTABLE = ['id', 'color_code', 'color_name_he', 'sort_order'];

/** מאמת את פרמטרי החיפוש, המיון והדפדוף של רשימת הגוונים. */
function parseListQuery(query = {}) {
  const options = {};

  if (query.search) options.search = String(query.search).trim();

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
  parseCreate, parseUpdate, parseListQuery, asColorCode,
  ML_FIELDS, EDITABLE, SORTABLE,
};
