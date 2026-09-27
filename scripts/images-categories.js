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
   הומרו תמונות המקטעים: מעבר לזה הקובץ גדל בלי שההפרש נראה.

   אלה רוחבים מבוקשים ולא בהכרח מה שייצא: מקור צר מהם לא מנופח (ראה
   withoutEnlargement למטה), ושם הקובץ נושא את הרוחב שיצא בפועל. זה מה
   שמאפשר ל-srcSet של הבאנר להיגזר משם הקובץ ולהיות נכון — בדיוק כמו
   ה-hero-tools-1916.webp של עמוד הבית, ששמו אומר 1916 ולא 2400. */
const WIDTHS = [960, 1920];
const QUALITY = 82;

const force = process.argv.includes('--force');

/** בודק אם צריך להמיר: אין יעד, או שהמקור חדש ממנו. */
function isStale(srcPath, outPath) {
  if (force || !fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

/**
 * מוחק פלט ישן של אותה קטגוריה שאינו ברשימת הקבצים שהריצה הזו מייצרת.
 * בלי זה, שינוי ברוחב המקור או ב-WIDTHS היה משאיר קובץ יתום בתיקייה,
 * ו-CategoryBanner — שמגלה את התמונות לפי תוכן התיקייה — היה מגיש אותו.
 */
function pruneStale(id, keep) {
  fs.readdirSync(OUT_DIR)
    .filter((f) => f.startsWith(`${id}-`) && f.endsWith('.webp') && !keep.includes(f))
    .forEach((f) => {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log(`  ✗  ${f}  (יתום, נמחק)`);
    });
}

/** ממיר תמונה אחת לכל הרוחבים, ומחזיר כמה קבצים נכתבו בפועל. */
async function convert(fileName) {
  const id = path.basename(fileName, '.png');
  const srcPath = path.join(SRC_DIR, fileName);
  const srcWidth = (await sharp(srcPath).metadata()).width;

  // withoutEnlargement למטה אומר שמקור צר מהרוחב המבוקש יוצא ברוחב שלו.
  // כאן מחשבים את זה מראש, כי שם הקובץ צריך לשאת את הרוחב האמיתי. Set
  // כדי ששני רוחבים מבוקשים שנחתכים לאותו רוחב לא ייכתבו פעמיים.
  const outWidths = [...new Set(WIDTHS.map((w) => Math.min(w, srcWidth)))].sort((a, b) => a - b);

  pruneStale(id, outWidths.map((w) => `${id}-${w}.webp`));

  let written = 0;

  for (const width of outWidths) {
    const outPath = path.join(OUT_DIR, `${id}-${width}.webp`);

    if (!isStale(srcPath, outPath)) {
      console.log(`  ⏭  ${id}-${width}.webp  (עדכני)`);
      continue;
    }

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
