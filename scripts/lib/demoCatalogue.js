/**
 * The pure parts of the demo catalogue tooling (plan 006, Phase 5): scanning text for things that must
 * never be published, parsing the owner's approved candidate sheet, and turning approved products into
 * catalogue entries. No database, no file: `scripts/demo-candidates.js` and
 * `scripts/demo-catalogue-build.js` call these, and `test/unit-demo-catalogue.js` tests them.
 */

/**
 * The (category, subcategory) pairs the project calculator asks the catalogue for. A product must
 * exist for each, or the calculator shows "ask in the store". Copied from
 * client/src/js/features/calculators/ProjectCalculator.js; update both together.
 */
const CALCULATOR_PAIRS = [
  ['adhesives', 'sealants'], ['bathroom', 'shower_curtains'], ['bathroom', 'towel_hooks'], ['bathroom', 'mirrors'],
  ['plumbing', 'drainage'], ['bathroom', 'accessories_bath'], ['locks', 'cylinders'], ['locks', 'door_hardware'],
  ['locks', 'keys_accessories'], ['locks', 'security_chains'], ['locks', 'code_locks'], ['garden', 'watering'],
  ['garden', 'garden_tools'], ['garden', 'plant_care'], ['garden', 'outdoor'], ['home', 'pergola'],
  ['tools', 'general_tools'], ['plumbing', 'feed_valves'], ['plumbing', 'plastic_connectors'],
  ['plumbing', 'waterproofing'], ['plumbing', 'nipples'], ['faucets', 'accessories_faucets'],
];

/**
 * The products the paint calculator adds by id (PaintCalculator.js BUNDLE_PRODUCT_IDS). The demo
 * catalogue keeps these three ids so the bundle works; every other product is renumbered.
 */
const BUNDLE_PRODUCT_IDS = { paint5: 627, paint18: 628, colorMix: 416 };

/** What must not appear in any published text: a phone number, a URL, an email, a WhatsApp mention. */
const FORBIDDEN_TEXT = [
  ['phone', /(?:\+?972|0)[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}\b/],
  ['url', /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|co\.il|net|org|il)\b/i],
  ['email', /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ['whatsapp', /whatsapp|וואטסאפ|ווטסאפ|וואצאפ/i],
];

/** Words that hint at a supplier, importer, contact or street address (a warning, not a refusal). */
const HINT_TEXT = [
  ['supplier', /ספק|יבואן|יבוא\b|מפיץ|יצרן|בע"מ|בע״מ/],
  ['address', /רחוב|רח'|שדרות|כתובת/],
  ['contact', /טלפון|טל'|התקשר|צרו קשר|פקס/],
];

/** The kinds of forbidden content found in a text (empty when clean). */
function forbiddenIn(text) {
  const value = String(text ?? '');
  return FORBIDDEN_TEXT.filter(([, pattern]) => pattern.test(value)).map(([kind]) => kind);
}

/** Every warning for a text: forbidden kinds and softer hints. */
function warningsIn(text) {
  const value = String(text ?? '');
  return [...forbiddenIn(value), ...HINT_TEXT.filter(([, pattern]) => pattern.test(value)).map(([kind]) => kind)];
}

/** Every string a product shows a visitor, for scanning. */
function textsOf(product) {
  return [
    product.name, product.description, product.sku, ...(product.sizes || []),
    ...(product.colors || []).map((color) => (typeof color === 'string' ? color : color.name)),
    ...(product.variants || []).map((variant) => variant.label),
  ];
}

/** A demonstration price: the real price moved by a fixed factor and rounded to a whole shekel (at least 1). */
function suggestedPrice(price) {
  return Math.max(1, Math.round(Number(price) * 0.9));
}

/** Parses one CSV line with double-quoted cells ("" escapes a quote). */
function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/**
 * Parses the candidate sheet the owner edited (a BOM and CRLF are tolerated) into row objects keyed by
 * the header names. Cells containing line breaks are not supported: the sheet is generated without them.
 */
function parseCandidateCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((name, i) => [name, (cells[i] ?? '').trim()]));
  });
}

/** Whether the owner marked a row as selected (x, v, 1, yes or כן). */
function isSelected(row) {
  return /^(?:x|v|1|yes|y|true|כן)$/i.test(String(row.select ?? '').trim());
}

/**
 * Builds catalogue entries from the approved rows and the development products they point at.
 *
 *  - ids: the three calculator bundle products keep their ids; everything else is renumbered 1..N in
 *    the order of the sheet, skipping the reserved ones;
 *  - sku: DEMO-001.. in sheet order; the real SKU is never published;
 *  - price: the sheet's demo_price when filled, otherwise the suggested one; variants keep their
 *    structure with prices moved by the same factor;
 *  - name and description: the sheet's demo_name and demo_description when filled, otherwise the
 *    originals, and a text that still carries a warning stops the build;
 *  - images: the primary image and the gallery, published under content-hash names (`publicName`).
 * Returns { catalogue, images, problems }: problems lists every row that cannot be published as is.
 */
function buildCatalogue(rows, productsById, { publicName = (file) => file } = {}) {
  const reserved = new Set(Object.values(BUNDLE_PRODUCT_IDS));
  let next = 0;
  const nextId = () => {
    do { next += 1; } while (reserved.has(next));
    return next;
  };

  const catalogue = [];
  const images = [];
  const problems = [];

  rows.filter(isSelected).forEach((row, index) => {
    const original = productsById.get(Number(row.id));
    if (!original) { problems.push(`שורה ${index + 1}: מוצר ${row.id} אינו במסד`); return; }

    const id = reserved.has(Number(row.id)) ? Number(row.id) : nextId();
    const price = row.demo_price !== undefined && row.demo_price !== '' ? Number(row.demo_price) : suggestedPrice(original.price);
    const factor = original.price > 0 ? price / Number(original.price) : 1;
    const variants = (original.variants || []).map((variant) => ({
      label: variant.label,
      price: Math.max(1, Math.round(Number(variant.price) * factor)),
    }));
    const entry = {
      id,
      name: row.demo_name || original.name,
      category: original.category,
      // demo_subcategory: an owner-reviewed reassignment into the store's category tree (for example a
      // silicone cartridge into `sealants`, which the project calculator asks for)
      subcategory: row.demo_subcategory || original.subcategory,
      sku: `DEMO-${String(catalogue.length + 1).padStart(3, '0')}`,
      description: row.demo_description !== undefined && row.demo_description !== '' ? row.demo_description : (original.description || ''),
      price: variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : price,
      colors: original.colors || [],
      sizes: original.sizes || [],
      variants,
      in_stock: row.demo_in_stock ? !/^(?:0|no|false|לא)$/i.test(row.demo_in_stock) : original.in_stock !== false,
      active: row.demo_active ? !/^(?:0|no|false|לא)$/i.test(row.demo_active) : original.active !== false,
      image_illustrative: original.image_illustrative === true,
      image_url: '',
      images: [],
    };

    // The primary image and the gallery, as WebP files in uploads/. publicName(file) returns the name the
    // file is published under (its content hash, so no internal product id is published) or null when
    // the file does not exist. A reference to a missing or non-WebP file is dropped: the product then
    // shows its category icon.
    const sources = [original.image_url, ...(Array.isArray(original.images) ? original.images : [])]
      .map((url) => /^\/uploads\/([^/]+\.webp)$/.exec(String(url || '')))
      .filter(Boolean)
      .map((match) => match[1]);
    const published = [...new Set(sources)].map((file) => publicName(file)).filter(Boolean);
    if (published.length > 0) {
      entry.image_url = `/uploads/${published[0]}`;
      entry.images = published.map((name) => `/uploads/${name}`);
      images.push(...published);
    }

    for (const text of textsOf(entry)) {
      const found = warningsIn(text);
      if (found.length > 0) problems.push(`מוצר ${row.id} ("${entry.name}"): ${found.join(', ')} — ערכו demo_name או demo_description בגיליון`);
    }
    if (!(entry.price > 0)) problems.push(`מוצר ${row.id}: מחיר ההדגמה חייב להיות גדול מאפס`);
    catalogue.push(entry);
  });

  return { catalogue, images: [...new Set(images)], problems };
}

/** The calculator pairs no in-stock, active product covers. */
function uncoveredPairs(catalogue) {
  return CALCULATOR_PAIRS.filter(([category, subcategory]) => !catalogue.some((product) => product.category === category
    && product.subcategory === subcategory && product.active !== false && product.in_stock !== false));
}

module.exports = {
  CALCULATOR_PAIRS, BUNDLE_PRODUCT_IDS, FORBIDDEN_TEXT, forbiddenIn, warningsIn, textsOf, suggestedPrice,
  parseCsvLine, parseCandidateCsv, isSelected, buildCatalogue, uncoveredPairs,
};
