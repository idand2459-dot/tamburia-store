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
 */
const Product = require('../models/product.model');
const config = require('../config/env');
const { badRequest, conflict } = require('../utils/AppError');

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

    const price = catalogPrice(product, item);
    if (price === null) throw noPriceError(product.name);

    // השם נלקח גם הוא מהמסד: צילום ההזמנה אמור לתאר את מה שנמכר,
    // ולא את מה שהבקשה טענה שנמכר.
    const line = { ...item, name: product.name, price };
    priced.push(line);

    if (item.price !== price) {
      changed.push(currentPrice(item, price));
      if (!firstChanged) firstChanged = line;
    }
  }

  if (firstChanged) {
    throw conflict(
      `המחיר של ${firstChanged.name} עודכן ל-₪${firstChanged.price}. בדקו את העגלה ונסו שוב`,
      { prices: changed }
    );
  }

  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery_fee = data.delivery_method === 'delivery' ? config.orders.deliveryFee : 0;

  return { ...data, items: priced, subtotal, delivery_fee, total: subtotal + delivery_fee };
}

module.exports = { priceOrder };
