/**
 * The order rules shared by the validator and the service: the statuses and delivery methods,
 * which status fits which delivery method, and the delivery area.
 *
 * They live here, and not in order.validator.js, because the validator checks the shape of a
 * request while these are business rules that the service also applies to the merged state of an
 * existing order. Both import this file; neither imports the other.
 */
const { badRequest } = require('../../utils/AppError');

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

module.exports = {
  STATUSES, DELIVERY_METHODS, assertDeliveryAddressPresent, assertDeliveryCityAllowed,
  assertStatusFitsDeliveryMethod, DELIVERY_ADDRESS_REQUIRED,
};
