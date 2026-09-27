/**
 * ממיר את תמונות הבאנר של הקטגוריות ל-WebP בשני רוחבים.
 *
 * הרצה:
 *   npm run images:categories
 *
 * מקור:  design-assets/categories/cat-<id>.png   (ה-id מתוך categories.js)
 * יעד:   client/src/assets/images/categories/cat-<id>-960.webp
 *        client/src/assets/images/categories/cat-<id>-1920.webp
 *
 * הסקריפט אינו חלק מהבנייה ואינו רץ אוטומטית: התמונות המומרות מגיעות
 * ל-git, והבנייה קוראת אותן משם. מריצים אותו ביד כשנוספת תמונה חדשה.
 *
 * אידמפוטנטי: קובץ יעד שקיים וחדש מהמקור נדלג עליו, כך שהרצה חוזרת אחרי
 * הוספת תמונה אחת ממירה רק אותה. --force ממיר הכול מחדש (שימושי כששינו
 * את האיכות או את הרוחבים כאן).
 *
 * אין תיקיית מקור או אין בה קבצים — זו לא שגיאה. התמונות מגיעות בהדרגה,
 * ו-CategoryBanner מציג באנר חלופי לקטגוריה שאין לה תמונה.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'design-assets', 'categories');
const OUT_DIR = path.join(__dirname, '..', 'client', 'src', 'assets', 'images', 'categories');

/* שני הרוחבים שה-srcSet של הבאנר מציע. 1920 הוא הרוחב המלא של מסך רחב,
   960 הוא מסך רגיל ומסכי טלפון ב-DPR 2. quality 82 הוא אותו איזון שבו
   הומרו תמונות המקטעים: מעבר לזה הקובץ גדל בלי שההפרש נראה. */
const WIDTHS = [960, 1920];
const QUALITY = 82;

const force = process.argv.includes('--force');

/** בודק אם צריך להמיר: אין יעד, או שהמקור חדש ממנו. */
function isStale(srcPath, outPath) {
  if (force || !fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

/** ממיר תמונה אחת לכל הרוחבים, ומחזיר כמה קבצים נכתבו בפועל. */
async function convert(fileName) {
  const id = path.basename(fileName, '.png');
  const srcPath = path.join(SRC_DIR, fileName);
  let written = 0;

  for (const width of WIDTHS) {
    const outPath = path.join(OUT_DIR, `${id}-${width}.webp`);

    if (!isStale(srcPath, outPath)) {
      console.log(`  ⏭  ${id}-${width}.webp  (עדכני)`);
      continue;
    }

    // withoutEnlargement: מקור צר מ-1920 לא ינופח — זה היה עולה בבתים
    // בלי להוסיף פרט, בדיוק כמו בתמונת הכרזה של עמוד הבית.
    await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outPath);

    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ✓  ${id}-${width}.webp  (${kb} KB)`);
    written += 1;
  }

  return written;
}

/** ממיר את כל ה-cat-*.png שבתיקיית המקור. */
async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.log(`אין תיקיית מקור (${path.relative(process.cwd(), SRC_DIR)}) — אין מה להמיר.`);
    return;
  }

  const files = fs.readdirSync(SRC_DIR).filter((f) => /^cat-.+\.png$/i.test(f)).sort();

  if (files.length === 0) {
    console.log('לא נמצאו קבצי cat-*.png — אין מה להמיר.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`ממיר ${files.length} תמונות קטגוריה:`);
  let written = 0;
  for (const file of files) written += await convert(file);

  console.log(written === 0 ? '\nהכול היה מעודכן.' : `\nנכתבו ${written} קבצים.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
