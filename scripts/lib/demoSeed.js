/**
 * The demo seed: writes the curated rows of the portfolio demo database inside one transaction.
 * Used only by `demo:bootstrap` and `demo:seed` (never by the server), and only after the marker
 * rules in scripts/lib/demoTarget.js and the scripts themselves have passed.
 *
 * Deterministic and idempotent: a fixed order, fixed values, and an upsert by a natural key
 * (products by their explicit demo id, reviews by their explicit id, pigment formulas by
 * color_code, demo orders by their `demo-seed:NN` tag in request_id). Running it twice changes only
 * the seeded created_at values, which are anchored to the run time.
 *
 * The data comes from scripts/demo-data/: catalogue.json (written by `demo-catalogue-build` from
 * the owner-approved catalogue of real products, built by `npm run demo:catalogue`.
 */
const fs = require('fs');
const path = require('path');
const { IDENTITIES, IDENTITY_PHONES, SEED_TAG_PREFIX } = require('../../server/api/demo/demo.rules');
const { toAgorot, fromAgorot } = require('../../server/utils/money');

const DATA_DIR = path.join(__dirname, '..', 'demo-data');

/** Reads one JSON file of the demo data. */
function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

/** Loads every data file. The catalogue is the owner-approved one: there is no fallback to made-up data. */
function loadData() {
  const catalogueSource = 'catalogue.json';
  return {
    catalogueSource,
    catalogue: readJson(catalogueSource),
    pigments: readJson('pigment-formulas.json'),
    reviews: readJson('reviews.json'),
    orders: readJson('orders.json'),
  };
}

/** One seeded order, priced from the catalogue the same way the server prices a real one. */
function buildOrder(spec, catalogueById, deliveryFee) {
  const identity = IDENTITIES.find((item) => item.key === spec.identity);
  if (!identity) throw new Error(`orders.json: זהות לא מוכרת בהזמנה ${spec.key}`);

  const items = spec.items.map((line) => {
    const product = catalogueById.get(line.product);
    if (!product) throw new Error(`orders.json: מוצר ${line.product} אינו בקטלוג (הזמנה ${spec.key})`);
    const variant = line.variant ? product.variants.find((v) => v.label === line.variant) : null;
    if (line.variant && !variant) throw new Error(`orders.json: גרסה לא קיימת במוצר ${line.product}`);
    return {
      id: product.id,
      name: product.name,
      price: variant ? variant.price : product.price,
      quantity: line.quantity,
      selectedVariant: line.variant || null,
      selectedColor: line.color || null,
      selectedSize: line.size || null,
    };
  });

  const subtotalAgorot = items.reduce((sum, item) => sum + toAgorot(item.price) * item.quantity, 0);
  const fee = spec.delivery_method === 'delivery' ? deliveryFee : 0;
  return {
    request_id: `${SEED_TAG_PREFIX}${spec.key}`,
    customer_name: identity.customer_name,
    customer_phone: identity.customer_phone,
    customer_email: identity.customer_email,
    delivery_method: spec.delivery_method,
    delivery_address: spec.delivery_method === 'delivery' ? identity.delivery_address : null,
    notes: spec.notes,
    items,
    subtotal: fromAgorot(subtotalAgorot),
    delivery_fee: fee,
    total: fromAgorot(subtotalAgorot + toAgorot(fee)),
    status: spec.status,
    daysAgo: spec.daysAgo,
  };
}

/**
 * Writes the seed with `client` (already inside a transaction). With `reset`, also deletes every
 * visitor order (not a seeded one, and carrying one of the three identity phones).
 * Returns the counts, for the script to print.
 */
async function seed(client, { reset = false } = {}) {
  const config = require('../../server/config/env');
  const data = loadData();
  const catalogueById = new Map(data.catalogue.map((product) => [product.id, product]));

  for (const shade of data.pigments) {
    await client.query(
      `INSERT INTO pigment_formulas
         (color_code, color_name_he, hex, ml_per_liter_light, ml_per_liter_medium, ml_per_liter_dark, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (color_code) DO UPDATE SET
         color_name_he = EXCLUDED.color_name_he, hex = EXCLUDED.hex,
         ml_per_liter_light = EXCLUDED.ml_per_liter_light, ml_per_liter_medium = EXCLUDED.ml_per_liter_medium,
         ml_per_liter_dark = EXCLUDED.ml_per_liter_dark, sort_order = EXCLUDED.sort_order`,
      [shade.color_code, shade.color_name_he, shade.hex, shade.ml_per_liter_light,
        shade.ml_per_liter_medium, shade.ml_per_liter_dark, shade.sort_order]
    );
  }

  for (const p of data.catalogue) {
    await client.query(
      `INSERT INTO products
         (id, name, price, stock, image_url, images, colors, sizes, category, subcategory, sku,
          description, in_stock, variants, image_illustrative, active)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, price = EXCLUDED.price, image_url = EXCLUDED.image_url, images = EXCLUDED.images,
         colors = EXCLUDED.colors, sizes = EXCLUDED.sizes, category = EXCLUDED.category,
         subcategory = EXCLUDED.subcategory, sku = EXCLUDED.sku, description = EXCLUDED.description,
         in_stock = EXCLUDED.in_stock, variants = EXCLUDED.variants,
         image_illustrative = EXCLUDED.image_illustrative, active = EXCLUDED.active`,
      [p.id, p.name, p.price, p.image_url || '', JSON.stringify(p.images || []), JSON.stringify(p.colors || []),
        p.sizes || [], p.category, p.subcategory, p.sku, p.description, p.in_stock, JSON.stringify(p.variants || []),
        p.image_illustrative, p.active]
    );
  }
  // Products were inserted with explicit ids: move the sequence past them so a product the owner adds
  // in the demo does not collide.
  await client.query(
    "SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT GREATEST(MAX(id), 1) FROM products))"
  );

  for (const r of data.reviews) {
    await client.query(
      `INSERT INTO reviews (id, reviewer_name, rating, text, type, product_id, approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - make_interval(days => $8::int))
       ON CONFLICT (id) DO UPDATE SET
         reviewer_name = EXCLUDED.reviewer_name, rating = EXCLUDED.rating, text = EXCLUDED.text,
         type = EXCLUDED.type, product_id = EXCLUDED.product_id, approved = EXCLUDED.approved,
         created_at = EXCLUDED.created_at`,
      [r.id, r.reviewer_name, r.rating, r.text, r.type, r.product_id, r.approved, r.daysAgo]
    );
  }
  await client.query(
    "SELECT setval(pg_get_serial_sequence('reviews', 'id'), (SELECT GREATEST(MAX(id), 1) FROM reviews))"
  );

  for (const spec of data.orders) {
    const o = buildOrder(spec, catalogueById, config.orders.deliveryFee);
    await client.query(
      `INSERT INTO orders
         (customer_name, customer_phone, customer_email, delivery_method, delivery_address, notes, items,
          subtotal, delivery_fee, total, status, created_at, request_id, picked_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - make_interval(days => $12::int), $13, '{}')
       ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO UPDATE SET
         customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone,
         customer_email = EXCLUDED.customer_email, delivery_method = EXCLUDED.delivery_method,
         delivery_address = EXCLUDED.delivery_address, notes = EXCLUDED.notes, items = EXCLUDED.items,
         subtotal = EXCLUDED.subtotal, delivery_fee = EXCLUDED.delivery_fee, total = EXCLUDED.total,
         status = EXCLUDED.status, created_at = EXCLUDED.created_at, picked_items = '{}'`,
      [o.customer_name, o.customer_phone, o.customer_email, o.delivery_method, o.delivery_address, o.notes,
        JSON.stringify(o.items), o.subtotal, o.delivery_fee, o.total, o.status, o.daysAgo, o.request_id]
    );
  }

  let visitorOrdersRemoved = 0;
  if (reset) {
    const { rowCount } = await client.query(
      `DELETE FROM orders
       WHERE (request_id IS NULL OR request_id NOT LIKE '${SEED_TAG_PREFIX}%') AND customer_phone = ANY($1::text[])`,
      [IDENTITY_PHONES]
    );
    visitorOrdersRemoved = rowCount;
  }

  return {
    catalogueSource: data.catalogueSource,
    pigments: data.pigments.length,
    products: data.catalogue.length,
    reviews: data.reviews.length,
    orders: data.orders.length,
    visitorOrdersRemoved,
  };
}

module.exports = { loadData, buildOrder, seed, DATA_DIR };
