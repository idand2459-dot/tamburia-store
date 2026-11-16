/**
 * Lists the candidates for the portfolio demo catalogue, for the owner to approve (plan 006, Phase 5).
 * Owner-run; READ-ONLY against the development database: it only selects. Nothing is copied and nothing
 * is published by this script.
 *
 *   npm run demo:candidates
 *
 * Output (ignored by git, regenerated on every run):
 *   design-assets/demo-candidates.csv   — the sheet the owner edits and approves
 *   design-assets/demo-candidates.html  — the same list with thumbnails, to look at
 *
 * Products: active, in stock and priced above zero; the `image` column is filled only when the primary
 * image file exists in uploads/ (a product without one is shown with its category icon). The
 * owner marks about 36 of them in the `select` column (x), optionally fills demo_price, demo_name,
 * demo_description, demo_in_stock and demo_active, then runs `npm run demo:catalogue`. The sheet also
 * shows which (category, subcategory) pairs the calculators ask for are covered, and the 20 pigment
 * formulas as they are in the development database next to the migration's defaults, so the owner sees
 * any manual tuning.
 */
const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');
const productRepository = require('../server/api/product/product.repository');
const { fileExists } = require('./lib/uploads');
const { CALCULATOR_PAIRS, warningsIn, textsOf, suggestedPrice } = require('./lib/demoCatalogue');

const OUT_DIR = path.join(__dirname, '..', 'design-assets');
const CSV_PATH = path.join(OUT_DIR, 'demo-candidates.csv');
const HTML_PATH = path.join(OUT_DIR, 'demo-candidates.html');
const MIGRATION = path.join(__dirname, '..', 'server', 'db', 'migrations', '005_pigment_formulas_seed.sql');

const CSV_HEADER = [
  'select', 'id', 'name', 'category', 'subcategory', 'sku', 'price', 'suggested_price', 'image',
  'in_stock', 'active', 'warnings', 'demo_price', 'demo_name', 'demo_description', 'demo_in_stock', 'demo_active',
];

/** Escapes one CSV cell. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value).replace(/\r?\n/g, ' ');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Escapes text for HTML. */
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The migration's default dosages: { code: [light, medium, dark] }. */
function migrationDefaults() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const defaults = {};
  for (const match of sql.matchAll(/\('([a-z_]+)',\s*'[^']*',\s*'#[0-9A-Fa-f]{6}',\s*(\d+),\s*(\d+),\s*(\d+),/g)) {
    defaults[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return defaults;
}

async function main() {
  const products = await productRepository.list({ active: true, inStock: true });
  const candidates = products
    .filter((p) => Number(p.price) > 0)
    .map((p) => ({ ...p, hasImage: fileExists(p.image_url), warnings: [...new Set(textsOf(p).flatMap((text) => warningsIn(text)))] }));

  const rows = [CSV_HEADER.join(',')];
  for (const p of candidates) {
    rows.push([
      '', p.id, p.name, p.category, p.subcategory, p.sku, p.price, suggestedPrice(p.price), p.hasImage ? p.image_url : '',
      p.in_stock, p.active, p.warnings.join(' '), '', '', '', '', '',
    ].map(csvCell).join(','));
  }
  fs.writeFileSync(CSV_PATH, `﻿${rows.join('\r\n')}\r\n`, 'utf8');

  const covered = (category, subcategory) => candidates.filter((p) => p.category === category && p.subcategory === subcategory).length;
  const coverage = CALCULATOR_PAIRS.map(([category, subcategory]) => ({ category, subcategory, count: covered(category, subcategory) }));

  const { rows: formulas } = await db.query(
    'SELECT color_code, color_name_he, hex, ml_per_liter_light AS l, ml_per_liter_medium AS m, ml_per_liter_dark AS d FROM pigment_formulas ORDER BY sort_order'
  );
  const defaults = migrationDefaults();

  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מועמדים להדגמה</title>
<style>body{font-family:Arial,sans-serif;margin:16px}table{border-collapse:collapse;margin-bottom:24px}td,th{border:1px solid #ccc;padding:4px 8px;vertical-align:middle}
img{width:72px;height:72px;object-fit:contain}.warn{color:#b00020}.miss{background:#fde8e8}.tuned{background:#fff6d6}</style></head><body>
<h1>מועמדים לקטלוג ההדגמה (${candidates.length})</h1>
<p>סמנו כ-36 מוצרים בעמודה select בקובץ ה-CSV (x). הקובץ הזה הוא רק לצפייה.</p>
<h2>כיסוי המחשבונים</h2><table><tr><th>קטגוריה</th><th>תת-קטגוריה</th><th>מועמדים</th></tr>
${coverage.map((c) => `<tr class="${c.count === 0 ? 'miss' : ''}"><td>${escapeHtml(c.category)}</td><td>${escapeHtml(c.subcategory)}</td><td>${c.count}</td></tr>`).join('')}</table>
<h2>גווני הפיגמנט במסד הפיתוח מול ברירות המחדל של המיגרציה</h2><table><tr><th>גוון</th><th>במסד (בהיר/בינוני/כהה)</th><th>מיגרציה</th></tr>
${formulas.map((f) => {
    const base = defaults[f.color_code] || [];
    const tuned = base.join() !== [f.l, f.m, f.d].join();
    return `<tr class="${tuned ? 'tuned' : ''}"><td><span style="display:inline-block;width:14px;height:14px;background:${escapeHtml(f.hex)}"></span> ${escapeHtml(f.color_name_he)}</td><td>${f.l} / ${f.m} / ${f.d}</td><td>${base.join(' / ')}${tuned ? ' ← שונה ידנית' : ''}</td></tr>`;
  }).join('')}</table>
<h2>מוצרים</h2><table><tr><th>תמונה</th><th>id</th><th>שם</th><th>קטגוריה</th><th>מחיר</th><th>מוצע</th><th>אזהרות</th></tr>
${candidates.map((p) => `<tr><td>${p.hasImage ? `<img src="..${escapeHtml(p.image_url)}" alt="">` : ''}</td><td>${p.id}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)} / ${escapeHtml(p.subcategory)}</td><td>${p.price}</td><td>${suggestedPrice(p.price)}</td><td class="warn">${escapeHtml(p.warnings.join(' '))}</td></tr>`).join('')}</table></body></html>`;
  fs.writeFileSync(HTML_PATH, html, 'utf8');

  console.log(`✓ ${candidates.length} מועמדים: ${path.relative(process.cwd(), CSV_PATH)} ו-${path.relative(process.cwd(), HTML_PATH)}`);
  const missing = coverage.filter((c) => c.count === 0);
  console.log(missing.length === 0 ? '✓ כל צירופי המחשבונים מכוסים' : `⚠ צירופים בלי מועמד: ${missing.map((c) => `${c.category}/${c.subcategory}`).join(', ')}`);
}

main()
  .catch((err) => { console.error('✗ הרשימה לא נוצרה:', err.message); process.exitCode = 1; })
  .finally(() => db.close());
