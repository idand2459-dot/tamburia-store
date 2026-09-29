/**
 * מייבא לחנות את המוצרים החדשים שמולאו בגיליון האקסל.
 *
 *   npm run products:import-new                    — רק בודק ומדווח
 *   npm run products:import-new -- --apply         — יוצר בפועל
 *   npm run products:import-new -- --revert <קובץ גיבוי>
 *
 * מקור: design-assets/new-products.xlsx (נוצר ב-products:new-template)
 *
 * ברירת המחדל היא ריצה יבשה: היא קוראת את כל השורות, מאמתת כל אחת,
 * ומדפיסה שורה-שורה מה נמצא ומה פסול בה. היא אינה נוגעת במסד ואינה
 * מעתיקה קבצים. שורה עם שגיאה נפסלת ואינה מיובאת — היא לעולם לא
 * מנוחשת, כי ניחוש של קטגוריה או מחיר הוא בדיוק מה שאי אפשר לגלות
 * אחר כך בלי לעבור על 500 מוצרים ביד.
 *
 * הוולידציה כאן היא שתי שכבות. הראשונה היא כללי הגיליון: קובץ תמונה
 * שקיים, קטגוריה מהעץ, תת-קטגוריה ששייכת לה, ומחיר או גדלים. השנייה
 * היא server/validators/product.validator.js — בדיוק אותו קוד שטופס
 * האדמין עובר דרכו. הוא נקרא ישירות ולא משוכפל, ולכן אם השתיים
 * חלוקות, שלו קובע.
 *
 * הצורה של הצירוף: קודם נוצר המוצר בלי תמונה, ואז התמונה מועתקת
 * ל-uploads בשם שנגזר מה-id שהתקבל ומתוכן הקובץ, ורק אז היא מחוברת.
 * זה אותו שם בדיוק ש-images-products כותב (scripts/lib/uploads.js),
 * כך שיש קונבנציה אחת לכל תמונות המוצרים.
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../server/config/db');
const productModel = require('../server/models/product.model');
const orderModel = require('../server/models/order.model');
const { parseCreate } = require('../server/validators/product.validator');
const { UPLOADS_DIR, pathToUrl, uploadName } = require('./lib/uploads');
const { load: loadCategories } = require('./lib/categories');
const { parseColors } = require('./lib/palette');

const ROOT = path.join(__dirname, '..');
const NEW_DIR = path.join(ROOT, 'photos', 'processed', 'new');
const BOOK_PATH = path.join(ROOT, 'design-assets', 'new-products.xlsx');
const BACKUP_DIR = path.join(ROOT, 'design-assets');

const SHEET = 'מוצרים חדשים';

// ───────────────────────────── ארגומנטים ─────────────────────────────

/** קורא את דגלי שורת הפקודה, ונופל על ארגומנט שלא מוכר. */
function parseArgs(argv) {
  const opts = { apply: false, revert: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--revert') {
      opts.revert = argv[i + 1];
      if (!opts.revert) throw new Error('חסר שם קובץ אחרי --revert');
      i += 1;
    } else {
      throw new Error(`ארגומנט לא מוכר: ${arg}\nמותרים: --apply, --revert <קובץ>`);
    }
  }

  if (opts.revert && opts.apply) {
    throw new Error('--revert רץ לבדו. הוא רק מבטל ייבוא שכבר קרה.');
  }

  return opts;
}

// ────────────────────────────── עזרים ──────────────────────────────

/** נתיב יחסי לשורש הפרויקט, עם לוכסנים רגילים. */
function rel(target) {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

/** חותמת זמן לשמות קבצים. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * מחזיר את תוכן התא כטקסט נקי.
 *
 * exceljs מחזיר לתא צורות שונות לפי מה שיש בו: מספר, מחרוזת, אובייקט
 * של נוסחה, או טקסט עשיר כשחלק מהתא עוצב אחרת. המשתמש רואה בכולם
 * אותו דבר, ולכן כולם מצטמצמים כאן למחרוזת אחת.
 */
function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    return '';
  }
  return String(value).trim();
}

/** "כן"/"לא" → בוליאני. ריק מחזיר את ברירת המחדל של העמודה. */
function yesNo(text, fallback) {
  const value = text.trim();
  if (!value) return fallback;
  if (['כן', 'yes', 'true', '1'].includes(value.toLowerCase())) return true;
  if (['לא', 'no', 'false', '0'].includes(value.toLowerCase())) return false;
  return null;
}

// ──────────────────────────── פענוח שורה ────────────────────────────

/**
 * מפענח את עמודת הגדלים: "3 מטר:25; 5 מטר:35".
 *
 * מחזיר { variants, errors }. תא ריק אינו שגיאה — מוצר בלי גדלים הוא
 * המקרה הרגיל, ואז המחיר בעמודת המחיר הוא שקובע.
 */
function parseVariants(text) {
  const errors = [];
  const variants = [];
  const seen = new Set();

  for (const part of text.split(';').map((p) => p.trim()).filter(Boolean)) {
    const at = part.lastIndexOf(':');
    if (at === -1) {
      errors.push(`"${part}" אינו בצורה גודל:מחיר`);
      continue;
    }

    const label = part.slice(0, at).trim();
    const price = Number(part.slice(at + 1).trim());

    if (!label) {
      errors.push(`"${part}" — חסר שם הגודל`);
      continue;
    }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`הגודל "${label}" — המחיר חייב להיות מספר גדול מאפס`);
      continue;
    }
    if (seen.has(label)) {
      errors.push(`הגודל "${label}" מופיע יותר מפעם אחת`);
      continue;
    }

    seen.add(label);
    variants.push({ label, price });
  }

  return { variants, errors };
}

/**
 * מאמת שורה אחת ומחזיר { row, body, errors }.
 *
 * body הוא null כשיש שגיאות: אין טעם לבנות מוצר משורה שלא תיובא.
 */
function readRow(sheetRow, rowNumber, taxonomy) {
  const text = (index) => cellText(sheetRow.getCell(index));

  const raw = {
    image: text(1),
    name: text(2),
    category: text(3),
    subcategory: text(4),
    price: text(5),
    variants: text(6),
    colors: text(7),
    sku: text(8),
    description: text(9),
    illustrative: text(10),
    inStock: text(11),
  };

  // שורה שכולה ריקה מלבד שם הקובץ היא שורה שעוד לא מולאה, ולא שגיאה.
  const filled = Object.entries(raw).some(([key, value]) => key !== 'image' && value);
  if (!filled) return { rowNumber, raw, body: null, errors: [], empty: true };

  const errors = [];

  if (!raw.image) {
    errors.push('חסר שם קובץ התמונה');
  } else if (!fs.existsSync(path.join(NEW_DIR, raw.image))) {
    errors.push(`קובץ התמונה "${raw.image}" אינו נמצא ב-${rel(NEW_DIR)}`);
  }

  if (!raw.name) errors.push('חסר שם מוצר');

  const category = taxonomy.categories.find((c) => c.name === raw.category);
  if (!raw.category) {
    errors.push('חסרה קטגוריה');
  } else if (!category) {
    errors.push(`הקטגוריה "${raw.category}" אינה קיימת`);
  }

  let subcategoryId = null;
  if (raw.subcategory) {
    const sub = category?.subcategories.find((s) => s.name === raw.subcategory);
    if (!sub) {
      // ההבחנה חשובה: שם שלא קיים בכלל היא טעות הקלדה, ושם שקיים
      // בקטגוריה אחרת היא בחירה בשורה הלא נכונה.
      const elsewhere = taxonomy.categories.find(
        (c) => c.subcategories.some((s) => s.name === raw.subcategory)
      );
      errors.push(elsewhere
        ? `תת-הקטגוריה "${raw.subcategory}" שייכת ל"${elsewhere.name}" ולא ל"${raw.category}"`
        : `תת-הקטגוריה "${raw.subcategory}" אינה קיימת`);
    } else {
      subcategoryId = sub.id;
    }
  }

  const { variants, errors: variantErrors } = parseVariants(raw.variants);
  errors.push(...variantErrors);

  let price = 0;
  if (raw.price) {
    const parsed = Number(raw.price);
    if (!Number.isFinite(parsed) || parsed < 0) errors.push(`המחיר "${raw.price}" אינו מספר`);
    else price = Math.round(parsed);
  }

  // מוצר בלי מחיר ובלי גדלים הוא מוצר שאי אפשר להזמין. מוצר כזה קיים
  // במסד, ולא נוסיף עוד אחד ביודעין דרך הייבוא.
  if (price <= 0 && variants.length === 0) {
    errors.push('חסר מחיר — צריך מחיר גדול מאפס, או לפחות גודל אחד מתומחר');
  }

  const illustrative = yesNo(raw.illustrative, false);
  if (illustrative === null) errors.push(`"תמונה להמחשה" חייב להיות כן או לא (התקבל "${raw.illustrative}")`);

  const inStock = yesNo(raw.inStock, true);
  if (inStock === null) errors.push(`"במלאי" חייב להיות כן או לא (התקבל "${raw.inStock}")`);

  if (errors.length > 0) return { rowNumber, raw, body: null, errors };

  /* מכאן הלאה עובר לוולידטור של השרת — אותו קוד שטופס האדמין עובר
     בו. מה שהוא דוחה נדחה גם כאן, ולא משנה מה חשבנו למעלה. */
  const body = {
    name: raw.name,
    price,
    category: category.id,
    subcategory: subcategoryId,
    sku: raw.sku || null,
    description: raw.description || null,
    colors: parseColors(raw.colors),
    variants,
    in_stock: inStock,
    image_illustrative: illustrative,
    image_url: '',
    images: [],
  };

  try {
    return { rowNumber, raw, body: parseCreate(body), errors: [] };
  } catch (err) {
    return { rowNumber, raw, body: null, errors: [err.message] };
  }
}

// ───────────────────────────── הדוח ─────────────────────────────

/** מדפיס שורה אחת: מה נמצא בה, ומה פסול. */
function printRow(entry, taxonomy) {
  const label = `שורה ${entry.rowNumber}`;

  if (entry.empty) {
    console.log(`  ⏭  ${label}  ${entry.raw.image}  — לא מולאה, מדלג`);
    return;
  }

  if (entry.errors.length > 0) {
    console.log(`  ✗  ${label}  ${entry.raw.image || '(בלי תמונה)'}  ${entry.raw.name || ''}`);
    entry.errors.forEach((error) => console.log(`        ${error}`));
    return;
  }

  const body = entry.body;
  const categoryName = taxonomy.categoryNames[body.category] || body.category;
  const subName = body.subcategory ? taxonomy.subcategoryNames[body.subcategory] : '';

  const bits = [categoryName];
  if (subName) bits.push(subName);
  bits.push(body.variants.length > 0
    ? `${body.variants.length} גדלים, מ-₪${body.price}`
    : `₪${body.price}`);
  if (body.colors.length > 0) bits.push(`${body.colors.length} צבעים`);
  if (!body.in_stock) bits.push('אזל');
  if (body.image_illustrative) bits.push('תמונה להמחשה');

  console.log(`  ✓  ${label}  ${body.name}  —  ${bits.join(' · ')}`);
}

// ───────────────────────────── היצירה ─────────────────────────────

/**
 * יוצר את המוצרים התקינים, מחבר להם את התמונה, ושומר גיבוי.
 *
 * הקובץ נכתב לפני שנוצר המוצר הראשון ומתעדכן אחרי כל יצירה: ריצה
 * שנקטעת באמצע משאירה אחריה רשימה מדויקת של מה שכבר נוצר, ו---revert
 * יודע לנקות אותה.
 */
async function apply(entries) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const backupPath = path.join(BACKUP_DIR, `import-backup-${stamp()}.json`);
  const created = [];

  /** כותב את הגיבוי מחדש, אחרי כל שינוי ברשימה. */
  const saveBackup = () => fs.writeFileSync(
    backupPath,
    JSON.stringify({ createdAt: new Date().toISOString(), rows: created }, null, 2),
    'utf8'
  );

  saveBackup();
  console.log(`\nגיבוי:  ${rel(backupPath)}`);

  for (const entry of entries) {
    const product = await productModel.create(entry.body);

    // התמונה אחרי היצירה: שם הקובץ נגזר מה-id, והוא נודע רק עכשיו.
    const source = path.join(NEW_DIR, entry.raw.image);
    const contents = fs.readFileSync(source);
    const fileName = uploadName(product.id, 1, contents);
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), contents);

    const url = pathToUrl(fileName);
    await productModel.update(product.id, { image_url: url, images: [url] });

    created.push({ id: product.id, name: product.name, image: entry.raw.image, url });
    saveBackup();

    console.log(`  ✓  ${product.id}  ${product.name}  →  ${url}`);
  }

  return { created, backupPath };
}

/**
 * מבטל ייבוא: מוחק את המוצרים שנוצרו בו.
 *
 * מוצר שהספיק להיכנס להזמנה אינו נמחק אלא מוסתר. מחיקה שלו הייתה
 * מנתקת את ההזמנה מהפריט שנמכר בה — בדיוק מה שדגל active קיים כדי
 * למנוע — וזה לא מקרה תיאורטי: בין הייבוא לביטול האתר חי.
 */
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

  console.log(`מבטל ייבוא של ${rows.length} מוצרים מתוך ${rel(full)}:\n`);

  let removed = 0;
  let hidden = 0;
  let missing = 0;

  for (const row of rows) {
    const orders = await orderModel.countByProductId(row.id);

    if (orders > 0) {
      const updated = await productModel.update(row.id, { active: false });
      if (updated) {
        hidden += 1;
        console.log(
          `  ◐  ${row.id}  ${row.name}  — הוסתר ולא נמחק: הוא מופיע ב-${orders} הזמנות`
        );
      } else {
        missing += 1;
        console.log(`  ✗  ${row.id}  ${row.name}  — כבר לא קיים`);
      }
      continue;
    }

    const deleted = await productModel.remove(row.id);
    if (deleted) {
      removed += 1;
      console.log(`  ✗  ${row.id}  ${row.name}  — נמחק`);
    } else {
      missing += 1;
      console.log(`  ·  ${row.id}  ${row.name}  — כבר לא קיים`);
    }
  }

  console.log(`\nנמחקו ${removed}${hidden > 0 ? `, הוסתרו ${hidden}` : ''}${missing > 0 ? `, ${missing} לא נמצאו` : ''}.`);
  console.log('הקבצים ב-uploads לא נמחקו — הריצה הבאה של images:products תדווח עליהם כיתומים.');
}

// ─────────────────────────────── ראשי ───────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.revert) {
    await revert(opts.revert);
    return;
  }

  if (!fs.existsSync(BOOK_PATH)) {
    throw new Error(
      `לא נמצא ${rel(BOOK_PATH)}.\n` +
      '  ליצירת הגיליון:  npm run products:new-template'
    );
  }

  const taxonomy = loadCategories();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(BOOK_PATH);

  const sheet = workbook.getWorksheet(SHEET);
  if (!sheet) {
    throw new Error(`לא נמצא הגיליון "${SHEET}" בקובץ ${rel(BOOK_PATH)}.`);
  }

  const entries = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    entries.push(readRow(sheet.getRow(rowNumber), rowNumber, taxonomy));
  }

  console.log(`${rel(BOOK_PATH)} — ${entries.length} שורות:\n`);
  entries.forEach((entry) => printRow(entry, taxonomy));

  const ready = entries.filter((entry) => entry.body);
  const failed = entries.filter((entry) => !entry.empty && entry.errors.length > 0);
  const empty = entries.filter((entry) => entry.empty);

  console.log('\n─────────────────────────────');
  console.log(`תקינות:      ${ready.length}`);
  console.log(`עם שגיאות:   ${failed.length}`);
  console.log(`לא מולאו:    ${empty.length}`);

  if (ready.length === 0) {
    console.log('\nאין שורה תקינה לייבוא.');
    return;
  }

  if (!opts.apply) {
    console.log('\nזו ריצה יבשה — לא נגענו במסד ולא ב-uploads.');
    console.log('לייבוא בפועל:  npm run products:import-new -- --apply');
    return;
  }

  const { created, backupPath } = await apply(ready);

  console.log('\n─────────────────────────────');
  console.log(`נוצרו: ${created.length} מוצרים`);
  if (failed.length > 0) console.log(`דולגו (שגיאות): ${failed.length}`);
  console.log(`\nלביטול:  npm run products:import-new -- --revert ${rel(backupPath)}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
