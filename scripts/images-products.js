/**
 * צינור התמונות של המוצרים: מצילום גולמי בטלפון לתמונת חנות אחידה.
 *
 *   npm run images:products                       — עיבוד בלבד, לתיקיית ההמתנה
 *   npm run images:products -- --force            — לעבד הכול מחדש
 *   npm run images:products -- --apply            — לחבר את התוצאות למוצרים
 *   npm run images:products -- --apply --include-flagged
 *   npm run images:products -- --revert <קובץ גיבוי>
 *
 * מקור:  photos/raw/247.jpg, photos/raw/247-2.jpg, photos/raw/new-משהו.jpg
 * יעד:   photos/processed/247.webp, photos/processed/new/new-משהו.webp
 * תצוגה: photos/preview.html
 *
 * מה קורה לתמונה, לפי הסדר:
 *   1. סיבוב לפי EXIF — צילומי טלפון שמורים כמעט תמיד "שכובים".
 *   2. הסרת רקע מקומית לגמרי (ראה MODEL למטה) — מקבלים מסכת שקיפות.
 *   3. חיתוך למלבן החוסם של המוצר לפי המסכה.
 *   4. מרכוז על ריבוע לבן 1200×1200, המוצר תופס עד 80% ממנו.
 *   5. השטחה על לבן ויצוא WebP באיכות 82.
 *
 * הפיקסלים של המוצר עצמו לא משתנים: אין כאן שום מודל שמייצר תמונה,
 * רק מסכה שאומרת "מכאן והלאה זה רקע". מה שרואים בתמונה הסופית צולם.
 *
 * הריצה הרגילה לא נוגעת במסד ולא בתיקיית ההעלאות שהשרת מגיש.
 * photos/processed היא אזור המתנה: מסתכלים על preview.html, ורק אחר כך
 * מריצים --apply.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const db = require('../server/config/db');
const productModel = require('../server/models/product.model');
const { UPLOADS_DIR, pathToUrl } = require('./lib/uploads');
const { cutout, stop: stopCutout } = require('./lib/cutout');

const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'photos', 'raw');
const PROCESSED_DIR = path.join(ROOT, 'photos', 'processed');
const NEW_DIR = path.join(PROCESSED_DIR, 'new');
const PREVIEW_PATH = path.join(ROOT, 'photos', 'preview.html');
const MANIFEST_PATH = path.join(PROCESSED_DIR, '.manifest.json');
const BACKUP_DIR = path.join(ROOT, 'design-assets');

const CANVAS = 1200;          // הריבוע הסופי
const PRODUCT_RATIO = 0.8;    // כמה ממנו המוצר תופס — 10% שוליים מכל צד
const WEBP_QUALITY = 82;

/* הסרת הרקע רצה על עותק מוקטן ולא על 4032 פיקסל: המודל עצמו עובד ברזולוציה
   של 1024, ולכן מעבר לזה רק מאטים. המסכה שיוצאת נמתחת חזרה על התמונה
   המלאה, כך שהחיתוך והרזולוציה הסופית נגזרים מהמקור ולא מהעותק. */
const WORK_SIZE = 1400;

/* 'medium' הוא ברירת המחדל של החבילה והאיכות שמצדיקה את הזמן.
   'small' מהיר יותר ומשאיר יותר שאריות רקע סביב קצוות דקים. */
const MODEL = 'medium';

/* מתחת לזה זה כבר לא המוצר אלא הילה. גבוה מספיק כדי לא לגרור צל חלש,
   נמוך מספיק כדי לא לקצץ קצה מטושטש. */
const ALPHA_EDGE = 24;

/* ספי הדגלים. הכיסוי נמדד רק על פיקסלים אטומים באמת. */
const COVERAGE_MIN = 0.05;
const COVERAGE_MAX = 0.90;
const MIN_LONG_SIDE = 500;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const HEIC_EXT = new Set(['.heic', '.heif']);

// ───────────────────────────── ארגומנטים ─────────────────────────────

/** קורא את דגלי שורת הפקודה, ונופל על ארגומנט שלא מוכר. */
function parseArgs(argv) {
  const opts = { force: false, apply: false, includeFlagged: false, revert: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg === '--apply') opts.apply = true;
    else if (arg === '--include-flagged') opts.includeFlagged = true;
    else if (arg === '--revert') {
      opts.revert = argv[i + 1];
      if (!opts.revert) throw new Error('חסר שם קובץ אחרי --revert');
      i += 1;
    } else {
      throw new Error(
        `ארגומנט לא מוכר: ${arg}\n` +
        'מותרים: --force, --apply, --include-flagged, --revert <קובץ>'
      );
    }
  }

  if (opts.revert && (opts.apply || opts.force)) {
    throw new Error('--revert רץ לבדו. הוא רק מחזיר את המסד למה שהיה.');
  }

  return opts;
}

// ────────────────────────────── עזרים ──────────────────────────────

/** בורח מתווים שיש להם משמעות ב-HTML. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** גודל קובץ בקילובייטים. */
function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

/** נתיב יחסי לשורש הפרויקט, עם לוכסנים רגילים. */
function rel(target) {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

/** קידוד נתיב לשימוש ב-src של HTML, בלי לקודד את הלוכסנים. */
function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

// ──────────────────────────── שיוך קבצים ────────────────────────────

/**
 * מפרש שם קובץ למקום שאליו התמונה שייכת.
 *
 *   247.jpg      → מוצר 247, תמונה ראשית
 *   247-2.JPG    → מוצר 247, זווית שנייה
 *   new-מברשת.jpg → מוצר חדש שעוד לא במסד
 *
 * מחזיר null לשם שלא מתאים לאף תבנית — עדיף לדווח עליו מאשר לנחש.
 */
function parseSlot(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, path.extname(fileName));

  if (/^new-/i.test(base)) {
    return { kind: 'new', key: `new:${base.toLowerCase()}`, name: base.toLowerCase(), index: 1, ext };
  }

  const match = base.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const id = Number(match[1]);
  const index = match[2] ? Number(match[2]) : 1;
  if (!Number.isSafeInteger(id) || id <= 0 || index <= 0) return null;

  return { kind: 'product', key: `${id}:${index}`, id, index, ext };
}

/** שם קובץ הפלט של שיבוץ: 247.webp, 247-2.webp, new-מברשת.webp. */
function outputName(slot) {
  if (slot.kind === 'new') return `${slot.name}.webp`;
  return slot.index === 1 ? `${slot.id}.webp` : `${slot.id}-${slot.index}.webp`;
}

/** תיקיית הפלט של שיבוץ. */
function outputDir(slot) {
  return slot.kind === 'new' ? NEW_DIR : PROCESSED_DIR;
}

// ──────────────────────────── הסרת רקע ────────────────────────────

/**
 * מוצא את המלבן החוסם של המוצר במסכת השקיפות, ואת שיעור הכיסוי שלה.
 *
 * הסף לחיתוך נמוך מזה של הכיסוי בכוונה: לחיתוך רוצים גם את הקצה
 * המטושטש, ולשאלה "האם ההסרה הצליחה" רוצים רק פיקסלים אטומים באמת.
 */
function measureMask(alpha, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1, solid = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const value = alpha[row + x];
      if (value <= ALPHA_EDGE) continue;
      if (value >= 128) solid += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const coverage = solid / (width * height);

  // מסכה ריקה לגמרי: אין מה לחתוך, לוקחים את כל הפריים ומסמנים לבדיקה.
  if (maxX < 0) {
    return { box: { left: 0, top: 0, width, height }, coverage: 0, empty: true };
  }

  return {
    box: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    coverage,
    empty: false,
  };
}

/**
 * מעבד תמונה אחת מקצה לקצה ומחזיר את רשומת המניפסט שלה.
 */
async function processPhoto(sourcePath, slot, scratch) {
  const started = Date.now();

  // 1. סיבוב לפי EXIF והשטחה על לבן. מכאן והלאה עובדים על RGB גולמי:
  //    מקור PNG עם שקיפות כבר לא מפריע, ואפשר לחבר מסכה חדשה.
  const { data: rgb, info } = await sharp(sourcePath)
    .rotate()
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  // 2. הסרת רקע על עותק מוקטן. היא רצה בתהליך נפרד (ראה lib/cutout.js),
  //    ולכן המעבר בין התהליכים הוא דרך שני קבצים זמניים.
  const smallPath = path.join(scratch, 'in.png');
  const cutPath = path.join(scratch, 'cut.png');

  await sharp(rgb, { raw: { width, height, channels: info.channels } })
    .resize({ width: WORK_SIZE, height: WORK_SIZE, fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(smallPath);

  await cutout(smallPath, cutPath, MODEL);

  // 3. מתיחת המסכה חזרה לגודל המלא, כדי שהחיתוך יהיה ברזולוציית המקור.
  const alpha = await sharp(cutPath)
    .extractChannel('alpha')
    .resize(width, height, { fit: 'fill' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const { box, coverage, empty } = measureMask(alpha, width, height);

  // 4. חיתוך והקטנה. ההקטנה לעולם לא מגדילה: חיתוך קטן מהיעד נשאר
  //    בגודלו ורק מתמרכז, כי מתיחה שלו הייתה ממציאה פיקסלים שלא צולמו.
  const target = Math.round(CANVAS * PRODUCT_RATIO);
  const scale = Math.min(target / box.width, target / box.height, 1);
  const drawWidth = Math.max(1, Math.round(box.width * scale));
  const drawHeight = Math.max(1, Math.round(box.height * scale));

  // 5. הצבע והמסכה נחתכים כשתי צינורות נפרדים ומתחברים רק בסוף.
  //    ב-sharp, extract ו-resize שבאים אחרי joinChannel פשוט לא
  //    מתבצעים — התמונה יוצאת בגודל המקורי, והרכבה על הקנבס נופלת
  //    על "must have same dimensions or smaller". toColourspace('b-w')
  //    על המסכה נחוץ מאותה משפחה של הפתעות: בלעדיו sharp מחזיר את
  //    ערוץ האפור הבודד כשלושה ערוצים.
  const resize = (pipeline) => pipeline
    .extract(box)
    .resize(drawWidth, drawHeight, { fit: 'fill' });

  const colorCrop = await resize(sharp(rgb, { raw: { width, height, channels: info.channels } }))
    .raw()
    .toBuffer();

  const alphaCrop = await resize(sharp(alpha, { raw: { width, height, channels: 1 } }))
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const scaled = await sharp(colorCrop, {
    raw: { width: drawWidth, height: drawHeight, channels: info.channels },
  })
    .joinChannel(alphaCrop, { raw: { width: drawWidth, height: drawHeight, channels: 1 } })
    .png()
    .toBuffer();

  // 6. מרכוז על הריבוע הלבן. הבסיס בן שלושה ערוצים, ולכן מה שיוצא
  //    מכאן הוא אטום לגמרי — בלי שקיפות שתתגלה כשחור אצל מישהו.
  const outPath = path.join(outputDir(slot), outputName(slot));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite([{
      input: scaled,
      left: Math.round((CANVAS - drawWidth) / 2),
      top: Math.round((CANVAS - drawHeight) / 2),
    }])
    .webp({ quality: WEBP_QUALITY })
    .toFile(outPath);

  const longSide = Math.max(box.width, box.height);

  const flags = [];
  if (empty || coverage < COVERAGE_MIN) {
    flags.push(`הסרת הרקע כנראה נכשלה — המוצר מכסה ${(coverage * 100).toFixed(1)}% מהפריים`);
  } else if (coverage > COVERAGE_MAX) {
    flags.push(`המוצר מכסה ${(coverage * 100).toFixed(1)}% מהפריים — כנראה נשאר רקע`);
  }
  if (longSide < MIN_LONG_SIDE) {
    flags.push(`רזולוציה נמוכה — הצד הארוך של המוצר ${longSide} פיקסל`);
  }

  return {
    output: rel(outPath),
    outputName: path.basename(outPath),
    bytes: fs.statSync(outPath).size,
    sourceWidth: width,
    sourceHeight: height,
    cropWidth: box.width,
    cropHeight: box.height,
    coverage: Number(coverage.toFixed(4)),
    upscaleBlocked: scale === 1 && Math.max(box.width, box.height) < target,
    ms: Date.now() - started,
    flags,
  };
}

// ───────────────────────────── מניפסט ─────────────────────────────

/** קורא את המניפסט של הריצה הקודמת, או מחזיר ריק. */
function readManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

/** כותב את המניפסט. --apply ו-preview.html נשענים עליו, ולכן הוא
 *  חייב לתאר את כל מה שקיים בתיקייה ולא רק את מה שעובד עכשיו. */
function writeManifest(entries) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2),
    'utf8'
  );
}

// ────────────────────────────── עיבוד ──────────────────────────────

/**
 * עובר על photos/raw, מעבד את מה שצריך ומחזיר את רשומות כל התמונות.
 */
async function runProcessing(opts) {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(path.join(RAW_DIR, '.gitkeep'), '');
  }

  const files = fs.readdirSync(RAW_DIR)
    .filter((f) => !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'he'));

  const previous = new Map(readManifest().map((e) => [e.source, e]));

  const entries = [];
  const heic = [];
  const unusable = [];
  const takenSlots = new Map();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const sourcePath = path.join(RAW_DIR, file);

    if (HEIC_EXT.has(ext)) {
      heic.push(file);
      continue;
    }
    if (!IMAGE_EXT.has(ext)) {
      unusable.push({ file, reason: `סיומת לא נתמכת (${ext || 'ללא סיומת'})` });
      continue;
    }

    const slot = parseSlot(file);
    if (!slot) {
      unusable.push({ file, reason: 'שם הקובץ אינו <מספר>.jpg, <מספר>-2.jpg או new-*.jpg' });
      continue;
    }

    // שני קבצים לאותו שיבוץ (הקלאסי: 247.jpg ו-247.JPG). מעבדים את
    // הראשון ומסמנים אותו, כי אחרת השני היה דורס אותו בשקט.
    const owner = takenSlots.get(slot.key);
    if (owner) {
      owner.duplicates.push(file);
      unusable.push({ file, reason: `אותו שיבוץ כמו ${owner.source} — לא עובד` });
      continue;
    }

    const entry = {
      source: file,
      sourceMtimeMs: fs.statSync(sourcePath).mtimeMs,
      kind: slot.kind,
      id: slot.kind === 'product' ? slot.id : null,
      index: slot.index,
      duplicates: [],
    };
    takenSlots.set(slot.key, entry);
    entries.push({ entry, slot, sourcePath });
  }

  console.log(`${entries.length} תמונות ב-${rel(RAW_DIR)}\n`);

  // הקבצים שעוברים בין התהליך הראשי לתהליך הסרת הרקע. זמניים באמת:
  // נמחקים בסוף הריצה, ולא נכנסים לתיקיות הפרויקט.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-cutout-'));

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, { entry, slot, sourcePath }] of entries.entries()) {
    const outPath = path.join(outputDir(slot), outputName(slot));
    const before = previous.get(entry.source);
    const fresh = !opts.force
      && before
      && before.output
      && fs.existsSync(outPath)
      && fs.statSync(outPath).mtimeMs >= entry.sourceMtimeMs;

    const position = `[${String(i + 1).padStart(3)}/${entries.length}]`;

    if (fresh) {
      Object.assign(entry, {
        output: before.output,
        outputName: before.outputName,
        bytes: before.bytes,
        sourceWidth: before.sourceWidth,
        sourceHeight: before.sourceHeight,
        cropWidth: before.cropWidth,
        cropHeight: before.cropHeight,
        coverage: before.coverage,
        upscaleBlocked: before.upscaleBlocked,
        ms: before.ms,
        flags: before.flags || [],
      });
      skipped += 1;
      console.log(`${position} ⏭  ${entry.source}  (עדכני)`);
      continue;
    }

    try {
      Object.assign(entry, await processPhoto(sourcePath, slot, scratch));
      processed += 1;
      const mark = entry.flags.length > 0 ? '⚠' : '✓';
      console.log(
        `${position} ${mark}  ${entry.source} → ${entry.outputName}  ` +
        `(${kb(entry.bytes)}, ${(entry.ms / 1000).toFixed(1)}s)`
      );
      entry.flags.forEach((f) => console.log(`             לבדיקה: ${f}`));
    } catch (err) {
      entry.flags = [`העיבוד נכשל: ${err.message}`];
      entry.error = err.message;
      failed += 1;
      console.log(`${position} ✗  ${entry.source}  — ${err.message}`);
    }
  }

  stopCutout();
  fs.rmSync(scratch, { recursive: true, force: true });

  const finalEntries = entries.map(({ entry }) => entry);

  // הכפילויות התגלו אחרי שהרשומה נוצרה, ולכן הדגל נוסף רק כאן.
  for (const entry of finalEntries) {
    if (entry.duplicates.length > 0) {
      entry.flags = [
        `יש עוד קובץ לאותו שיבוץ: ${entry.duplicates.join(', ')}`,
        ...(entry.flags || []),
      ];
    }
  }

  return { entries: finalEntries, heic, unusable, counts: { processed, skipped, failed } };
}

// ──────────────────────── שמות המוצרים מהמסד ────────────────────────

/** מחזיר מפה id → מוצר, עבור המזהים שמופיעים בתמונות. */
async function fetchProducts(entries) {
  const ids = [...new Set(entries.filter((e) => e.id).map((e) => e.id))];
  const map = new Map();

  for (const id of ids) {
    const product = await productModel.findById(id);
    if (product) map.set(id, product);
  }

  return map;
}

// ───────────────────────────── תצוגה ─────────────────────────────

/** בונה את photos/preview.html — דף מקומי שנפתח בדפדפן בלי שרת. */
function writePreview(entries, products, heic, unusable) {
  const cards = entries.map((entry) => {
    const product = entry.id ? products.get(entry.id) : null;
    const flags = entry.flags || [];
    const unknown = entry.kind === 'product' && !product;

    const allFlags = unknown
      ? [`אין מוצר עם מזהה ${entry.id} במסד`, ...flags]
      : flags;

    const title = product
      ? escapeHtml(product.name)
      : (entry.kind === 'new' ? 'מוצר חדש — עוד לא במסד' : 'מזהה לא מוכר');

    const label = entry.kind === 'new'
      ? escapeHtml(entry.source)
      : `${entry.id}${entry.index > 1 ? ` · זווית ${entry.index}` : ''}`;

    const processedImg = entry.output
      ? `<img src="${encodePath(escapeHtml(path.relative(path.join(ROOT, 'photos'), path.join(ROOT, entry.output)).replace(/\\/g, '/')))}" alt="">`
      : '<div class="missing">לא עובד</div>';

    return `
    <figure class="card${allFlags.length > 0 ? ' card--flagged' : ''}">
      <div class="pair">
        <div class="shot shot--out">${processedImg}</div>
        <div class="shot shot--raw"><img src="raw/${encodePath(escapeHtml(entry.source))}" alt=""></div>
      </div>
      <figcaption>
        <div class="line">
          <span class="id">${label}</span>
          ${allFlags.length > 0 ? '<span class="badge">לבדיקה</span>' : ''}
        </div>
        <div class="name">${title}</div>
        ${entry.cropWidth ? `<div class="tech">${entry.cropWidth}×${entry.cropHeight} · ${entry.bytes ? kb(entry.bytes) : ''}</div>` : ''}
        ${allFlags.map((f) => `<div class="reason">${escapeHtml(f)}</div>`).join('')}
      </figcaption>
    </figure>`;
  }).join('');

  const problems = [
    ...heic.map((f) => ({ file: f, reason: 'HEIC — צריך להמיר ל-JPG לפני העיבוד' })),
    ...unusable,
  ];

  const problemsBlock = problems.length === 0 ? '' : `
  <section class="problems">
    <h2>קבצים שלא עובדו (${problems.length})</h2>
    <ul>
      ${problems.map((p) => `<li><code>${escapeHtml(p.file)}</code> — ${escapeHtml(p.reason)}</li>`).join('')}
    </ul>
  </section>`;

  const flagged = entries.filter((e) => (e.flags || []).length > 0
    || (e.kind === 'product' && !products.get(e.id))).length;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תמונות מוצרים — בדיקה לפני חיבור</title>
<style>
  :root {
    --bg: #f4f4f5;
    --card: #fff;
    --ink: #18181b;
    --muted: #71717a;
    --line: #e4e4e7;
    --alert: #c81e1e;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 24px;
    font-family: "Segoe UI", Arial, sans-serif;
    background: var(--bg);
    color: var(--ink);
  }

  header { margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .meta { color: var(--muted); font-size: 14px; }
  .meta .alert { color: var(--alert); font-weight: 600; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 14px;
  }

  .card {
    margin: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .card--flagged { border-color: var(--alert); box-shadow: 0 0 0 1px var(--alert) inset; }

  .pair { display: flex; gap: 1px; background: var(--line); }

  .shot {
    flex: 1;
    aspect-ratio: 1;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .shot--raw { flex: 0 0 34%; background: #fafafa; }
  .shot img { max-width: 100%; max-height: 100%; object-fit: contain; }

  .missing { color: var(--muted); font-size: 13px; }

  figcaption { padding: 9px 11px 11px; }

  .line { display: flex; align-items: center; gap: 7px; }
  .id { font-size: 17px; font-weight: 700; direction: ltr; }

  .badge {
    background: var(--alert);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
    padding: 2px 9px;
  }

  .name { font-size: 13.5px; margin-top: 2px; }
  .tech { font-size: 11.5px; color: var(--muted); margin-top: 3px; direction: ltr; text-align: right; }
  .reason { font-size: 12px; color: var(--alert); margin-top: 5px; }

  .problems {
    margin-top: 26px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 18px;
  }
  .problems h2 { font-size: 15px; margin: 0 0 8px; }
  .problems ul { margin: 0; padding-inline-start: 20px; font-size: 13.5px; line-height: 1.7; }
  .problems code { direction: ltr; display: inline-block; }
</style>
</head>
<body>

<header>
  <h1>תמונות מוצרים — בדיקה לפני חיבור</h1>
  <div class="meta">
    ${entries.length} תמונות ·
    ${flagged > 0 ? `<span class="alert">${flagged} לבדיקה</span>` : 'הכול נראה תקין'} ·
    בכל כרטיס: משמאל התוצאה, מימין הצילום המקורי
  </div>
</header>

<div class="grid">${cards}</div>
${problemsBlock}

</body>
</html>
`;

  fs.writeFileSync(PREVIEW_PATH, html, 'utf8');
}

// ──────────────────────── חיבור התמונות למוצרים ────────────────────────

/**
 * מעתיק את התמונות לתיקיית ההעלאות ומעדכן את המוצרים.
 *
 * לפני כל כתיבה נשמר גיבוי של image_url ו-images הקודמים של כל שורה
 * שעומדת להשתנות, כדי ש---revert יוכל להחזיר בדיוק את מה שהיה.
 */
async function applyToProducts(entries, products, opts) {
  const usable = entries.filter((e) => e.kind === 'product' && e.output && !e.error);

  const byProduct = new Map();
  const skippedFlagged = [];
  const unknownIds = new Set();

  for (const entry of usable) {
    if (!products.has(entry.id)) {
      unknownIds.add(entry.id);
      continue;
    }
    if ((entry.flags || []).length > 0 && !opts.includeFlagged) {
      skippedFlagged.push(entry);
      continue;
    }
    if (!byProduct.has(entry.id)) byProduct.set(entry.id, []);
    byProduct.get(entry.id).push(entry);
  }

  const waitingNew = entries.filter((e) => e.kind === 'new' && e.output).length;

  if (byProduct.size === 0) {
    console.log('\nאין תמונות לחיבור.');
    return { updated: 0, skippedFlagged, unknownIds, waitingNew, backupPath: null };
  }

  // הזווית הראשית קודם, ואחריה שאר הזוויות לפי המספר שבשם הקובץ.
  for (const list of byProduct.values()) list.sort((a, b) => a.index - b.index);

  // הגיבוי נכתב לפני העדכון הראשון, ומכסה את כל השורות שייגעו.
  const backup = [...byProduct.keys()].sort((a, b) => a - b).map((id) => {
    const product = products.get(id);
    return {
      id,
      name: product.name,
      image_url: product.image_url ?? null,
      images: product.images ?? [],
    };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `image-backup-${stamp}.json`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ createdAt: new Date().toISOString(), rows: backup }, null, 2),
    'utf8'
  );
  console.log(`\nגיבוי של ${backup.length} שורות:  ${rel(backupPath)}`);

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  let updated = 0;

  for (const [id, list] of [...byProduct.entries()].sort((a, b) => a[0] - b[0])) {
    const urls = list.map((entry) => {
      const fileName = entry.index === 1 ? `product-${id}.webp` : `product-${id}-${entry.index}.webp`;
      fs.copyFileSync(path.join(ROOT, entry.output), path.join(UPLOADS_DIR, fileName));
      return pathToUrl(fileName);
    });

    // image_url הוא הראשית, ו-images כולל אותה בראש — כך נראות השורות
    // הקיימות במסד, והגלריה בקליינט מסירה כפילויות ממילא.
    await productModel.update(id, { image_url: urls[0], images: urls });

    updated += 1;
    console.log(`  ✓  ${id}  ${products.get(id).name}  →  ${urls.join(', ')}`);
  }

  return { updated, skippedFlagged, unknownIds, waitingNew, backupPath };
}

/** מחזיר את image_url ו-images של כל שורה בגיבוי למה שהיה. */
async function revert(file) {
  const fullPath = path.isAbsolute(file) ? file : path.resolve(ROOT, file);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (err) {
    throw new Error(`לא הצלחתי לקרוא את קובץ הגיבוי ${file}: ${err.message}`);
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows : null;
  if (!rows) throw new Error(`${file} אינו קובץ גיבוי תקין (חסר שדה rows).`);

  console.log(`משחזר ${rows.length} שורות מתוך ${rel(fullPath)}:\n`);

  let restored = 0;
  let missing = 0;

  for (const row of rows) {
    const result = await productModel.update(row.id, {
      image_url: row.image_url,
      images: row.images ?? [],
    });

    if (!result) {
      missing += 1;
      console.log(`  ✗  ${row.id}  — המוצר כבר לא קיים`);
      continue;
    }

    restored += 1;
    console.log(`  ↩  ${row.id}  ${row.name || ''}  →  ${row.image_url ?? '(ריק)'}`);
  }

  console.log(`\nשוחזרו ${restored} שורות${missing > 0 ? `, ${missing} לא נמצאו` : ''}.`);
  console.log('הקבצים ב-uploads לא נמחקו — רק הקישורים במסד חזרו.');
}

// ─────────────────────────────── ראשי ───────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.revert) {
    await revert(opts.revert);
    return;
  }

  const { entries, heic, unusable, counts } = await runProcessing(opts);

  writeManifest(entries);

  const products = await fetchProducts(entries);
  writePreview(entries, products, heic, unusable);

  const flagged = entries.filter((e) => (e.flags || []).length > 0);
  const unknown = entries.filter((e) => e.kind === 'product' && !products.has(e.id));
  const newOnes = entries.filter((e) => e.kind === 'new');

  console.log('\n─────────────────────────────');
  console.log(`עובדו:        ${counts.processed}`);
  console.log(`דולגו (עדכני): ${counts.skipped}`);
  if (counts.failed > 0) console.log(`נכשלו:        ${counts.failed}`);
  console.log(`לבדיקה:       ${flagged.length}`);
  if (unknown.length > 0) console.log(`מזהה לא מוכר: ${unknown.length}  (${unknown.map((e) => e.id).join(', ')})`);
  if (newOnes.length > 0) console.log(`מוצרים חדשים: ${newOnes.length}  (ממתינים ב-${rel(NEW_DIR)})`);
  if (heic.length > 0) console.log(`HEIC:         ${heic.length}  — צריך להמיר ל-JPG`);
  if (unusable.length > 0) console.log(`לא עובדו:     ${unusable.length}`);

  console.log(`\n  ✓  ${rel(PREVIEW_PATH)}   ← לפתוח בדפדפן ולעבור על התמונות`);

  if (!opts.apply) {
    console.log('\nהתמונות ממתינות ב-' + rel(PROCESSED_DIR) + '. לא נגענו במסד ולא ב-uploads.');
    console.log('לחיבור למוצרים:  npm run images:products -- --apply');
    return;
  }

  const result = await applyToProducts(entries, products, opts);

  console.log('\n─────────────────────────────');
  console.log(`מוצרים שעודכנו:       ${result.updated}`);
  console.log(`דולגו (לבדיקה):       ${result.skippedFlagged.length}` +
    (result.skippedFlagged.length > 0 && !opts.includeFlagged ? '   (--include-flagged כדי לכלול)' : ''));
  console.log(`מזהים שלא במסד:       ${result.unknownIds.size}` +
    (result.unknownIds.size > 0 ? `  (${[...result.unknownIds].join(', ')})` : ''));
  console.log(`מוצרים חדשים ממתינים: ${result.waitingNew}`);

  if (result.backupPath) {
    console.log(`\nלביטול:  npm run images:products -- --revert ${rel(result.backupPath)}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
