/**
 * מטפל בבקשות דומיין המוצרים: מאמת קלט, קורא למודל ומחזיר תשובה.
 * אינו כותב SQL ואינו תופס שגיאות — הן עולות למטפל המרכזי.
 */
const Product = require('../models/product.model');
const { parseCreate, parseUpdate, parseListQuery } = require('../validators/product.validator');
const { notFound } = require('../utils/AppError');

/** GET /api/products — מחזיר רשימת מוצרים, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);
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
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
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

/** DELETE /api/products/:id — מוחק מוצר. */
async function remove(req, res) {
  const product = await Product.remove(req.id);
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
  res.json({ message: 'נמחק', product });
}

/** GET /api/products/categories — מחזיר את הקטגוריות הקיימות. */
async function categories(req, res) {
  res.json(await Product.listCategories());
}

module.exports = { list, getOne, create, update, remove, categories };
