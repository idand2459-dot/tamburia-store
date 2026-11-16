/**
 * Paint calculator maths: the area, the liters, the pigment bottles, the cheaper bucket size,
 * and the two colour helpers of the live preview.
 *
 * Plain functions moved unchanged out of features/calculators/PaintCalculator.js (P3). The
 * component keeps the state, the product lookups and the JSX.
 */

/** נפח הדלי הגדול בליטרים, כפי שהחנות מוכרת אותו. */
export const LARGE_BUCKET_LITERS = 18;

/** מערבב צבע עם לבן לקבלת גוון בהיר יותר. */
export function blendWithWhite(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(255 * (1 - factor) + r * factor)},${Math.round(255 * (1 - factor) + g * factor)},${Math.round(255 * (1 - factor) + b * factor)})`;
}

/** בודק אם הצבע בהיר, כדי לבחור צבע טקסט מנוגד. */
export function isLight(rgb) {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return true;
  const [r, g, b] = match.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

/**
 * מחשב את שטח הצביעה ואת כמות הצבע והפיגמנט.
 *
 * formula היא נוסחת הגוון שנבחר (או undefined כשלא נבחר גוון), ו-shade הוא
 * 'light' | 'medium' | 'dark'. הערכים מוחזרים כפי שהמסך מציג אותם.
 */
export function calculatePaint({ walls, windows, doors, coats, formula, shade }) {
  const totalWallArea = walls.reduce((sum, w) => {
    return sum + (parseFloat(w.length) || 0) * (parseFloat(w.height) || 0);
  }, 0);
  const netArea = Math.max(0, totalWallArea - windows * 1.5 - doors * 2);
  const paintLiters = (netArea * coats) / 10;

  let colorMixBottles = 0;
  if (formula) {
    const mlPerLiter = formula[`ml_per_liter_${shade}`];
    colorMixBottles = Math.ceil((paintLiters * mlPerLiter) / 250);
  }

  return {
    totalWallArea: totalWallArea.toFixed(1),
    netArea: netArea.toFixed(1),
    paintLiters: Math.ceil(paintLiters * 10) / 10,
    paintCans5: Math.ceil(paintLiters / 5),
    paintCans18: Math.ceil(paintLiters / LARGE_BUCKET_LITERS),
    colorMixBottles,
  };
}

/**
 * בוחר את גודל הדלי שיוצא זול יותר לכמות הנדרשת.
 *
 * אותו נפח אפשר לכסות בדליים קטנים או גדולים, והזול מביניהם משתנה
 * לפי הכמות: 6 דליים של 5 ל' יקרים מ-2 דליים של 18 ל'. משווים את
 * העלות בפועל לפי המחירים מהקטלוג, ולא לפי מחיר קבוע בקוד.
 *
 * בתיקו נשאר 5 ל' — הוא הראשון ברשימה ו-reduce מחליף רק על "קטן ממש".
 * אין ערבוב בין הגדלים: נבחר גודל אחד לכל הכמות.
 *
 * findBundleProduct(key) מחזיר את מוצר הדלי אם נמצא והוא במלאי, אחרת null.
 */
export function cheaperBucket(result, findBundleProduct) {
  if (!result) return null;

  const options = [
    { key: 'paint5', quantity: result.paintCans5 },
    { key: 'paint18', quantity: result.paintCans18 },
  ]
    .filter(option => option.quantity > 0)
    .map(option => ({ ...option, product: findBundleProduct(option.key) }))
    .filter(option => option.product);

  if (options.length === 0) return null;

  return options.reduce((best, option) => (
    option.product.price * option.quantity < best.product.price * best.quantity ? option : best
  ));
}
