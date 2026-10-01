/**
 * מטפל בבקשות דומיין המוצרים: מאמת קלט, קורא למודל ומחזיר תשובה.
 * אינו כותב SQL ואינו תופס שגיאות — הן עולות למטפל המרכזי.
 *
 * מוצר מוסתר (active = false) הוא מוצר שאינו על המדף. עבור הלקוח הוא
 * פשוט אינו קיים: לא ברשימה, לא בחיפוש, ובעמוד שלו 404. ההחלטה הזו
 * נופלת כאן ולא במודל, כי היא תלויה במי שואל — req.isAdmin, שמגיע
 * מ-markAdmin.
 *
 * לאדמין זו אינה הרשאה אלא בקשה: גם הוא מקבל מוצרים גלויים בלבד אלא
 * אם ביקש ?active=all או ?active=false במפורש. אחרת, אדמין עם חיבור
 * פתוח שגולש בחנות היה רואה בה מוצרים שהוא בעצמו הסתיר — ובודק את
 * העבודה שלו מול קטלוג שאף לקוח לא רואה.
 *
 * היוצא מן הכלל הוא שליפת מוצר בודד: טופס העריכה טוען לפי id, ובלי
 * החריג הזה לא היה אפשר להחזיר מוצר מוסתר לחנות.
 */
const Product = require('../models/product.model');
const productService = require('../services/product.service');
const { parseCreate, parseUpdate, parseListQuery } = require('../validators/product.validator');
const { notFound } = require('../utils/AppError');

/** GET /api/products — מחזיר רשימת מוצרים, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);

  // activeRequested הוא מה שנשלח, ו-active הוא מה שהמודל יסנן לפיו.
  // הראשון לא נכנס למודל: הוא נועד רק להכרעה כאן.
  const requested = options.activeRequested;
  delete options.activeRequested;

  if (!req.isAdmin || requested === undefined) options.active = true;

  const products = await Product.list(options);

  if (options.limit === undefined && options.offset === undefined) {
    return res.json(products);
  }

  const total = await Product.count(options);
  res.json({
    products,
    pagination: {
      total,
      limit: options.limit ?? total,
      offset: options.offset ?? 0,
    },
  });
}

/** GET /api/products/:id — מחזיר מוצר בודד. */
async function getOne(req, res) {
  const product = await Product.findById(req.id);

  // אותה 404 בדיוק למוצר שאינו קיים ולמוצר שהוסתר: הבחנה ביניהן
  // הייתה מספרת למי ששואל אילו מזהים קיימים במסד.
  if (!product || (!product.active && !req.isAdmin)) {
    throw notFound(`מוצר ${req.id} לא נמצא`);
  }
  res.json(product);
}

/** POST /api/products — יוצר מוצר חדש. */
async function create(req, res) {
  const data = parseCreate(req.body);
  const product = await Product.create(data);
  res.status(201).json(product);
}

/** PUT /api/products/:id — מעדכן את השדות שנשלחו בלבד. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const product = await Product.update(req.id, data);
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
  res.json(product);
}

/**
 * DELETE /api/products/:id — מוחק מוצר בלי הזמנות, עם הביקורות שלו
 * ותמונות שאף מוצר אחר אינו משתמש בהן. מוצר עם הזמנות → 409, ראו
 * services/product.service.
 */
async function remove(req, res) {
  const { product, reviews, files } = await productService.removeProduct(req.id);
  res.json({ message: 'נמחק', product, deleted: { reviews, files } });
}

/**
 * GET /api/products/categories — מחזיר את הקטגוריות הקיימות.
 *
 * תמיד הגלויים בלבד: הספירה הזו מתארת מה יש בחנות, וזו אותה תשובה
 * לכל מי ששואל. מסך הניהול סופר בעצמו מתוך הרשימה שהוא מושך.
 */
async function categories(req, res) {
  res.json(await Product.listCategories({ activeOnly: true }));
}

module.exports = { list, getOne, create, update, remove, categories };
