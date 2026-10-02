/**
 * מתמחר הזמנה מתוך הקטלוג.
 *
 * עד כאן המחיר של כל פריט הגיע מגוף הבקשה. הוולידטור בדק שהוא מספר
 * אי-שלילי וחיבר ממנו את הסכומים, כך שבקשה ישירה ל-API יכלה לקבוע
 * לעצמה כל מחיר — כולל 1 ₪ לדלי צבע — וההזמנה הייתה נשמרת עם הסכום
 * הזה, נשלחת במייל ומופיעה במסך הניהול ככל הזמנה אחרת.
 *
 * עכשיו המחיר נקבע כאן ורק מהמסד: מחיר המוצר, או — אם נבחרה גרסה —
 * מחיר הגרסה מתוך product.variants לפי התווית שנשלחה. מה שהקליינט
 * שולח משמש להשוואה בלבד.
 *
 * ההשוואה אינה קפדנות לשמה. אם המחיר השתנה בזמן שהמוצר שכב בעגלה,
 * ההזמנה נדחית ב-409 במקום להישמר בשקט במחיר החדש: הלקוח לא מאשר
 * סכום שלא ראה. עם התשובה חוזרים המחירים העדכניים, כדי שהעגלה תוכל
 * לתקן את עצמה ולהציג את הסכום החדש לפני ניסיון שני.
 *
 * פריט שאי אפשר לזהות בקטלוג — בלי מזהה, או מזהה שאינו קיים — נדחה.
 * בלי מוצר במסד אין ממה לגזור מחיר, וזו בדיוק הדלת שנסגרת כאן.
 *
 * וכך גם מוצר שהוסתר: הוא עדיין במסד, כי הזמנות ישנות מפנות אליו,
 * אבל הוא אינו בקטלוג. עגלה נשמרת ב-localStorage, ולכן מוצר שהוסתר
 * אחרי שנכנס אליה עוד יגיע לכאן — והדחייה כאן היא זו שנחשבת.
 */
const Product = require('../models/product.model');
const config = require('../config/env');
const { badRequest, conflict } = require('../utils/AppError');
const { toAgorot, fromAgorot, formatPrice } = require('../utils/money');

/** מספר חיובי, או null. 0 אינו מחיר אלא סימן שהמחיר לא הוקלד. */
function asPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** ההודעה על מוצר שאין לו מחיר באתר. */
function noPriceError(name) {
  return badRequest(
    `לא ניתן להזמין את "${name}" — המחיר שלו עוד לא עודכן באתר. `
    + 'אנא הסירו אותו מהעגלה והתקשרו לחנות לבירור מחיר'
  );
}

/** ההודעה על מוצר שכבר אינו בקטלוג. */
function hiddenError(name) {
  return badRequest(
    `לא ניתן להזמין את "${name}" — המוצר אינו זמין כרגע. `
    + 'אנא הסירו אותו מהעגלה והתקשרו לחנות לבירור'
  );
}

/**
 * המחיר שהקטלוג קובע לפריט, או null כשאין לו מחיר.
 *
 * נבחרה גרסה — היא שקובעת, ותווית שאינה קיימת במוצר היא 400: היא
 * מתארת משהו שלא ניתן למכור, וניחוש של הגרסה הזולה במקומה היה בדיוק
 * סוג ההשלמה שהפרצה הזו נסגרת כדי למנוע.
 *
 * לא נבחרה גרסה — המחיר של המוצר עצמו. למוצר עם גרסאות זהו ממילא
 * מחיר הגרסה הזולה, כי כך product.validator מחשב אותו בשמירה.
 */
function catalogPrice(product, item) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (item.selectedVariant) {
    const variant = variants.find((v) => String(v?.label) === item.selectedVariant);
    if (!variant) {
      throw badRequest(`הגרסה "${item.selectedVariant}" אינה קיימת עבור "${product.name}"`);
    }
    return asPrice(variant.price);
  }

  return asPrice(product.price);
}

/** שורה אחת ב-details של 409 — מה שהעגלה צריכה כדי לתקן את עצמה. */
function currentPrice(item, price) {
  return { id: item.id, selectedVariant: item.selectedVariant, price };
}

/**
 * מחזיר את ההזמנה עם המחירים והסכומים של השרת.
 *
 * זורק לפני שנכתב דבר: 400 על פריט שאי אפשר לתמחר, ו-409 על פריט
 * שהמחיר שלו השתנה. הבדיקות רצות על כל הפריטים לפני ההחלטה, כדי
 * שהתשובה תישא את כל המחירים העדכניים ולא רק את הראשון שנתפס —
 * אחרת עגלה עם שני מוצרים שהתייקרו הייתה נדחית פעמיים.
 */
async function priceOrder(data) {
  const items = Array.isArray(data.items) ? data.items : [];

  const ids = [...new Set(items.map((item) => item.id).filter(Boolean))];
  const rows = await Product.findPricesByIds(ids);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const priced = [];
  const changed = [];
  let firstChanged = null;

  for (const item of items) {
    const product = item.id ? byId.get(item.id) : null;
    if (!product) {
      throw badRequest(
        `"${item.name}" כבר אינו בקטלוג החנות. אנא הסירו אותו מהעגלה ונסו שוב`
      );
    }

    // לפני המחיר: מוצר שאינו בקטלוג לא יימכר גם אם יש לו מחיר.
    if (product.active === false) throw hiddenError(product.name);

    const price = catalogPrice(product, item);
    if (price === null) throw noPriceError(product.name);

    // השם נלקח גם הוא מהמסד: צילום ההזמנה אמור לתאר את מה שנמכר,
    // ולא את מה שהבקשה טענה שנמכר.
    const line = { ...item, name: product.name, price };
    priced.push(line);

    // באגורות ולא ב-!==: 12.9 ו-12.90 הם אותו מחיר, ו-float אינו
    // מבטיח ששני ייצוגים של אותו סכום יהיו זהים בדיוק.
    if (toAgorot(item.price) !== toAgorot(price)) {
      changed.push(currentPrice(item, price));
      if (!firstChanged) firstChanged = line;
    }
  }

  if (firstChanged) {
    throw conflict(
      `המחיר של ${firstChanged.name} עודכן ל-${formatPrice(firstChanged.price)}. בדקו את העגלה ונסו שוב`,
      { prices: changed }
    );
  }

  // הסכומים באגורות, ורק בסוף חזרה לשקלים: 3 × 12.90 הוא 38.70 ולא
  // 38.699999999999996.
  const subtotal = priced.reduce((sum, item) => sum + toAgorot(item.price) * item.quantity, 0);
  const deliveryFee = data.delivery_method === 'delivery' ? toAgorot(config.orders.deliveryFee) : 0;

  return {
    ...data,
    items: priced,
    subtotal: fromAgorot(subtotal),
    delivery_fee: fromAgorot(deliveryFee),
    total: fromAgorot(subtotal + deliveryFee),
  };
}

module.exports = { priceOrder };
