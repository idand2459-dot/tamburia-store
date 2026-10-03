/**
 * מוצר בלי מחיר: מי נחשב כזה, ומה מוצג במקום הסכום.
 *
 * במסד יש מוצרים שהמחיר שלהם 0 — לא מבצע ולא טעות חישוב, אלא מוצר
 * שהמחיר שלו עוד לא הוקלד. עד עכשיו החנות הציגה אותם "₪0" ואפשר היה
 * להזמין אותם, וגם נוצרו הזמנות כאלה. מוצר כזה מוצג עכשיו "מחיר
 * בחנות", ואי אפשר להוסיף אותו לעגלה.
 *
 * הבדיקה יושבת כאן ולא בכל רכיב, כי היא נדרשת בחמישה מקומות — כרטיס
 * המוצר, עמוד המוצר, פס הקנייה, המועדפים ותוצאות החיפוש — וגם באדמין,
 * לסינון ולתגית. אותו כלל עצמו נאכף שוב בשרת (server/services/
 * order.service.js), כי הקליינט הוא הצעה והשרת הוא ההחלטה.
 *
 * למוצר עם גרסאות המחיר מגיע מהגרסה, ולכן גרסה מתומחרת אחת מספיקה
 * כדי שהמוצר יהיה מוצר עם מחיר. הבחירה בין הגרסות היא עניין של עמוד
 * המוצר.
 */

/** מה שמוצג במקום סכום כשאין מחיר. */
export const NO_PRICE_LABEL = 'מחיר בחנות';

/** מה שכתוב על הכפתור שמחליף את "הוסף לעגלה". */
export const CALL_FOR_PRICE_LABEL = 'התקשרו לבירור מחיר';

/**
 * מה שמוצג על מוצר שכבר אינו בקטלוג.
 *
 * "לא זמין כרגע" ולא "נמחק": מוצר מוסתר נשאר במסד ויכול לחזור בלחיצה,
 * והלקוח שרואה אותו במועדפים או בעגלה לא צריך לדעת מה קרה בצד שלנו.
 * מי מוסתר נקבע בשרת ומגיע דרך hooks/useAvailability.js.
 */
export const UNAVAILABLE_LABEL = 'לא זמין כרגע';

/* ---- אגורות ותצוגה --------------------------------------------------------
   מחירים יכולים להיות עשרוניים (12.90). כל חיבור והשוואה נעשים באגורות,
   שהן מספרים שלמים, כי float אינו מדויק: 12.9 * 3 הוא 38.699999999999996.
   אותם כללים בדיוק יושבים בשרת, ב-server/utils/money.js. */

/** שקלים → אגורות, מספר שלם. */
export function toAgorot(value) {
  return Math.round(Number(value) * 100);
}

/** מחיר ⨉ כמות, מדויק באגורה. */
export function lineTotal(price, quantity = 1) {
  return (toAgorot(price) * quantity) / 100;
}

/** סכום של מחירים, מדויק באגורה. */
export function sumPrices(values) {
  return values.reduce((sum, value) => sum + toAgorot(value), 0) / 100;
}

/**
 * סכום לתצוגה, בלי ₪: שלם בלי נקודה ("30"), עשרוני עם שתי ספרות
 * ("12.90"). מעוגל לאגורה קודם, כדי ש-30.000000000004 יוצג 30.
 */
export function formatAmount(value) {
  const agorot = toAgorot(value);
  return agorot % 100 === 0 ? String(agorot / 100) : (agorot / 100).toFixed(2);
}

/** סכום לתצוגה עם ₪: "₪12.90" או "₪30". */
export function formatPrice(value) {
  return `₪${formatAmount(value)}`;
}

/**
 * מפענח מחיר שהוקלד בשדה: "12.90", "12,90" (פסיק ישראלי), "12.9" או
 * "30". מחזיר מספר אי-שלילי, או null כשהטקסט אינו מחיר — כולל יותר
 * משתי ספרות אחרי הנקודה, שעדיף לדחות מאשר לעגל בשקט.
 */
export function parsePriceInput(text) {
  const normalized = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return toAgorot(normalized) / 100;
}

/** מספר חיובי או null. 0, null, טקסט וכל השאר הם "אין מחיר". */
function asPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** הגרסאות שיש להן מחיר. מערך ריק כשאין גרסאות כלל. */
function pricedVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.filter((variant) => asPrice(variant?.price) !== null);
}

/**
 * המחיר הנמוך שאפשר להזמין בו את המוצר, או null כשאין מחיר.
 *
 * זה גם המחיר ש"מ-₪" מציג בכרטיס: הזול מבין הגרסאות *המתומחרות*,
 * ולא מבין כולן, כדי שהמספר על הכרטיס יהיה מספר שאפשר להזמין בו.
 */
export function orderablePrice(product) {
  const priced = pricedVariants(product);
  if (priced.length > 0) return Math.min(...priced.map((v) => Number(v.price)));
  return asPrice(product?.price);
}

/**
 * ממיין מוצרים לפי המחיר שמוצג בכרטיס, 'asc' או 'desc'. מחזיר עותק.
 *
 * מוצר בלי מחיר הולך תמיד לסוף, בשני הכיוונים: מחיר 0 אינו "הכי זול",
 * הוא "מחיר בחנות", ולמעלה ברשימה הוא דחק את המוצרים שאפשר לקנות.
 * המיון יציב, כך שבין מוצרים בלי מחיר נשמר הסדר שהגיעו בו.
 */
export function sortByPrice(products, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1;
  return [...products].sort((a, b) => {
    const pa = orderablePrice(a);
    const pb = orderablePrice(b);
    if (pa === null || pb === null) return (pa === null) - (pb === null);
    return sign * (pa - pb);
  });
}

/** האם אפשר להזמין את המוצר, כלומר יש לו מחיר. */
export function hasPrice(product) {
  return orderablePrice(product) !== null;
}

/** "₪12.90", "₪30" או "מחיר בחנות" — למי שרק מציג ולא משנה גם עיצוב. */
export function priceLabel(product) {
  const price = orderablePrice(product);
  return price === null ? NO_PRICE_LABEL : formatPrice(price);
}

/**
 * המחיר שיש להציג עבור בחירה מסוימת בעמוד המוצר, או null.
 * גרסה שנבחרה קובעת; בלי גרסה נבחרת המחיר הוא של המוצר עצמו.
 */
export function selectedPrice(product, selectedVariant) {
  if (selectedVariant) return asPrice(selectedVariant.price);
  return asPrice(product?.price);
}
