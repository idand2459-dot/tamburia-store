/**
 * מאמת ומנרמל את גוף הבקשה ואת פרמטרי החיפוש של דומיין המוצרים,
 * כך שהמודל מקבל רק שדות מוכרים בערכים תקינים.
 */
const { badRequest } = require('../utils/AppError');

const WRITABLE = [
  'name', 'price', 'image_url', 'images', 'colors', 'sizes',
  'category', 'subcategory', 'sku', 'description', 'in_stock', 'variants',
  'image_illustrative', 'active',
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

/* גוון תקין: #rrggbb, או ריק כשאין גוון למוצר הזה. שלוש ספרות (#fff)
   אינן מתקבלות בכוונה — <input type="color"> מחזיר תמיד שש, וצורה אחת
   פירושה שאין מה לנרמל לפני השוואה. */
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * מאמת רשימת צבעים ומחזיר אותה כאובייקטים { name, hex }.
 *
 * מחרוזת מתקבלת כשם בלי גוון, וזו אינה נדיבות אלא תאימות לאחור: ייבוא
 * ה-CSV שולח שמות מופרדים בפסיק, וכך גם כל לקוח ישן. הצורה שנשמרת
 * במסד היא תמיד האובייקט.
 *
 * צבע בלי שם נופל, ולא נדחה: זו בדיוק ההתנהגות של asStringArray
 * שקדמה כאן, ושורה ריקה בטופס אינה שגיאה אלא שורה שעוד לא מולאה.
 */
function asColors(value) {
  if (!Array.isArray(value)) throw badRequest('השדה colors חייב להיות מערך');

  return value.map((item, i) => {
    if (typeof item === 'string') return { name: item.trim(), hex: '' };
    if (!item || typeof item !== 'object') {
      throw badRequest(`colors[${i}] חייב להיות טקסט או אובייקט`);
    }

    const name = String(item.name ?? '').trim();
    const hex = String(item.hex ?? '').trim().toLowerCase();
    if (hex && !HEX.test(hex)) {
      throw badRequest(`colors[${i}].hex חייב להיות בפורמט #rrggbb`);
    }
    return { name, hex };
  }).filter((color) => color.name);
}

/** מוודא שהערך מספר אי-שלילי ומעגל אותו לשלם. */
function asNonNegativeInt(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw badRequest(`השדה ${field} חייב להיות מספר אי-שלילי`);
  }
  return Math.round(num);
}

/**
 * מאמת רשימת גרסאות ומחזיר אותן עם תווית ומחיר בלבד.
 *
 * מחיר גדול מאפס, ולא רק אי-שלילי: המחיר של מוצר עם גרסאות נגזר מהן
 * (resolvePrice), וגרסה ב-0 הייתה גוררת את כל המוצר ל"ללא מחיר"
 * ומוציאה אותו מהמכירה. מי שאין לו מחיר לגודל מסוים לא יוסיף אותו.
 *
 * ותוויות ייחודיות, כי התווית היא המפתח: services/pricing.service
 * מוצא לפיה את מחיר הגרסה שנבחרה, ושתי "5 ליטר" באותו מוצר פירושן
 * שהמחיר שייגבה הוא של הראשונה — לא משנה במה הלקוח בחר.
 */
function asVariants(value) {
  if (!Array.isArray(value)) throw badRequest('השדה variants חייב להיות מערך');

  const seen = new Set();
  return value.map((variant, i) => {
    if (!variant || typeof variant !== 'object') {
      throw badRequest(`variants[${i}] חייב להיות אובייקט`);
    }
    const label = String(variant.label ?? '').trim();
    if (!label) throw badRequest(`variants[${i}].label חסר`);

    if (seen.has(label)) throw badRequest(`הגודל "${label}" מופיע יותר מפעם אחת`);
    seen.add(label);

    const price = Number(variant.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw badRequest(`variants[${i}].price חייב להיות מספר גדול מאפס`);
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
      return value == null ? [] : asColors(value);

    case 'sizes':
      return value == null ? [] : asStringArray(value, 'sizes');

    /* שניהם ברירת מחדל true, ומאותה סיבה: מוצר חדש הוא מוצר שנמכר.
       ההבדל ביניהם הוא מה הם אומרים — in_stock הוא "אזל כרגע" ומוצג
       ללקוח, active הוא "אינו בקטלוג" ומעלים את המוצר לגמרי. */
    case 'in_stock':
    case 'active':
      return value !== false;

    /* ברירת המחדל הפוכה מזו של in_stock: מוצר נחשב במלאי אלא אם נאמר
       אחרת, ותמונה נחשבת אמיתית אלא אם סומן שהיא להמחשה. */
    case 'image_illustrative':
      return value === true;

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

  /* שלושה ערכים: true (גלויים), false (מוסתרים בלבד) ו-all (הכול).
     all הוא היחיד שמחזיר מוצרים מוסתרים, והוא נשמר כאן כ-undefined —
     כלומר "בלי סינון" — כדי שהמודל לא יצטרך להכיר ערך שלישי.

     מה שנשלח כאן קובע רק לאדמין. הקונטרולר דורס אותו ב-true לכל פונה
     אחר, כי מוצר מוסתר אינו עניין של בקשה אלא של מי שואל. */
  if (query.active !== undefined) {
    const value = String(query.active).toLowerCase();
    if (!['true', 'false', 'all'].includes(value)) {
      throw badRequest('active חייב להיות true, false או all');
    }
    if (value !== 'all') options.active = value === 'true';
    options.activeRequested = value;
  }

  /* רשימת מזהים: מה שהמועדפים, הנצפים לאחרונה והעגלה שואלים כדי
     לדעת מה מתוך מה ששמור אצלם עדיין בקטלוג. בקשה אחת במקום אחת
     לכל פריט, ותשובה שמדלגת ממילא על מה שהוסתר. */
  if (query.ids !== undefined) {
    const parts = String(query.ids).split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 100) throw badRequest('ids מוגבל ל-100 מזהים');

    const ids = parts.map((part) => {
      const id = Number(part);
      if (!Number.isInteger(id) || id < 1) throw badRequest(`ids מכיל מזהה לא תקין: "${part}"`);
      return id;
    });
    options.ids = [...new Set(ids)];
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
