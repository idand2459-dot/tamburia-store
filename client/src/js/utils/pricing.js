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

/** האם אפשר להזמין את המוצר, כלומר יש לו מחיר. */
export function hasPrice(product) {
  return orderablePrice(product) !== null;
}

/** "₪12" או "מחיר בחנות" — למי שרק מציג ולא משנה גם עיצוב. */
export function priceLabel(product) {
  const price = orderablePrice(product);
  return price === null ? NO_PRICE_LABEL : `₪${price}`;
}

/**
 * המחיר שיש להציג עבור בחירה מסוימת בעמוד המוצר, או null.
 * גרסה שנבחרה קובעת; בלי גרסה נבחרת המחיר הוא של המוצר עצמו.
 */
export function selectedPrice(product, selectedVariant) {
  if (selectedVariant) return asPrice(selectedVariant.price);
  return asPrice(product?.price);
}
