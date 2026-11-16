/**
 * Builds the demo catalogue from the sheet the owner approved (plan 006, Phase 5). Owner-run, and
 * READ-ONLY against the development database: it selects the approved products and copies only the
 * chosen image files into the tracked folder demo-assets/uploads/. It writes no database.
 *
 *   npm run demo:catalogue
 *   npm run demo:catalogue -- --real-pigments cream,red   (publish the real dosages of these shades;
 *                                                          every other shade keeps its demonstration values)
 *
 * Reads design-assets/demo-candidates.csv (the `select` column marks the approved rows). Writes:
 *   scripts/demo-data/catalogue.json        — the approved catalogue
 *   scripts/demo-data/pigment-formulas.json — demonstration dosages, or the real ones for --real-pigments
 *   demo-assets/uploads/<hash>.webp         — only the files the approved products use
 *
 * It refuses (and writes nothing) when a row still carries a phone, URL, email, WhatsApp mention, or
 * supplier/address hint, or has no price: fix the row with demo_name / demo_description in the sheet.
 * The repository is public and history cannot be erased, so run it only after the owner has looked at
 * every image and text in the sheet.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');
const productRepository = require('../server/api/product/product.repository');
const { parseCandidateCsv, buildCatalogue, uncoveredPairs } = require('./lib/demoCatalogue');
const { UPLOADS_DIR } = require('./lib/uploads');
const { parseArgs } = require('./lib/demoTarget');

const ROOT = path.join(__dirname, '..');
const SHEET = path.join(ROOT, 'design-assets', 'demo-candidates.csv');
// The committed, reviewable selection (ids and owner-approved overrides). It wins over the sheet, so the
// catalogue can be rebuilt from the repository alone.
const SELECTION = path.join(__dirname, 'demo-data', 'catalogue-selection.json');
const DATA_DIR = path.join(ROOT, 'scripts', 'demo-data');
const ASSETS_DIR = path.join(ROOT, 'demo-assets', 'uploads');
const MAX_BYTES = 8 * 1024 * 1024;

/** Turns catalogue-selection.json ({ ids, overrides: { id: { demo_* } } }) into approved sheet rows. */
function rowsFromSelection({ ids, overrides = {} }) {
  return ids.map((id) => ({ select: 'x', id: String(id), ...(overrides[id] || {}) }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { values: ['real-pigments'] });
  if (!fs.existsSync(SELECTION) && !fs.existsSync(SHEET)) throw new Error('אין design-assets/demo-candidates.csv. הריצו קודם npm run demo:candidates וסמנו מוצרים.');

  const rows = fs.existsSync(SELECTION)
    ? rowsFromSelection(JSON.parse(fs.readFileSync(SELECTION, 'utf8')))
    : parseCandidateCsv(fs.readFileSync(SHEET, 'utf8'));
  const products = await productRepository.list({});
  // Each image is published under the sha256 of its content (first 16 hex characters), so the internal
  // product id in the original name is not published. The originals are only read, never changed.
  const copies = new Map(); // public name -> source path
  const missingFiles = [];
  const publicName = (file) => {
    const source = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(source)) { missingFiles.push(file); return null; }
    const name = `${crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 16)}.webp`;
    copies.set(name, source);
    return name;
  };
  const { catalogue, images, problems } = buildCatalogue(rows, new Map(products.map((p) => [p.id, p])), { publicName });
  if (catalogue.length === 0) problems.push('לא סומן אף מוצר בעמודה select.');
  if (problems.length > 0) throw new Error(`הבנייה נעצרה, לא נכתב דבר:\n  - ${problems.join('\n  - ')}`);

  const total = [...copies.keys()].reduce((sum, name) => sum + fs.statSync(copies.get(name)).size, 0);
  if (total > MAX_BYTES) throw new Error(`התמונות שנבחרו כבדות מ-8MB (${Math.round(total / 1024)}KB).`);

  const pigments = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pigment-formulas.json'), 'utf8'));
  const real = new Set(String(args['real-pigments'] || '').split(',').map((code) => code.trim()).filter(Boolean));
  if (real.size > 0) {
    const { rows: dev } = await db.query('SELECT color_code, ml_per_liter_light, ml_per_liter_medium, ml_per_liter_dark FROM pigment_formulas');
    for (const shade of pigments) {
      const found = dev.find((row) => row.color_code === shade.color_code);
      if (real.has(shade.color_code) && found) {
        shade.ml_per_liter_light = found.ml_per_liter_light;
        shade.ml_per_liter_medium = found.ml_per_liter_medium;
        shade.ml_per_liter_dark = found.ml_per_liter_dark;
      }
    }
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  for (const [name, source] of copies) fs.copyFileSync(source, path.join(ASSETS_DIR, name));
  fs.writeFileSync(path.join(DATA_DIR, 'catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'pigment-formulas.json'), `${JSON.stringify(pigments, null, 2)}\n`, 'utf8');

  console.log(`✓ ${catalogue.length} מוצרים, ${images.length} תמונות (${Math.round(total / 1024)}KB), ${real.size} גווני פיגמנט אמיתיים.`);
  if (missingFiles.length > 0) console.log(`⚠ ${missingFiles.length} הפניות לתמונות שהקובץ שלהן חסר (המוצר מציג אייקון קטגוריה): ${missingFiles.join(', ')}`);
  const missing = uncoveredPairs(catalogue);
  if (missing.length > 0) console.log(`⚠ צירופי מחשבון בלי מוצר (יוצג "שאל בחנות"): ${missing.map(([c, s]) => `${c}/${s}`).join(', ')}`);
  console.log('בדקו את הקבצים לפני שמבצעים commit: המאגר ציבורי וההיסטוריה אינה נמחקת.');
}

main()
  .catch((err) => { console.error('✗', err.message); process.exitCode = 1; })
  .finally(() => db.close());
