/**
 * מתרגם HTTP לדומיין המוצרים: מאמת קלט בוולידטור, קורא לשירות ומחזיר
 * תשובה. אינו ניגש למודל, אינו כותב SQL ואינו תופס שגיאות — הן עולות
 * למטפל המרכזי.
 *
 * מי רואה מוצר מוסתר מוכרע ב-services/product.service. מכאן עובר רק
 * req.isAdmin, שמגיע מ-markAdmin.
 */
const productService = require('../services/product.service');
const { parseCreate, parseUpdate, parseListQuery } = require('../validators/product.validator');
const { sendList } = require('../utils/paginate');

/** GET /api/products — מחזיר רשימת מוצרים, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const { products, total } = await productService.listProducts(options, { isAdmin: req.isAdmin });
  sendList(res, 'products', products, total, options);
}

/** GET /api/products/:id — מחזיר מוצר בודד. */
async function getOne(req, res) {
  res.json(await productService.getProduct(req.id, { isAdmin: req.isAdmin }));
}

/** POST /api/products — יוצר מוצר חדש. */
async function create(req, res) {
  const data = parseCreate(req.body);
  res.status(201).json(await productService.createProduct(data));
}

/** PUT /api/products/:id — מעדכן את השדות שנשלחו בלבד. */
async function update(req, res) {
  const data = parseUpdate(req.body);
  res.json(await productService.updateProduct(req.id, data));
}

/**
 * DELETE /api/products/:id — מוחק מוצר בלי הזמנות, עם הביקורות שלו
 * ותמונות שאף מוצר אחר אינו משתמש בהן. מוצר עם הזמנות → 409.
 */
async function remove(req, res) {
  const { product, reviews, files } = await productService.removeProduct(req.id);
  res.json({ message: 'נמחק', product, deleted: { reviews, files } });
}

/** GET /api/products/categories — הקטגוריות הקיימות בחנות. */
async function categories(req, res) {
  res.json(await productService.listCategories());
}

module.exports = { list, getOne, create, update, remove, categories };
