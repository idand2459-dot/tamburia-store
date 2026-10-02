/**
 * כסף: מחירים עם עד שתי ספרות אחרי הנקודה, ומה שעושים בהם.
 *
 * במסד המחיר הוא NUMERIC(10,2) — מדויק. ב-JavaScript הוא מגיע כ-float,
 * ו-float אינו מדויק: 12.9 * 3 הוא 38.699999999999996, ו-0.1 + 0.2 אינו
 * 0.3. לכן כל השוואה וכל חיבור נעשים באגורות, שהן מספרים שלמים, וחוזרים
 * לשקלים רק בסוף. כך 12.9 מול "12.90" הם אותו מחיר (1290 אגורות), וסכום
 * של שורות תמיד יוצא עגול באגורה.
 */

/* התקרה של NUMERIC(10,2). מעליה המסד זורק, ועדיף 400 עם הסבר. */
const MAX_PRICE = 99_999_999.99;

/** שקלים → אגורות, מספר שלם. */
function toAgorot(value) {
  return Math.round(Number(value) * 100);
}

/** אגורות → שקלים. */
function fromAgorot(agorot) {
  return agorot / 100;
}

/**
 * האם המספר מחיר עם עד שתי ספרות אחרי הנקודה. הסובלנות קיימת כי
 * 12.9 * 100 הוא 1290.0000000000002, וזה עדיין 12.90 ולא 12.901.
 */
function hasAtMostTwoDecimals(num) {
  return Math.abs(num * 100 - Math.round(num * 100)) < 1e-6;
}

/**
 * מאמת מחיר ומחזיר אותו מנורמל לשתי ספרות, או null כשאינו תקין.
 * מספר או מחרוזת מספרית עם נקודה; פסיק אינו מתקבל כאן — הקליינט
 * הוא שממיר "12,90" ל-12.9 לפני שהוא שולח.
 */
function parsePrice(value, { allowZero = false } = {}) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_PRICE) return null;
  if (num === 0 && !allowZero) return null;
  if (!hasAtMostTwoDecimals(num)) return null;
  return fromAgorot(toAgorot(num));
}

/** מחיר ⨉ כמות, מדויק באגורה. */
function lineTotal(price, quantity) {
  return fromAgorot(toAgorot(price) * quantity);
}

/**
 * מחיר לתצוגה, בלי ₪: שלם בלי נקודה ("30"), עשרוני עם שתי ספרות
 * ("12.90"). מעגל לאגורה קודם, כדי שסכום שיצא 30.000000000004 יוצג 30.
 */
function formatAmount(value) {
  const agorot = toAgorot(value);
  return agorot % 100 === 0 ? String(agorot / 100) : (agorot / 100).toFixed(2);
}

/** מחיר לתצוגה עם ₪: "₪12.90" או "₪30". */
function formatPrice(value) {
  return `₪${formatAmount(value)}`;
}

module.exports = {
  MAX_PRICE, toAgorot, fromAgorot, parsePrice, lineTotal, formatAmount, formatPrice,
};
