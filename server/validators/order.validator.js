/**
 * מאמת ומנרמל את גוף הבקשה ואת פרמטרי החיפוש של דומיין ההזמנות.
 *
 * מה שנעשה כאן הוא צורה בלבד: שדה שנשלח הוא מהסוג הנכון, באורך
 * הנכון, מתוך הרשימה הנכונה. המחירים והסכומים אינם נקבעים כאן.
 *
 * הם היו. parseCreate חיבר subtotal ו-total מתוך המחירים שהגיעו בגוף
 * הבקשה, וההערה הזו הבטיחה ש"בקשה לא תוכל לקבוע לעצמה מחיר" — אבל
 * המחיר של כל פריט *כן* הגיע מהבקשה, וכל מה שנבדק בו הוא שהוא מספר
 * אי-שלילי. חיבור נאמן של מספרים שהלקוח בחר אינו הגנה.
 *
 * עכשיו המחירים נשלפים מהמסד ב-services/pricing.service.js, והמחיר
 * שמגיע בבקשה נשמר כאן רק כדי שיהיה מה להשוות אליו שם. אותה סיבה
 * בדיוק היא שבגללה asItems שומרת את תווית הגרסה: בלעדיה אין לשרת
 * דרך לדעת איזו גרסה נבחרה, ולכן אין לו ממה לגזור את מחירה.
 */
const { badRequest } = require('../utils/AppError');
const { parsePrice } = require('../utils/money');

const STATUSES = ['new', 'processing', 'ready_for_pickup', 'shipped', 'completed'];

const DELIVERY_METHODS = ['pickup', 'delivery'];

/**
 * הסטטוסים שאינם מתאימים לכל אופן קבלה.
 *
 * 'ready_for_pickup' ו-'shipped' מתארים כל אחד מסלול אחר: הזמנת משלוח
 * לא מחכה לאיסוף בחנות, והזמנת איסוף עצמי לא יוצאת לדרך. השאר —
 * new, processing, completed — משותפים לשניהם ואינם מופיעים כאן.
 */
const STATUS_ONLY_FOR_METHOD = {
  ready_for_pickup: 'pickup',
  shipped: 'delivery',
};

const STATUS_METHOD_ERRORS = {
  ready_for_pickup: 'הסטטוס "מוכנה לאיסוף" מתאים להזמנת איסוף עצמי בלבד',
  shipped: 'הסטטוס "נשלחה" מתאים להזמנת משלוח בלבד',
};

/**
 * הערים שאליהן מבצעים משלוח.
 *
 * הרשימה מועתקת כלשונה מ-CartModal: כל עיר מופיעה גם עם מקף וגם עם
 * רווח, ו"קריית/קרית" בשני האיותים. הכפילות מכוונת — היא מה שמאפשר
 * להתאים כתובת שהלקוח הקליד בעצמו, ואין לאחד אותה.
 */
const ALLOWED_CITIES = ['פתח תקווה', 'פתח-תקווה', 'גני תקווה', 'גני-תקווה', 'קריית אונו', 'קרית אונו', 'קריית-אונו', 'קרית-אונו'];

const DELIVERY_AREA_ERROR = 'מצטערים, אנחנו מבצעים משלוחים לפתח תקווה, גני תקווה וקריית אונו בלבד';

const DELIVERY_ADDRESS_REQUIRED = 'משלוח דורש כתובת';

/**
 * זורק 400 כשמבקשים משלוח בלי כתובת.
 *
 * parseUpdate בודק את אותו כלל על גוף הבקשה בלבד, ולכן מפספס עדכון
 * שמשנה רק את אופן הקבלה ומשאיר הזמנה מסומנת כמשלוח בלי כתובת כלל.
 * השירות קורא לכאן עם המצב הממוזג, ששם יש גם את ההזמנה הקיימת.
 */
function assertDeliveryAddressPresent(delivery_method, delivery_address) {
  if (delivery_method !== 'delivery') return;
  if (delivery_address) return;
  throw badRequest(DELIVERY_ADDRESS_REQUIRED);
}

/** בודק אם הכתובת נמצאת באזור החלוקה. כתובת ריקה נבדקת במקום אחר. */
function checkAllowedCity(address) {
  if (!address) return true;
  const lower = address.toLowerCase();
  return ALLOWED_CITIES.some(city => lower.includes(city.toLowerCase()));
}

/**
 * זורק 400 כשמבקשים משלוח לכתובת מחוץ לאזור החלוקה.
 *
 * עד כה הכלל התקיים רק בקליינט, שמשבית את כפתור השליחה. בקשה ישירה
 * ל-API עקפה אותו לגמרי והזמנה לתל אביב נשמרה כרגיל.
 *
 * כתובת ריקה אינה נדחית כאן — החוסר נתפס בבדיקות שכבר קיימות
 * ("חסרה כתובת למשלוח" ביצירה, "משלוח דורש כתובת" בעדכון) — וכך
 * חלוקת האחריות נשארת זהה לזו שבקליינט.
 */
function assertDeliveryCityAllowed(delivery_method, delivery_address) {
  if (delivery_method !== 'delivery') return;
  if (!delivery_address) return;
  if (checkAllowedCity(delivery_address)) return;
  throw badRequest(DELIVERY_AREA_ERROR);
}

/**
 * זורק 400 כשהסטטוס אינו מתאים לאופן הקבלה של ההזמנה.
 *
 * אותו עיקרון של כלל אזור החלוקה: הקליינט כבר מציע רק את הסטטוסים
 * המתאימים, אבל בקשה ישירה ל-API עוקפת אותו, ואז הזמנת איסוף עצמי
 * הייתה מסומנת "נשלחה" והלקוח היה מקבל מייל על חבילה שבדרך.
 *
 * הבדיקה כאן היא על המצב שאחרי המיזוג, ולכן היא נקראת מהשירות ולא
 * מ-parseUpdate: עדכון שמשנה רק את הסטטוס אינו יודע לבדו מה אופן
 * הקבלה של ההזמנה הקיימת.
 */
function assertStatusFitsDeliveryMethod(status, delivery_method) {
  const required = STATUS_ONLY_FOR_METHOD[status];
  if (!required) return;
  if (delivery_method === required) return;
  throw badRequest(STATUS_METHOD_ERRORS[status]);
}

/** מחזיר את הסטטוסים החוקיים לאופן קבלה נתון, בסדר ההתקדמות. */
function statusesForMethod(delivery_method) {
  return STATUSES.filter((status) => {
    const required = STATUS_ONLY_FOR_METHOD[status];
    return !required || required === delivery_method;
  });
}

const EDITABLE = [
  'customer_name', 'customer_phone', 'customer_email',
  'delivery_method', 'delivery_address', 'notes', 'status',
];

const MAX = { customer_name: 30, customer_phone: 50, customer_email: 200 };

/** מוודא שהערך טקסט, מקצץ רווחים ובודק אורך מרבי. */
function asTrimmedString(value, field, { maxLength } = {}) {
  if (typeof value !== 'string') throw badRequest(`השדה ${field} חייב להיות טקסט`);
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw badRequest(`השדה ${field} ארוך מדי (מקסימום ${maxLength} תווים)`);
  }
  return trimmed;
}

/** מוודא שהערך מספר אי-שלילי ומעגל אותו לשלם. */
function asNonNegativeInt(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw badRequest(`השדה ${field} חייב להיות מספר אי-שלילי`);
  }
  return Math.round(num);
}

/** מאמת מספר טלפון בן 9 עד 15 ספרות ומחזיר אותו כפי שנכתב. */
function asPhone(value) {
  const raw = asTrimmedString(value, 'customer_phone', { maxLength: MAX.customer_phone });
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    throw badRequest('מספר טלפון לא תקין');
  }
  return raw;
}

/** מאמת כתובת מייל אופציונלית, ומחזיר null כשאין. */
function asOptionalEmail(value) {
  if (value == null) return null;
  const email = asTrimmedString(value, 'customer_email', { maxLength: MAX.customer_email });
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('כתובת האימייל אינה תקינה');
  }
  return email;
}

/** מוודא שאופן הקבלה הוא איסוף עצמי או משלוח. */
function asDeliveryMethod(value) {
  const method = asTrimmedString(value ?? '', 'delivery_method').toLowerCase();
  if (!DELIVERY_METHODS.includes(method)) {
    throw badRequest(`delivery_method חייב להיות אחד מ: ${DELIVERY_METHODS.join(', ')}`);
  }
  return method;
}

/** מוודא שהסטטוס הוא אחד מהסטטוסים המוכרים. */
function asStatus(value) {
  const status = asTrimmedString(value ?? '', 'status').toLowerCase();
  if (!STATUSES.includes(status)) {
    throw badRequest(`status חייב להיות אחד מ: ${STATUSES.join(', ')}`);
  }
  return status;
}

/** מאמת את פריטי ההזמנה ומחזיר צילום מצב מנורמל של העגלה. */
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

    // המחיר שהלקוח ראה על המסך. הוא אינו נכנס להזמנה כמו שהוא —
    // pricing.service משווה אותו למחיר שבמסד ודוחה הזמנה שהם נפרדו בה.
    // לא מעוגל: עיגול כאן היה הופך 12.90 ל-13 והשוואה למסד הייתה
    // נכשלת ב-409 על מחיר שלא השתנה.
    const price = parsePrice(item.price, { allowZero: true });
    if (price === null) {
      throw badRequest(`items[${i}].price חייב להיות מספר אי-שלילי עם עד שתי ספרות אחרי הנקודה`);
    }

    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw badRequest(`items[${i}].quantity חייב להיות מספר שלם חיובי`);
    }

    const id = Number(item.id);

    return {
      id: Number.isInteger(id) && id > 0 ? id : null,
      name,
      price,
      quantity,
      // תווית הגרסה נשמרת מכאן ואילך. עד עכשיו היא נזרקה, כך שהזמנה
      // של מוצר עם גרסאות לא תיעדה איזו גרסה נמכרה — ולשרת גם לא
      // הייתה דרך לתמחר אותה.
      selectedVariant: item.selectedVariant ? String(item.selectedVariant).trim() : null,
      selectedColor: item.selectedColor ? String(item.selectedColor).trim() : null,
      selectedSize: item.selectedSize ? String(item.selectedSize).trim() : null,
    };
  });
}

/**
 * מאמת גוף בקשה ליצירת הזמנה.
 *
 * בלי סכומים: subtotal, delivery_fee ו-total נקבעים ב-pricing.service
 * אחרי שהמחירים נשלפו מהמסד, כי אין דרך לחשב אותם נכון לפני כן.
 */
function parseCreate(body = {}) {
  const delivery_method = asDeliveryMethod(body.delivery_method);
  const items = asItems(body.items);

  let delivery_address = null;
  if (delivery_method === 'delivery') {
    delivery_address = asTrimmedString(body.delivery_address ?? '', 'delivery_address');
    if (!delivery_address) throw badRequest('חסרה כתובת למשלוח');
    assertDeliveryCityAllowed(delivery_method, delivery_address);
  }

  const customer_name = asTrimmedString(body.customer_name ?? '', 'customer_name', { maxLength: MAX.customer_name });
  if (!customer_name) throw badRequest('חסר שם לקוח');

  return {
    customer_name,
    customer_phone: asPhone(body.customer_phone),
    customer_email: asOptionalEmail(body.customer_email),
    delivery_method,
    delivery_address,
    notes: body.notes == null ? null : (asTrimmedString(body.notes, 'notes') || null),
    items,
    status: 'new',
  };
}

/** ממיר שדה בודד לערך המוכן למסד, לפי הכללים של אותו שדה. */
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
 * מאמת גוף בקשה לעדכון הזמנה ומחזיר רק את השדות שנשלחו.
 * הפריטים והסכומים אינם ניתנים לעריכה — הזמנה שנשמרה היא רשומה היסטורית.
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
    throw badRequest(DELIVERY_ADDRESS_REQUIRED);
  }
  return data;
}

/** מאמת גוף בקשה לשינוי סטטוס ומחזיר את הסטטוס החדש. */
function parseStatus(body = {}) {
  if (body.status == null) throw badRequest('חסר שדה status');
  return asStatus(body.status);
}

const SORTABLE = ['id', 'created_at', 'total', 'status'];

/** ממיר ערך לתאריך, ואופציונלית סוגר אותו לסוף היום. */
function asDate(value, field, { endOfDay = false } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} אינו תאריך תקין`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/** מאמת את פרמטרי החיפוש, המיון והדפדוף של רשימת ההזמנות. */
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
  parseCreate, parseUpdate, parseStatus, parseListQuery, assertDeliveryCityAllowed,
  assertDeliveryAddressPresent, assertStatusFitsDeliveryMethod, EDITABLE, SORTABLE,
};
