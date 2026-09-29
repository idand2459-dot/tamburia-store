/**
 * מסתיר מהחנות את המוצרים שלא צולמו ביום הצילומים.
 *
 *   npm run products:hide-unphotographed                     — רק מראה מה ייסגר
 *   npm run products:hide-unphotographed -- --keep 416,627    — חוץ מאלה
 *   npm run products:hide-unphotographed -- --keep-file keep.txt
 *   npm run products:hide-unphotographed -- --apply
 *   npm run products:hide-unphotographed -- --revert <קובץ גיבוי>
 *
 * הרעיון: ביום הצילומים מצלמים כל מוצר שנמצא על המדף, ולכן מה שאין
 * לו תמונה מעובדת ב-photos/processed הוא מה שאין בחנות. הסקריפט
 * הופך את זה לרשימה, ובאישור מפורש גם מסתיר אותה.
 *
 * ברירת המחדל היא ריצה יבשה — היא לא נוגעת במסד. היא מדפיסה את
 * הרשימה לפי קטגוריות וכותבת אותה ל-design-assets/to-hide-<חותמת>.csv,
 * כדי שאפשר יהיה לעבור עליה לפני שמחליטים.
 *
 * הסתרה אינה מחיקה: active יורד ל-false, המוצר נשאר במסד עם ההזמנות
 * והביקורות שמפנות אליו, ו---revert מחזיר בדיוק את אותם מזהים.
 */
const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');
const productModel = require('../server/models/product.model');
const { fileExists } = require('./lib/uploads');
const { load: loadCategories } = require('./lib/categories');

const ROOT = path.join(__dirname, '..');
const PROCESSED_DIR = path.join(ROOT, 'photos', 'processed');
const OUT_DIR = path.join(ROOT, 'design-assets');

/**
 * המוצרים שמחשבון הצבע מוסיף לעגלה, לפי מזהה.
 *
 * תמונת מראה של BUNDLE_PRODUCT_IDS ב-
 * client/src/js/features/calculator/PaintCalculator.js. המחשבון שולף
 * אותם לפי id, ומוצר מוסתר יחזיר לו 404 — הוא יציג "שווה לשאול
 * בחנות" במקום להיתקע, אבל החבילה שהוא ממליץ עליה תתרוקן.
 *
 * הרשימה הזו קטנה וכתובה בשני מקומות בכוונה: אין לה ייצוג במסד,
 * והדרך היחידה לגזור אותה מהקליינט הייתה לפרסר קובץ JS. מה שכן יש
 * כאן הוא אזהרה מפורשת בכל ריצה, כדי שהפער לא יתגלה בשקט.
 */
const CALCULATOR_IDS = [627, 628, 416];

// ───────────────────────────── ארגומנטים ─────────────────────────────

/** קורא את דגלי שורת הפקודה, ונופל על ארגומנט שלא מוכר. */
function parseArgs(argv) {
  const opts = { apply: false, keep: new Set(), revert: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--keep') {
      addIds(opts.keep, argv[i + 1], '--keep');
      i += 1;
    } else if (arg === '--keep-file') {
      const file = argv[i + 1];
      if (!file) throw new Error('חסר שם קובץ אחרי --keep-file');
      addIds(opts.keep, readKeepFile(file), '--keep-file');
      i += 1;
    } else if (arg === '--revert') {
      opts.revert = argv[i + 1];
      if (!opts.revert) throw new Error('חסר שם קובץ אחרי --revert');
      i += 1;
    } else {
      throw new Error(
        `ארגומנט לא מוכר: ${arg}\n` +
        'מותרים: --apply, --keep <מזהים>, --keep-file <קובץ>, --revert <קובץ>'
      );
    }
  }

  if (opts.revert && (opts.apply || opts.keep.size > 0)) {
    throw new Error('--revert רץ לבדו. הוא רק מחזיר לחנות את מה שהוסתר.');
  }

  return opts;
}

/** מוסיף מזהים מרשימה מופרדת בפסיקים או ברווחים, ונופל על ערך פסול. */
function addIds(target, raw, source) {
  if (!raw) throw new Error(`חסרים מזהים אחרי ${source}`);

  for (const part of String(raw).split(/[\s,]+/).filter(Boolean)) {
    const id = Number(part);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`${source} מכיל מזהה לא תקין: "${part}"`);
    }
    target.add(id);
  }
}

/**
 * קורא קובץ מזהים לשמירה.
 *
 * מזהה בשורה, או כמה מופרדים בפסיק — מה שיוצא מהדבקה של עמודה
 * מאקסל עובד כמו שהוא. שורה שמתחילה ב-# היא הערה, כדי שאפשר יהיה
 * לכתוב לצד המזהה למה החלטנו להשאיר אותו.
 */
function readKeepFile(file) {
  const full = path.isAbsolute(file) ? file : path.resolve(ROOT, file);

  let text;
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch (err) {
    throw new Error(`לא הצלחתי לקרוא את ${file}: ${err.message}`);
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter(Boolean)
    .join(',');
}

// ────────────────────────────── עזרים ──────────────────────────────

/** מנקה ערך לתא CSV: ציטוט כשצריך, והכפלת מרכאות שבתוכו. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** נתיב יחסי לשורש הפרויקט, עם לוכסנים רגילים. */
function rel(target) {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

/** חותמת זמן לשמות קבצים: 2026-09-29T01-23-45. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ──────────────────────── מי צולם ביום הצילומים ────────────────────────

/**
 * מזהי המוצרים שיש להם תמונה מעובדת מהצילום.
 *
 * נקרא מתוכן התיקייה ולא מהמניפסט: המניפסט מתאר את הריצה האחרונה של
 * הצינור, והתיקייה מתארת את מה שיש. מי שעיבד באצוות, או שמחק ידנית
 * תמונה שלא יצאה טוב, מקבל כאן את התשובה הנכונה.
 *
 * <id>.webp בלבד — הזווית הראשית. 247-2.webp הוא זווית נוספת לאותו
 * מוצר, ובלי הראשית הוא לא נחשב צילום.
 */
function photographedIds() {
  if (!fs.existsSync(PROCESSED_DIR)) return new Set();

  return new Set(
    fs.readdirSync(PROCESSED_DIR)
      .map((file) => file.match(/^(\d+)\.webp$/i))
      .filter(Boolean)
      .map((match) => Number(match[1]))
  );
}

// ───────────────────────────── הרשימה ─────────────────────────────

/**
 * מחזיר את המוצרים הפעילים שלא צולמו, ממוינים לפי סדר הקטגוריות
 * בחנות ובתוכן לפי מזהה.
 */
function toHide(products, photographed, keep, taxonomy) {
  const { order, categoryNames } = taxonomy;
  const rank = (category) => (category in order ? order[category] : Number.MAX_SAFE_INTEGER);

  return products
    .filter((product) => product.active !== false)
    .filter((product) => !photographed.has(product.id))
    .filter((product) => !keep.has(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name || '',
      category: product.category || '',
      categoryName: categoryNames[product.category] || product.category || 'ללא קטגוריה',
      price: product.price,
      hadRealImage: fileExists(product.image_url),
    }))
    .sort((a, b) =>
      rank(a.category) - rank(b.category) ||
      a.categoryName.localeCompare(b.categoryName, 'he') ||
      a.id - b.id
    );
}

/** כותב את הרשימה ל-CSV, עם BOM כדי שאקסל יפתח את העברית נכון. */
function writeCsv(rows) {
  const header = ['id', 'name', 'category', 'price', 'had_real_image'];

  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.id, row.name, row.categoryName, row.price, row.hadRealImage,
    ].map(csvCell).join(','));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `to-hide-${stamp()}.csv`);
  fs.writeFileSync(outPath, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  return outPath;
}

/** מדפיס את הרשימה מקובצת לפי קטגוריה. */
function printGrouped(rows) {
  let current = null;

  for (const row of rows) {
    if (row.categoryName !== current) {
      current = row.categoryName;
      const count = rows.filter((r) => r.categoryName === current).length;
      console.log(`\n  ${current}  (${count})`);
    }
    const price = row.price > 0 ? `₪${row.price}` : 'ללא מחיר';
    const image = row.hadRealImage ? '  · יש לו תמונה ישנה' : '';
    console.log(`    ${String(row.id).padStart(4)}  ${row.name}  —  ${price}${image}`);
  }
}

// ────────────────────────── הסתרה וביטולה ──────────────────────────

/** מסתיר את כל המוצרים שברשימה, אחרי שמירת גיבוי של המזהים. */
async function apply(rows) {
  const backupPath = path.join(OUT_DIR, `hide-backup-${stamp()}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      rows: rows.map(({ id, name }) => ({ id, name })),
    }, null, 2),
    'utf8'
  );
  console.log(`\nגיבוי של ${rows.length} מזהים:  ${rel(backupPath)}`);

  let hidden = 0;
  for (const row of rows) {
    const updated = await productModel.update(row.id, { active: false });
    if (updated) hidden += 1;
    else console.log(`  ✗  ${row.id}  — המוצר כבר לא קיים`);
  }

  return { hidden, backupPath };
}

/** מחזיר לחנות בדיוק את המזהים שבקובץ הגיבוי. */
async function revert(file) {
  const full = path.isAbsolute(file) ? file : path.resolve(ROOT, file);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    throw new Error(`לא הצלחתי לקרוא את קובץ הגיבוי ${file}: ${err.message}`);
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows : null;
  if (!rows) throw new Error(`${file} אינו קובץ גיבוי תקין (חסר שדה rows).`);

  console.log(`מחזיר לחנות ${rows.length} מוצרים מתוך ${rel(full)}:\n`);

  let restored = 0;
  let missing = 0;

  for (const row of rows) {
    const updated = await productModel.update(row.id, { active: true });
    if (updated) {
      restored += 1;
      console.log(`  ↩  ${row.id}  ${row.name || ''}`);
    } else {
      missing += 1;
      console.log(`  ✗  ${row.id}  — המוצר כבר לא קיים`);
    }
  }

  console.log(`\nחזרו לחנות ${restored} מוצרים${missing > 0 ? `, ${missing} לא נמצאו` : ''}.`);
}

// ─────────────────────────────── ראשי ───────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.revert) {
    await revert(opts.revert);
    return;
  }

  const taxonomy = loadCategories();
  const products = await productModel.list();
  const photographed = photographedIds();

  const active = products.filter((p) => p.active !== false);
  const rows = toHide(products, photographed, opts.keep, taxonomy);

  console.log(`צולמו ביום הצילומים:  ${photographed.size} מוצרים  (${rel(PROCESSED_DIR)})`);
  console.log(`מוצגים בחנות עכשיו:   ${active.length}`);
  if (opts.keep.size > 0) {
    console.log(`נשמרים לבקשתך:        ${opts.keep.size}  (${[...opts.keep].sort((a, b) => a - b).join(', ')})`);
  }

  if (photographed.size === 0) {
    console.log(
      '\nאין אף תמונה מעובדת. אם עוד לא הרצת את npm run images:products,\n' +
      'הרשימה למטה היא כל החנות — וזו כנראה לא הכוונה.'
    );
  }

  if (rows.length === 0) {
    console.log('\nאין מה להסתיר: לכל מוצר פעיל יש תמונה מהצילום.');
    return;
  }

  console.log(`\n${rows.length} מוצרים פעילים בלי תמונה מהצילום:`);
  printGrouped(rows);

  // אזהרה נפרדת, אחרי הרשימה ולא בתוכה: אלה מוצרים שההסתרה שלהם
  // שוברת פיצ'ר ולא רק מורידה שורה מהקטלוג.
  const calculatorHits = rows.filter((row) => CALCULATOR_IDS.includes(row.id));
  if (calculatorHits.length > 0) {
    console.log('\n⚠  מחשבון הצבע מוסיף לעגלה את המוצרים האלה לפי מזהה:');
    calculatorHits.forEach((row) => console.log(`    ${row.id}  ${row.name}`));
    console.log('    הסתרה שלהם תוציא אותם מהחבילה שהמחשבון ממליץ עליה');
    console.log('    (המחשבון יציג "שווה לשאול בחנות" ולא ייפול).');
    console.log(`    לשמור אותם:  --keep ${calculatorHits.map((r) => r.id).join(',')}`);
  }

  const csvPath = writeCsv(rows);
  console.log(`\n  ✓  ${rel(csvPath)}`);

  const staying = active.length - rows.length;
  console.log(`\nיישארו בחנות: ${staying}   ייסגרו: ${rows.length}`);

  if (!opts.apply) {
    console.log('\nזו ריצה יבשה — לא נגענו במסד.');
    console.log('להסתרה בפועל:  npm run products:hide-unphotographed -- --apply');
    return;
  }

  const { hidden, backupPath } = await apply(rows);

  console.log(`\n─────────────────────────────`);
  console.log(`הוסתרו: ${hidden}`);
  console.log(`בחנות:  ${staying}`);
  console.log(`\nלביטול:  npm run products:hide-unphotographed -- --revert ${rel(backupPath)}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
