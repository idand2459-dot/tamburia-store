/**
 * מאמת ומנרמל את גוף הבקשה ואת פרמטרי החיפוש של דומיין המוצרים,
 * כך שהמודל מקבל רק שדות מוכרים בערכים תקינים.
 */
const { badRequest } = require('../utils/AppError');

const WRITABLE = [
  'name', 'price', 'image_url', 'images', 'colors', 'sizes',
  'category', 'subcategory', 'sku', 'description', 'in_stock', 'variants',
];

const MAX = { name: 255, image_url: 500, category: 100, subcategory: 100, sku: 100 };

/** מוודא שהערך טקסט, מקצץ רווחים ובודק אורך מרבי. */
function asTrimmedString(value, field, { maxLength }) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

/** ממיר מערך לרשימת מחרוזות מקוצצות, בלי ערכים ריקים. */
function asStringArray(value, field) {
  if (!Array.isArray(value)) throw badRequest(`השדה ${field} חייב להיות מערך`);
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
}

/** מוודא שהערך מספר אי-שלילי ומעגל אותו לשלם. */
function asNonNegativeInt(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw badRequest(`השדה ${field} חייב להיות מספר אי-שלילי`);
  }
  return Math.round(num);
}

/** מאמת רשימת וריאנטים ומחזיר אותם עם תווית ומחיר בלבד. */
function asVariants(value) {
  if (!Array.isArray(value)) throw badRequest('השדה variants חייב להיות מערך');
  return value.map((variant, i) => {
    if (!variant || typeof variant !== 'object') {
      throw badRequest(`variants[${i}] חייב להיות אובייקט`);
    }
    const label = String(variant.label ?? '').trim();
    if (!label) throw badRequest(`variants[${i}].label חסר`);
    const price = Number(variant.price);
    if (!Number.isFinite(price) || price < 0) {
      throw badRequest(`variants[${i}].price חייב להיות מספר אי-שלילי`);
    }
    return { label, price };
  });
}

/** ממיר שדה בודד לערך המוכן למסד, לפי הכללים של אותו שדה. */
function parseField(field, value) {
  switch (field) {
    case 'name':
      return asTrimmedString(value, 'name', { maxLength: MAX.name });

    case 'price':
      return asNonNegativeInt(value, 'price');

    case 'image_url':
      return value == null ? '' : asTrimmedString(value, 'image_url', { maxLength: MAX.image_url });

    case 'category':
    case 'subcategory':
    case 'sku': {
      if (value == null) return null;
      const str = asTrimmedString(value, field, { maxLength: MAX[field] });
      return str || null;
    }

    case 'description':
      if (value == null) return null;
      return asTrimmedString(value, 'description', {}) || null;

    case 'images':
      return Array.isArray(value) ? value : [];

    case 'colors':
      return value == null ? [] : asStringArray(value, 'colors');

    case 'sizes':
      return value == null ? [] : asStringArray(value, 'sizes');

    case 'in_stock':
      return value !== false;

    case 'variants':
      return value == null ? [] : asVariants(value);

    default:
      return value;
  }
}

/** מחזיר את מחיר המוצר: הזול מבין הוריאנטים, או המחיר שנשלח. */
function resolvePrice({ variants, price }) {
  if (Array.isArray(variants) && variants.length > 0) {
    return Math.min(...variants.map((v) => v.price));
  }
  return price;
}

/** מאמת גוף בקשה ליצירת מוצר. name חובה, לשאר יש ברירת מחדל. */
function parseCreate(body = {}) {
  if (body.name == null || String(body.name).trim() === '') {
    throw badRequest('חסר שם מוצר');
  }

  const data = {};
  for (const field of WRITABLE) {
    data[field] = parseField(field, body[field]);
  }
  data.price = resolvePrice({ variants: data.variants, price: data.price ?? 0 });
  return data;
}

/**
 * מאמת גוף בקשה לעדכון מוצר ומחזיר רק את השדות שנשלחו בפועל,
 * כדי שעדכון חלקי לא ימחק subcategory או sizes שלא נכללו בבקשה.
 */
function parseUpdate(body = {}) {
  const data = {};
  for (const field of WRITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = parseField(field, body[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'name') && !data.name) {
    throw badRequest('שם המוצר לא יכול להיות ריק');
  }
  if (Object.keys(data).length === 0) {
    throw badRequest('לא נשלח אף שדה לעדכון');
  }

  if (Array.isArray(data.variants) && data.variants.length > 0) {
    data.price = resolvePrice({ variants: data.variants });
  }
  return data;
}

const SORTABLE = ['id', 'name', 'price', 'category'];

/** מאמת את פרמטרי החיפוש, המיון והדפדוף של רשימת המוצרים. */
function parseListQuery(query = {}) {
  const options = {};

  if (query.category) options.category = String(query.category).trim();
  if (query.subcategory) options.subcategory = String(query.subcategory).trim();
  if (query.search) options.search = String(query.search).trim();

  if (query.in_stock !== undefined) {
    const value = String(query.in_stock).toLowerCase();
    if (!['true', 'false'].includes(value)) {
      throw badRequest('in_stock חייב להיות true או false');
    }
    options.inStock = value === 'true';
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

module.exports = { parseCreate, parseUpdate, parseListQuery, WRITABLE, SORTABLE };
