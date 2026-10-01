/**
 * מעבד תמונת מוצר שהועלתה לפני שמירתה: מיישר לפי ה-EXIF, מקטין
 * לצלע ארוכה של 1200px ושומר כ-WebP בשם שנגזר מהתוכן.
 *
 * תמונות מהאייפון מגיעות ב-3–5MB, ורובן נשמרות "שוכבות" עם תגית
 * סיבוב שהדפדפן לא תמיד מכבד. אחרי העיבוד כל תמונה שוקלת עשרות
 * עד מאות KB, עומדת נכון, ונטולת מטא-דאטה (כולל מיקום ה-GPS).
 *
 * השם הוא hash של הקובץ המעובד, ולכן אותה תמונה שעולה פעמיים נשמרת
 * פעם אחת, ואפשר להגיש אותה עם מטמון ארוך בלי חשש שתתחלף מתחתיו.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { AppError, badRequest } = require('../utils/AppError');

const MAX_EDGE = 1200;
const WEBP_QUALITY = 82;

const HEIC_MESSAGE = 'קבצי HEIC אינם נתמכים — העלו מהטלפון או המירו ל-JPG';

/* מותגי ftyp של HEIC (קידוד HEVC). AVIF יושב באותה מעטפת בדיוק אבל
   עם מותג avif/avis, ו-sharp יודע לקרוא אותו — לכן הוא לא כאן. */
const HEVC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

/**
 * בודק לפי תחילת הקובץ אם הוא HEIC, בלי קשר לשם או לסוג שהדפדפן
 * הצהיר עליו. ה-sharp שמותקן כאן קורא HEIF רק בקידוד AV1, ובלי
 * הבדיקה הזו קובץ HEIC שהוחלפה לו הסיומת היה נופל בשגיאה סתמית.
 */
function isHeic(buffer) {
  if (buffer.length < 16 || buffer.toString('latin1', 4, 8) !== 'ftyp') return false;

  const major = buffer.toString('latin1', 8, 12);
  if (AVIF_BRANDS.has(major)) return false;
  if (HEVC_BRANDS.has(major)) return true;

  const boxEnd = Math.min(buffer.readUInt32BE(0), buffer.length);
  for (let i = 16; i + 4 <= boxEnd; i += 4) {
    if (HEVC_BRANDS.has(buffer.toString('latin1', i, i + 4))) return true;
  }
  return false;
}

/** שגיאת 415 על קובץ HEIC, משותפת לבדיקת השם ולבדיקת התוכן. */
const heicError = () => new AppError(415, HEIC_MESSAGE);

/**
 * מעבד תמונה אחת מהזיכרון ושומר אותה בתיקייה. מחזיר את שם הקובץ.
 * תמונה זהה שכבר קיימת אינה נכתבת מחדש.
 */
async function processAndSave(buffer, dir) {
  if (isHeic(buffer)) throw heicError();

  let output;
  try {
    output = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw badRequest('הקובץ אינו תמונה תקינה או שאינו נקרא');
  }

  const hash = crypto.createHash('sha256').update(output).digest('hex').slice(0, 16);
  const filename = `${hash}.webp`;

  try {
    await fs.writeFile(path.join(dir, filename), output, { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  return filename;
}

module.exports = { processAndSave, isHeic, heicError, MAX_EDGE, WEBP_QUALITY };
