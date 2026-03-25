/**
 * import_products.js
 *
 * Reads products_import_template.csv and inserts/updates products in the DB.
 *
 * Usage:
 *   node import_products.js                         (uses products_import_template.csv)
 *   node import_products.js my_other_file.csv       (uses a different CSV file)
 *
 * Merge rules (checked in order):
 *   1. Same SKU in DB               → UPDATE + merge colors
 *   2. Same Name in DB              → merge colors only (no other fields overwritten)
 *   3. Name not found but description ≥90% similar to an existing product → merge colors only
 *   4. Truly new product            → INSERT
 *   - Colors: separate multiple colors with a pipe "|" in the CSV (e.g. "לבן|שחור|אדום")
 *   - Images: put all image files in the /uploads/ folder, then just write the filename in the CSV
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Auto-generate Hebrew description when catalog provides none ───────────────
function generateDescription(name, category) {
  const byCategory = {
    plumbing:   `חיבור/אביזר אינסטלציה איכותי — ${name}. מתאים למערכות מים, עמיד ואטום לשימוש ארוך טווח.`,
    adhesives:  `${name} — מוצר איטום ודבק מקצועי. מתאים לשימוש פנים וחוץ, עמיד ללחות ולטמפרטורות קיצוניות.`,
    painting:   `${name} — כלי צביעה מקצועי. מתאים לכל סוגי הצבעים, מבטיח כיסוי אחיד ועבודה נוחה.`,
    tools:      `${name} — כלי עבודה מקצועי. בנוי לשימוש אינטנסיבי, ידית ארגונומית וחומרי גלם איכותיים.`,
    cleaning:   `${name} — מוצר ניקיון יעיל ואמין. מסיר לכלוך ביעילות תוך שמירה על המשטח.`,
    kitchen:    `${name} — מוצר איכותי לשימוש במטבח. עיצוב פונקציונלי ועמיד לשימוש יומיומי.`,
    bathroom:   `${name} — מוצר איכותי לאמבטיה. עמיד ללחות, קל להתקנה ולניקוי.`,
    garden:     `${name} — ציוד גינון איכותי. עמיד לתנאי שטח ומיועד לשימוש ממושך.`,
    locks:      `${name} — מנעול/אביזר אבטחה איכותי. מספק הגנה אמינה ועמידות גבוהה.`,
    faucets:    `${name} — ברז איכותי מגוף נירוסטה/פליז. זרימה חלקה, עמיד לחלוד ולשימוש יומיומי.`,
    electrical: `${name} — מוצר חשמל בטיחותי ואמין. עומד בתקנים ומיועד לשימוש ביתי ומקצועי.`,
    home:       `${name} — מוצר בית איכותי לשימוש יומיומי. שילוב של עיצוב ופונקציונליות.`,
  };
  return byCategory[category] || `${name} — מוצר איכותי לשימוש מקצועי וביתי.`;
}

// ── String similarity (0–1) using Levenshtein distance ───────────────────────
// No external deps needed — works well for short Hebrew product names.
function similarity(a, b) {
  a = a.trim().toLowerCase();
  b = b.trim().toLowerCase();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

// ── Database connection (same as server.js) ──────────────────────────────────
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tamburia',
  password: '1234',
  port: 5432,
});

// ── Valid categories (from categories.js) ────────────────────────────────────
const VALID_CATEGORIES = new Set([
  'painting', 'kitchen', 'bathroom', 'tools', 'cleaning',
  'garden', 'plumbing', 'adhesives', 'locks', 'faucets', 'electrical', 'home',
]);

// ── Minimal CSV parser (handles quoted fields with embedded commas) ───────────
// A field is only "quoted" if the very first character is a double-quote.
// Mid-word quotes (e.g. Hebrew מ"מ for millimeters) are treated as literals.
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let fieldStart = true;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (fieldStart) {
        // Opening quote — this field is a quoted field
        inQuotes = true;
        fieldStart = false;
      } else if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote "" inside a quoted field → literal "
        current += '"';
        i++;
      } else if (inQuotes) {
        // Closing quote
        inQuotes = false;
      } else {
        // Mid-word quote in an unquoted field → treat as literal character
        current += ch;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      fieldStart = true;
    } else {
      current += ch;
      fieldStart = false;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim() || line.startsWith('#')) return; // skip blank lines & comments

      if (!headers) {
        headers = parseCSVLine(line).map(h => h.replace(/^\uFEFF/, '')); // strip BOM
        return;
      }

      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      rows.push(row);
    });

    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

// ── Build the /uploads/ URL for an image filename ────────────────────────────
function imageUrl(filename) {
  if (!filename || !filename.trim()) return null;
  return '/uploads/' + filename.trim();
}

// ── Main import logic ─────────────────────────────────────────────────────────
async function importProducts(csvFile) {
  console.log(`\n📂 Reading: ${csvFile}`);
  const rows = await parseCSV(csvFile);
  console.log(`📋 Found ${rows.length} product rows\n`);

  // Load all existing products once for name/description matching
  const { rows: existingProducts } = await pool.query('SELECT id, sku, name, description, colors, sizes FROM products');

  let inserted = 0;
  let merged   = 0;
  let updated  = 0;
  let skipped  = 0;

  for (const row of rows) {
    const sku         = row['SKU']?.trim()             || null;
    const name        = row['Name']?.trim()            || '';
    const price       = Math.round(parseFloat(row['Price'])) || 0;
    const category    = row['Category']?.trim()        || '';
    const subcategory = row['Subcategory']?.trim()     || null;
    const descRaw     = row['Description']?.trim()     || '';
    const description = descRaw || generateDescription(name, category);
    const colorsRaw   = row['Colors']?.trim()          || '';
    const sizesRaw    = row['Sizes']?.trim()           || '';
    const inStock     = (row['In_Stock']?.trim().toLowerCase() !== 'false');

    // Build images array from the 5 image columns
    const imageFilenames = [
      row['Image_filename'],
      row['Image2_filename'],
      row['Image3_filename'],
      row['Image4_filename'],
      row['Image5_filename'],
    ].map(f => f?.trim()).filter(Boolean);

    const primaryImage = imageFilenames.length > 0 ? imageUrl(imageFilenames[0]) : '';
    const allImages    = imageFilenames.map(imageUrl);

    // Colors / Sizes: pipe-separated in CSV → JS array (pg driver maps to TEXT[])
    const colors = colorsRaw ? colorsRaw.split('|').map(c => c.trim()).filter(Boolean) : [];
    const sizes  = sizesRaw  ? sizesRaw.split('|').map(s => s.trim()).filter(Boolean)  : [];

    // ── Validation ────────────────────────────────────────────────────────────
    if (!name) {
      console.warn(`  ⚠️  SKIP — row has no Name (SKU: ${sku || 'none'})`);
      skipped++;
      continue;
    }
    if (!VALID_CATEGORIES.has(category)) {
      console.warn(`  ⚠️  SKIP "${name}" — invalid category: "${category}"`);
      console.warn(`        Valid: ${[...VALID_CATEGORIES].join(', ')}`);
      skipped++;
      continue;
    }
    if (price < 0) {
      console.warn(`  ⚠️  SKIP "${name}" — price cannot be negative`);
      skipped++;
      continue;
    }

    try {
      // ── Find match (SKU → exact name → fuzzy description) ──────────────────
      let match      = null;   // { id, colors, matchType }

      // 1. SKU match
      if (sku) {
        const found = existingProducts.find(p => p.sku === sku);
        if (found) match = { ...found, matchType: 'sku' };
      }

      // 2. Exact name match (case-insensitive)
      if (!match) {
        const found = existingProducts.find(p =>
          p.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (found) match = { ...found, matchType: 'name' };
      }

      // Rule 3 (description similarity) is intentionally disabled:
      // Catalog products in the same line share descriptions AND similar names,
      // causing false merges. Pre-merging is done in the CSV before import.

      // in_stock is always respected from the CSV — price=0 does NOT hide the product
      const effectiveInStock = inStock;
      const priceNote = (price === 0) ? ' ⚠️  price=0 (fill in price later)' : '';

      if (match) {
        // ── MERGE colors + sizes — never overwrite name/price/description ─────
        const existingColors = match.colors || [];
        const existingSizes  = match.sizes  || [];
        const mergedColors   = [...new Set([...existingColors, ...colors])];
        const mergedSizes    = [...new Set([...existingSizes,  ...sizes])];
        const addedColors    = colors.filter(c => !existingColors.includes(c));
        const addedSizes     = sizes.filter(s => !existingSizes.includes(s));

        if (addedColors.length === 0 && addedSizes.length === 0 && match.matchType !== 'sku') {
          // Nothing new to add — skip silently
          console.log(`  ⏭️  SKIP     [${sku || '—'}] "${name}" — already exists, no new colors/sizes`);
          skipped++;
        } else {
          if (match.matchType === 'sku') {
            // Full update (price, description, images may have changed)
            await pool.query(
              `UPDATE products
               SET name=$1, price=$2, category=$3, subcategory=$4, description=$5, colors=$6, sizes=$7,
                   in_stock=$8, image_url=$9, images=$10
               WHERE id=$11`,
              [name, price, category, subcategory, description, mergedColors, mergedSizes,
               effectiveInStock, primaryImage, JSON.stringify(allImages), match.id]
            );
            const colorNote = addedColors.length > 0 ? `  +🎨 ${addedColors.join(', ')}` : '';
            const sizeNote  = addedSizes.length  > 0 ? `  +📏 ${addedSizes.join(', ')}`  : '';
            console.log(`  ✏️  UPDATED  [${sku}] ${name}${colorNote}${sizeNote}${priceNote}`);
            updated++;
          } else {
            // Color+size merge — preserve everything else
            await pool.query(
              'UPDATE products SET colors=$1, sizes=$2 WHERE id=$3',
              [mergedColors, mergedSizes, match.id]
            );
            const reason = match.matchType === 'name' ? 'same name' : 'similar description';
            const colorNote = addedColors.length > 0 ? `  +🎨 ${addedColors.join(', ')}` : '';
            const sizeNote  = addedSizes.length  > 0 ? `  +📏 ${addedSizes.join(', ')}`  : '';
            console.log(`  🔀  MERGED   [${sku || '—'}→${match.sku || match.id}] "${name}" (${reason})${colorNote}${sizeNote}`);
            merged++;
          }
          // Keep existingProducts in sync so later rows in the same CSV benefit
          match.colors = mergedColors;
          match.sizes  = mergedSizes;
        }
      } else {
        // ── INSERT new product ────────────────────────────────────────────────
        const result = await pool.query(
          `INSERT INTO products (name, price, stock, image_url, images, colors, sizes, category, subcategory, sku, description, in_stock)
           VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, sku, name, description, colors, sizes`,
          [name, price, primaryImage, JSON.stringify(allImages),
           colors, sizes, category, subcategory, sku, description, effectiveInStock]
        );
        existingProducts.push(result.rows[0]); // register for subsequent rows
        const sizeNote = sizes.length > 0 ? `  📏 ${sizes.join(', ')}` : '';
        console.log(`  ✅  INSERTED [${sku || 'no-sku'}] ${name}${sizeNote}${priceNote}`);
        inserted++;
      }
    } catch (err) {
      console.error(`  ❌  ERROR on "${name}": ${err.message}`);
      skipped++;
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅  Inserted : ${inserted}  (new products)`);
  console.log(`✏️   Updated  : ${updated}  (same SKU — full update)`);
  console.log(`🎨  Merged   : ${merged}  (color added to existing product)`);
  console.log(`⏭️   Skipped  : ${skipped}  (duplicate or error)`);
  console.log(`📦  Total    : ${rows.length}`);
  console.log('─────────────────────────────────────\n');

  // ── Missing Images Report ───────────────────────────────────────────────────
  const uploadsDir = path.join(__dirname, 'uploads');
  const { rows: allProducts } = await pool.query('SELECT sku, name, image_url FROM products ORDER BY id');
  const missing = [];

  for (const p of allProducts) {
    if (!p.image_url) {
      missing.push({ sku: p.sku || '—', name: p.name, expected: `${p.sku || 'no-sku'}.jpg`, exists: false });
      continue;
    }
    const filename = path.basename(p.image_url);
    const filepath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filepath)) {
      missing.push({ sku: p.sku || '—', name: p.name, expected: filename, exists: false });
    }
  }

  if (missing.length === 0) {
    console.log('🖼️  All product images found in /uploads ✓\n');
  } else {
    console.log(`🖼️  Missing Images Report — ${missing.length} product(s) need images:\n`);
    console.log('  Drop files into:  tamburia-store/uploads/\n');
    console.log(`  ${'SKU'.padEnd(16)} ${'Expected filename'.padEnd(36)} Product name`);
    console.log(`  ${'─'.repeat(80)}`);
    for (const m of missing) {
      console.log(`  ${String(m.sku).padEnd(16)} ${m.expected.padEnd(36)} ${m.name}`);
    }
    console.log('');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
const csvArg = process.argv[2] || 'products_import_template.csv';
const csvPath = path.resolve(__dirname, csvArg);

if (!fs.existsSync(csvPath)) {
  console.error(`❌ File not found: ${csvPath}`);
  process.exit(1);
}

importProducts(csvPath)
  .then(() => pool.end())
  .catch(err => { console.error('Fatal:', err); pool.end(); process.exit(1); });
