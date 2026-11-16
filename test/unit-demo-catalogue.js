/**
 * The demo data files (plan 006, Phase 5) and the tooling that builds them: nothing private, nothing
 * invalid, nothing missing. No database and no network.
 *
 * Checked for every catalogue that exists (the approved catalogue.json and the synthetic
 * catalogue.json): every entry passes the product validator; no real SKU; no phone, URL, email
 * or WhatsApp text; no price 0; every referenced image is bundled and every bundled image is
 * referenced and named by its content hash; the bundle stays under 8 MB. Also the pigment, review and
 * order data, and the pure functions of scripts/lib/demoCatalogue.js on fixtures.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseCreate } = require('../server/api/product/product.validator');
const { load: loadCategories } = require('../server/utils/categories');
const { REVIEWER_NAMES, IDENTITIES } = require('../server/api/demo/demo.rules');
const {
  CALCULATOR_PAIRS, BUNDLE_PRODUCT_IDS, forbiddenIn, warningsIn, textsOf, suggestedPrice, parseCandidateCsv,
  buildCatalogue, uncoveredPairs,
} = require('../scripts/lib/demoCatalogue');

let passed = 0;
let failed = 0;

/** רושם תוצאה של בדיקה בודדת. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'scripts', 'demo-data');
const ASSETS = path.join(ROOT, 'demo-assets', 'uploads');
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const taxonomy = loadCategories();

/** The image files bundled for the hosted demo, with their sizes. */
const bundled = fs.existsSync(ASSETS) ? fs.readdirSync(ASSETS).filter((name) => !name.startsWith('.')) : [];

for (const file of ['catalogue.json']) {
  if (!fs.existsSync(path.join(DATA, file))) {
    console.log(`\n── ${file}: אינו קיים (הקטלוג המאושר ייווצר אחרי אישור הבעלים)`);
    continue;
  }
  console.log(`\n── ${file}`);
  const catalogue = read(file);
  const sample = file.includes('sample');

  check('מערך לא ריק, מזהים ייחודיים ושלמים', Array.isArray(catalogue) && catalogue.length > 0
    && new Set(catalogue.map((p) => p.id)).size === catalogue.length && catalogue.every((p) => Number.isInteger(p.id) && p.id > 0));

  const invalid = catalogue.filter((p) => {
    try { parseCreate(p); return false; } catch { return true; }
  }).map((p) => p.id);
  check('כל מוצר עובר את הוולידטור של המוצרים', invalid.length === 0, invalid);

  // The category must be in the store's tree. A real product may carry no subcategory, or a free-text one
  // from an old import (the store shows such a product under "all": utils/subcategories.js lacksSubcategory),
  // and the real catalogue is kept as it is. The synthetic sample must be fully in the tree.
  const inTree = (p) => Boolean(taxonomy.categoryNames[p.category]);
  const subInTree = (p) => taxonomy.categories.find((c) => c.id === p.category).subcategories.some((s) => s.id === p.subcategory);
  const badTaxonomy = catalogue.filter((p) => !inTree(p) || (sample && !subInTree(p))).map((p) => p.id);
  check(sample ? 'קטגוריה ותת-קטגוריה קיימות בעץ החנות' : 'כל קטגוריה קיימת בעץ החנות', badTaxonomy.length === 0, badTaxonomy);
  if (!sample) console.log(`  — ${catalogue.filter((p) => inTree(p) && !subInTree(p)).length} מוצרים בלי תת-קטגוריה מהעץ (יוצגו תחת "הכל")`);

  check('מק"ט רק בצורה DEMO-###, בלי כפילויות', catalogue.every((p) => /^DEMO-\d{3}$/.test(p.sku)) && new Set(catalogue.map((p) => p.sku)).size === catalogue.length);
  check('אין מחיר 0 (גם בגרסאות)', catalogue.every((p) => p.price > 0 && (p.variants || []).every((v) => v.price > 0)));
  check('מחיר מוצר עם גרסאות הוא הזולה שבהן', catalogue.filter((p) => p.variants.length > 0)
    .every((p) => p.price === Math.min(...p.variants.map((v) => v.price))));

  const leaks = catalogue.flatMap((p) => textsOf(p).flatMap((text) => forbiddenIn(text).map((kind) => `${p.id}:${kind}`)));
  check('אין טלפון, כתובת אתר, אימייל או וואטסאפ בשום טקסט', leaks.length === 0, leaks);

  const referenced = [...new Set(catalogue.flatMap((p) => [p.image_url, ...(p.images || [])]).filter(Boolean))];
  check('תמונות רק בצורת /uploads/<hash>.webp', referenced.every((url) => /^\/uploads\/[0-9a-f]{16}\.webp$/.test(url)), referenced);
  if (sample) {
    check('קטלוג הדוגמה אינו מפנה לתמונות', referenced.length === 0, referenced);
  } else {
    check('כל תמונה שמוזכרת קיימת ב-demo-assets/uploads', referenced.every((url) => bundled.includes(url.replace('/uploads/', ''))));
    check('כל קובץ ב-demo-assets/uploads מוזכר בקטלוג', bundled.every((name) => referenced.includes(`/uploads/${name}`)),
      bundled.filter((name) => !referenced.includes(`/uploads/${name}`)));
  }

  const ids = new Set(catalogue.map((p) => p.id));
  check('שלושת מזהי חבילת הצבע (416, 627, 628) קיימים', Object.values(BUNDLE_PRODUCT_IDS).every((id) => ids.has(id)));

  const missing = uncoveredPairs(catalogue);
  if (sample) {
    check('כל צירופי המחשבון מכוסים במוצר זמין', missing.length === 0, missing);
    check('יש מוצרים שאזלו, מוצרים מוסתרים, מוצרים עם צבעים/מידות/גרסאות ותמונה להמחשה',
      catalogue.some((p) => !p.in_stock) && catalogue.some((p) => !p.active) && catalogue.some((p) => p.colors.length > 0)
      && catalogue.some((p) => p.sizes.length > 0) && catalogue.some((p) => p.variants.length > 0) && catalogue.some((p) => p.image_illustrative));
  } else if (missing.length > 0) {
    console.log(`  — צירופי מחשבון בלי מוצר (יוצג "שאל בחנות"): ${missing.map(([c, s]) => `${c}/${s}`).join(', ')}`);
  }

  if (!sample) {
    const total = bundled.reduce((sum, name) => sum + fs.statSync(path.join(ASSETS, name)).size, 0);
    check('חבילת התמונות קטנה מ-8MB', total < 8 * 1024 * 1024, total);
    const wrongNames = bundled.filter((name) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(ASSETS, name))).digest('hex').slice(0, 16)}.webp` !== name);
    check('שם כל קובץ שווה ל-hash של התוכן שלו', wrongNames.length === 0, wrongNames);
  }
}

console.log('\n── נוסחאות פיגמנט');
{
  const shades = read('pigment-formulas.json');
  check('20 גוונים, קודים ייחודיים', shades.length === 20 && new Set(shades.map((s) => s.color_code)).size === 20);
  check('hex תקין ושם בעברית לכל גוון', shades.every((s) => /^#[0-9A-Fa-f]{6}$/.test(s.hex) && /[א-ת]/.test(s.color_name_he)));
  check('מינונים שלמים וחיוביים, עולים מבהיר לכהה', shades.every((s) => [s.ml_per_liter_light, s.ml_per_liter_medium, s.ml_per_liter_dark].every((n) => Number.isInteger(n) && n > 0)
    && s.ml_per_liter_light < s.ml_per_liter_medium && s.ml_per_liter_medium < s.ml_per_liter_dark));
  const migration = fs.readFileSync(path.join(ROOT, 'server', 'db', 'migrations', '005_pigment_formulas_seed.sql'), 'utf8');
  check('אותם 20 קודי צבע כמו במיגרציה', shades.every((s) => migration.includes(`'${s.color_code}'`)));
}

console.log('\n── חוות דעת והזמנות');
{
  const reviews = read('reviews.json');
  const catalogue = read('catalogue.json');
  const ids = new Set(catalogue.map((p) => p.id));
  check('מבקרים רק מהרשימה הקבועה', reviews.every((r) => REVIEWER_NAMES.includes(r.reviewer_name)));
  check('אין טלפון, כתובת אתר או אימייל בטקסט חוות הדעת', reviews.every((r) => forbiddenIn(r.text).length === 0));
  check('דירוג 1-5, מזהים ייחודיים, מאושרות וממתינות קיימות', reviews.every((r) => r.rating >= 1 && r.rating <= 5)
    && new Set(reviews.map((r) => r.id)).size === reviews.length && reviews.some((r) => r.approved) && reviews.some((r) => !r.approved));
  check('חוות דעת על מוצר מצביעות על מוצר בקטלוג', reviews.filter((r) => r.product_id).every((r) => ids.has(r.product_id)));

  const orders = read('orders.json');
  check('הזמנות: מפתחות ייחודיים וזהות מוכרת', new Set(orders.map((o) => o.key)).size === orders.length
    && orders.every((o) => IDENTITIES.some((i) => i.key === o.identity)));
  check('הזמנות: מוצרים בקטלוג וסטטוס שמתאים לאופן הקבלה', orders.every((o) => o.items.every((line) => ids.has(line.product))
    && !(o.status === 'shipped' && o.delivery_method !== 'delivery') && !(o.status === 'ready_for_pickup' && o.delivery_method !== 'pickup')));
  check('יש הזמנות בכל הסטטוסים העיקריים', ['new', 'processing', 'ready_for_pickup', 'shipped', 'completed'].every((status) => orders.some((o) => o.status === status)));
}

console.log('\n── הכלים');
{
  check('forbiddenIn מזהה טלפון, כתובת אתר, אימייל ווטסאפ', ['התקשרו 052-1234567', 'www.example.com', 'a@b.co', 'שלחו הודעה בוואטסאפ']
    .every((text) => forbiddenIn(text).length > 0));
  check('forbiddenIn אינו נתקע על מידות ומקטים רגילים', ['180×200', 'DEMO-001', 'צינור 3/4 אינץ׳', 'כבל 3×1.5 מ"מ'].every((text) => forbiddenIn(text).length === 0));
  check('warningsIn מזהה רמזים לספק ולכתובת', warningsIn('מיובא על ידי יבואן בע"מ, רחוב הרצל').length >= 2);
  check('suggestedPrice מעגל ואינו יורד מ-1', suggestedPrice(100) === 90 && suggestedPrice(1) === 1 && suggestedPrice(12.9) === 12);

  const csv = '﻿select,id,name,price\r\nx,5,"שם, עם פסיק",10\r\n,6,"מרכאות ""כפולות""",20\r\n';
  const parsed = parseCandidateCsv(csv);
  check('פענוח CSV עם BOM, CRLF, פסיקים ומרכאות', parsed.length === 2 && parsed[0].name === 'שם, עם פסיק' && parsed[1].name === 'מרכאות "כפולות"', parsed);

  const products = new Map([
    [5, { id: 5, name: 'פטיש', category: 'tools', subcategory: 'general_tools', sku: 'REAL-SKU-1', price: 100, description: 'פטיש חזק', image_url: '/uploads/00c5ff8083a71b79.webp', variants: [], colors: [], sizes: [], in_stock: true, active: true }],
    [627, { id: 627, name: 'צבע', category: 'painting', subcategory: 'paints', sku: 'REAL-SKU-2', price: 200, description: 'צבע לבן', image_url: '/uploads/11c5ff8083a71b79.webp', variants: [{ label: '5', price: 200 }, { label: '18', price: 600 }], colors: [], sizes: [], in_stock: true, active: true }],
    [9, { id: 9, name: 'מוצר מסוכן', category: 'tools', subcategory: 'fastening', sku: 'X', price: 10, description: 'התקשרו 052-1234567', image_url: '', variants: [], colors: [], sizes: [], in_stock: true, active: true }],
  ]);
  const built = buildCatalogue(parseCandidateCsv('select,id,demo_price\r\nx,5,\r\nx,627,\r\n'), products);
  check('בנייה: אין בעיות במוצרים נקיים', built.problems.length === 0, built.problems);
  check('בנייה: מוצר רגיל מקבל מזהה 1, וגם המק"ט מוחלף ב-DEMO-001', built.catalogue[0].id === 1 && built.catalogue[0].sku === 'DEMO-001', built.catalogue[0]);
  check('בנייה: מוצר החבילה שומר את המזהה 627 והמק"ט DEMO-002', built.catalogue[1].id === 627 && built.catalogue[1].sku === 'DEMO-002');
  check('בנייה: מחיר מוצע, וגרסאות באותו יחס', built.catalogue[0].price === 90 && built.catalogue[1].variants.map((v) => v.price).join() === '180,540' && built.catalogue[1].price === 180, built.catalogue);
  check('בנייה: רק תמונות content-named, ללא מק"ט אמיתי', built.images.length === 2 && built.catalogue.every((p) => !p.sku.startsWith('REAL')));
  const risky = buildCatalogue(parseCandidateCsv('select,id\r\nx,9\r\n'), products);
  check('בנייה: טקסט עם טלפון עוצר את הבנייה', risky.problems.length > 0, risky.problems);
  const fixed = buildCatalogue(parseCandidateCsv('select,id,demo_description\r\nx,9,תיאור נקי\r\n'), products);
  check('בנייה: demo_description מתקן', fixed.problems.length === 0, fixed.problems);
  check('בנייה: שורה שלא סומנה אינה נכנסת', buildCatalogue(parseCandidateCsv('select,id\r\n,5\r\n'), products).catalogue.length === 0);
  check('בנייה: מזהה שאינו במסד נרשם כבעיה', buildCatalogue(parseCandidateCsv('select,id\r\nx,404\r\n'), products).problems.length === 1);
  check('צירופי המחשבון שהוגדרו הם 22', CALCULATOR_PAIRS.length === 22);
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
