/**
 * מאמת את מפתחות ההגדרות ואת ערכיהם.
 *
 * הרשימה סגורה: המפתח מגיע מהכתובת, ובלי הרשימה הזו אפשר היה לכתוב
 * לטבלה כל מפתח שבא, ולנפח אותה מבחוץ. מפתח שאינו מוכר נדחה ב-404 —
 * הוא פשוט אינו הגדרה שקיימת — וערך פסול נדחה ב-400.
 *
 * לכל מפתח יש פרסר משלו, כי הערך נשמר כמחרוזת והמשמעות שלו היא עניין
 * של אותו מפתח בלבד.
 */
const { badRequest, notFound } = require('../utils/AppError');

/* המפתח בכתובת הוא עם מקפים, כמו שאר ה-API; במסד הוא עם קווים
   תחתונים, כמו שאר שמות העמודות. */
const KEY_BY_PATH = {
  'stats-counting-from': 'stats_counting_from',
};

/**
 * ממיר ערך לחותמת זמן ISO, או null.
 *
 * null הוא ערך תקף ומשמעותו "אין נקודת התחלה" — כך מבוטל האיפוס של
 * לשונית הסטטיסטיקות, בלי נתיב מחיקה נפרד.
 */
function asIsoTimestampOrNull(value) {
  if (value == null || value === '') return null;

  if (typeof value !== 'string') {
    throw badRequest('stats_counting_from חייב להיות תאריך בפורמט ISO או null');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`"${value}" אינו תאריך תקין`);
  }

  // נרמול: מה שנשמר הוא תמיד ISO, ולא מה שהקליינט הזדמן לשלוח
  return date.toISOString();
}

const VALUE_PARSERS = {
  stats_counting_from: asIsoTimestampOrNull,
};

/** ממיר מפתח מהכתובת לשם במסד, או זורק 404. */
function resolveKey(pathKey) {
  const key = KEY_BY_PATH[pathKey];
  if (!key) throw notFound(`ההגדרה "${pathKey}" אינה קיימת`);
  return key;
}

/** מאמת את הערך שנשלח להגדרה ומחזיר אותו מנורמל. */
function parseValue(key, body = {}) {
  if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
    throw badRequest('חסר שדה value');
  }
  return VALUE_PARSERS[key](body.value);
}

module.exports = { resolveKey, parseValue };
