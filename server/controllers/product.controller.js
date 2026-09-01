const Product = require('../models/product.model');
const { parseCreate, parseUpdate, parseListQuery } = require('../validators/product.validator');
const { notFound } = require('../utils/AppError');

/**
 * הקונטרולרים לא כותבים SQL ולא עושים try/catch —
 * שגיאות נזרקות והמטפל המרכזי הופך אותן לתשובת JSON.
 */

/** GET /api/products — L */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const products = await Product.list(options);

  // בלי pagination מחזירים מערך שטוח, כדי לא לשבור את הקליינט הקיים
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

/** GET /api/products/:id — R */
async function getOne(req, res) {
  const product = await Product.findById(req.id);
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
  res.json(product);
}

/** POST /api/products — C */
async function create(req, res) {
  const data = parseCreate(req.body);
  const product = await Product.create(data);
  res.status(201).json(product);
}

/** PUT /api/products/:id — U */
async function update(req, res) {
  const data = parseUpdate(req.body);
  const product = await Product.update(req.id, data);
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
  res.json(product);
}

/** DELETE /api/products/:id — D */
async function remove(req, res) {
  const product = await Product.remove(req.id);
  if (!product) throw notFound(`מוצר ${req.id} לא נמצא`);
  res.json({ message: 'נמחק', product });
}

/** GET /api/products/categories */
async function categories(req, res) {
  res.json(await Product.listCategories());
}

module.exports = { list, getOne, create, update, remove, categories };
