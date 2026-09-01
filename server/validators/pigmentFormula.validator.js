const { badRequest } = require('../utils/AppError');

/** שדות הכמות, לפי סדר עולה של עומק הגוון */
const ML_FIELDS = ['ml_per_liter_light', 'ml_per_liter_medium', 'ml_per_liter_dark'];

/** color_code אינו כאן: הוא המפתח הטבעי ואינו משתנה אחרי היצירה */
const EDITABLE = ['color_name_he', 'hex', ...ML_FIELDS, 'sort_order'];

const MAX = { color_code: 50, color_name_he: 100 };

/** מיליליטר לליטר — גבול עליון שמרני, רק כדי לתפוס טעויות הקלדה */
const MAX_ML = 1000;

function asTrimmedString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

/**
 * המפתח הטבעי. אותיות קטנות, ספרות וקו תחתון בלבד —
 * הוא מופיע ב-URL ובקוד הקליינט, ולכן חייב להישאר צפוי.
 */
function asColorCode(value) {
  const code = asTrimmedString(value ?? '', 'color_code', { maxLength: MAX.color_code }).toLowerCase();
  if (!code) throw badRequest('חסר color_code');
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw badRequest('color_code יכול להכיל אותיות אנגליות קטנות, ספרות וקו תחתון בלבד');
  }
  return code;
}

/** צבע HEX בן 6 ספרות. נשמר באותיות גדולות, כמו כל הערכים הקיימים. */
function asHex(value) {
  const hex = asTrimmedString(value ?? '', 'hex');
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw badRequest('hex חייב להיות בפורמט #RRGGBB');
  }
  return hex.toUpperCase();
}

function asMl(value, field) {
  const ml = Number(value);
  if (!Number.isInteger(ml) || ml < 1 || ml > MAX_ML) {
    throw badRequest(`${field} חייב להיות מספר שלם בין 1 ל-${MAX_ML}`);
  }
  return ml;
}

function asSortOrder(value) {
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw badRequest('sort_order חייב להיות מספר שלם אי-שלילי');
  }
  return sortOrder;
}

/**
 * גוון כהה דורש יותר פיגמנט מגוון בהיר.
 * בלי הבדיקה הזו, טעות הקלדה במסד מייצרת מחשבון שנותן
 * תוצאה נמוכה יותר לגוון עמוק יותר — שגיאה שקטה שקשה לשים לב אליה.
 */
function assertAscending(formula) {
  const [light, medium, dark] = ML_FIELDS.map((field) => formula[field]);
  if (!(light < medium && medium < dark)) {
    throw badRequest(
      `כמות הפיגמנט חייבת לעלות מבהיר לכהה (התקבל: ${light} / ${medium} / ${dark})`
    );
  }
}

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
    default:           return asMl(value, field);   // שלושת שדות ה-ml
  }
}

/** יצירה: כל השדות חובה חוץ מ-sort_order. */
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
 * עדכון חלקי, כמו בשאר הדומיינים.
 * existing נדרש כדי לבדוק את סדר הכמויות על המצב המשולב —
 * עדכון של ml_per_liter_dark לבדו חייב להישקל מול light ו-medium שכבר ב-DB.
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

/** פרמטרים של ה-List — כולם אופציונליים */
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
