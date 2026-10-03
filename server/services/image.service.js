/**
 * מעבד תמונת מוצר שהועלתה לפני שמירתה: מיישר לפי ה-EXIF, מקטין
 * לצלע ארוכה של 1200px, משלים לריבוע בלי לחתוך (processImage) ושומר
 * כ-WebP בשם שנגזר מהתוכן.
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

/* רוחב פס השוליים שממנו נדגם צבע ההרחבה, כחלק מהצד הקצר: 2% — ב-900px
   אלה 18 עמודות. רחב מספיק כדי שפיקסל רועש אחד לא יקבע את הצבע, וצר
   מספיק כדי לא להגיע למוצר עצמו. */
const EDGE_STRIP = 0.02;

/**
 * משלים פיקסלים גולמיים לריבוע, בצבע שנדגם מפסי השוליים.
 *
 * הדגימה היא לכל שורה בנפרד ולכל צד בנפרד — ממוצע של פס השוליים באותה
 * שורה — ולא צבע אחד לכל התוספת. צילום מוצר הוא כמעט תמיד קיר מעל
 * משטח: ממוצע אחד של כל הפס יוצא אפור שאינו אף אחד מהם, ונראה כמו
 * פס שהודבק בצד. ממוצע לכל שורה ממשיך את הקיר כקיר ואת המשטח כמשטח.
 * הממוצעים מוחלקים על פני כמה שורות שכנות, כדי שרעש בפיקסל בודד לא
 * יהפוך לקו לרוחב התוספת.
 *
 * תמונה שוכבת מטופלת כמו עומדת אחרי היפוך צירים: "שורה" היא עמודה,
 * והשוליים הם למעלה ולמטה.
 */
function extendToSquare(data, { width, height, channels }) {
  const portrait = height > width;
  const size = Math.max(width, height);
  const along = portrait ? height : width;          // אורך הצלע שלאורכה דוגמים
  const across = portrait ? width : height;         // הצלע הקצרה
  const strip = Math.max(1, Math.round(across * EDGE_STRIP));
  const before = Math.floor((size - across) / 2);
  const pixel = (i, j) => (portrait ? (i * width + j) : (j * width + i)) * channels;

  // ממוצע הפס בכל שורה, לכל אחד משני הצדדים
  const sideMeans = (fromEnd) => Array.from({ length: along }, (_, i) => {
    const sums = new Array(channels).fill(0);
    for (let k = 0; k < strip; k++) {
      const at = pixel(i, fromEnd ? across - 1 - k : k);
      for (let c = 0; c < channels; c++) sums[c] += data[at + c];
    }
    return sums.map((sum) => sum / strip);
  });

  // החלקה על פני השורות השכנות (חלון של פס אחד לכל כיוון)
  const smooth = (means) => means.map((_, i) => {
    const from = Math.max(0, i - strip);
    const to = Math.min(along - 1, i + strip);
    const sums = new Array(channels).fill(0);
    for (let k = from; k <= to; k++) for (let c = 0; c < channels; c++) sums[c] += means[k][c];
    return sums.map((sum) => Math.round(sum / (to - from + 1)));
  });

  const start = smooth(sideMeans(false));
  const end = smooth(sideMeans(true));
  const out = Buffer.alloc(size * size * channels);
  const outPixel = (i, j) => (portrait ? (i * size + j) : (j * size + i)) * channels;

  for (let i = 0; i < along; i++) {
    for (let j = 0; j < size; j++) {
      const at = outPixel(i, j);
      if (j < before) out.set(start[i], at);
      else if (j >= before + across) out.set(end[i], at);
      else data.copy(out, at, pixel(i, j - before), pixel(i, j - before) + channels);
    }
  }
  return { data: out, info: { width: size, height: size, channels } };
}

/**
 * מיישר, מקטין לצלע ארוכה של 1200px, משלים לריבוע ומקודד ל-WebP.
 *
 * הריבוע הוא בשביל החלון: כרטיס המוצר והגלריה הם ריבועים עם
 * object-fit: cover, ומצלמת האדמין מצלמת 3:4. תמונה עומדת מילאה את
 * החלון רק אחרי שנחתכה מלמעלה ומלמטה — וזה בדיוק המקום שבו נגמר מגב
 * או מטאטא. כאן לא חותכים: הצד הקצר מורחב לריבוע, וצבע התוספת נדגם
 * מפסי השוליים שהיא נצמדת אליהם (extendToSquare), כך שהיא נראית המשך
 * של הרקע. תמונה שכבר ריבועית אינה מורחבת.
 *
 * ההקטנה קודמת להרחבה, ולא להפך: התוצאה זהה (ריבוע של 1200 לכל היותר),
 * אבל הדגימה וההרחבה רצות על 1200px ולא על 4000px של המצלמה. השלב
 * שבאמצע הוא פיקסלים גולמיים, כך שהתמונה נדחסת פעם אחת בלבד.
 */
async function processImage(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const square = info.width === info.height ? { data, info } : extendToSquare(data, info);
  const { width, height, channels } = square.info;
  return sharp(square.data, { raw: { width, height, channels } })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/** שם הקובץ שנגזר מהתוכן המעובד. */
function contentName(output) {
  return `${crypto.createHash('sha256').update(output).digest('hex').slice(0, 16)}.webp`;
}

/**
 * מעבד תמונה אחת מהזיכרון ושומר אותה בתיקייה. מחזיר את שם הקובץ.
 * תמונה זהה שכבר קיימת אינה נכתבת מחדש.
 */
async function processAndSave(buffer, dir) {
  if (isHeic(buffer)) throw heicError();

  let output;
  try {
    output = await processImage(buffer);
  } catch {
    throw badRequest('הקובץ אינו תמונה תקינה או שאינו נקרא');
  }

  const filename = contentName(output);

  try {
    await fs.writeFile(path.join(dir, filename), output, { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  return filename;
}

module.exports = {
  processAndSave, processImage, contentName, heicError, WEBP_QUALITY,
};
