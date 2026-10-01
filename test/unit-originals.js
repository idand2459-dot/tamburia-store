/**
 * בודק את server/utils/originals.js בבידוד, על תיקייה זמנית: שמירת
 * המקור בשם המקושר לקובץ המעובד, מציאתו, מחיקתו, והבחירה ממה לעבד
 * מחדש (images:products --from-uploads) — מהמקור כשקיים, מהמעובד כשלא.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  originalExt, saveOriginal, findOriginal, removeOriginal, sourceForUpload,
} = require('../server/utils/originals');

let passed = 0;
let failed = 0;

/** רושם תוצאה של בדיקה בודדת. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-originals-'));
const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-uploads-'));

try {
  console.log('\n── סיומת המקור');
  check('jpg נשאר jpg', originalExt('IMG_1234.jpg', 'image/jpeg') === '.jpg', originalExt('IMG_1234.jpg'));
  check('JPEG באותיות גדולות → .jpg', originalExt('IMG_1234.JPEG', 'image/jpeg') === '.jpg', originalExt('IMG_1234.JPEG'));
  check('png נשאר png', originalExt('shot.PNG', 'image/png') === '.png', originalExt('shot.PNG'));
  check('בלי סיומת → לפי סוג התוכן', originalExt('blob', 'image/webp') === '.webp', originalExt('blob', 'image/webp'));

  console.log('\n── שמירה ומציאה');
  const bytes = Buffer.from('original-bytes-from-the-phone');
  const saved = saveOriginal(bytes, '0b99d097208f5e91.webp', '.jpg', dir);
  check('נשמר בשם המקושר: אותו בסיס, סיומת המקור', path.basename(saved) === '0b99d097208f5e91.jpg', path.basename(saved));
  check('התוכן כמו שהגיע', fs.readFileSync(saved).equals(bytes));

  saveOriginal(Buffer.from('other'), '0b99d097208f5e91.webp', '.jpg', dir);
  check('אותה תמונה שוב — לא נדרסת', fs.readFileSync(saved).equals(bytes));

  check('נמצא לפי שם הקובץ המעובד', findOriginal('0b99d097208f5e91.webp', dir) === saved, findOriginal('0b99d097208f5e91.webp', dir));
  check('אין מקור → null', findOriginal('ffffffffffffffff.webp', dir) === null);

  console.log('\n── ממה לעבד מחדש');
  const withOriginal = path.join(uploads, '0b99d097208f5e91.webp');
  const without = path.join(uploads, 'ffffffffffffffff.webp');
  const a = sourceForUpload(withOriginal, dir);
  check('יש מקור → מהמקור', a.original === true && a.path === saved, a);
  const b = sourceForUpload(without, dir);
  check('אין מקור → מהקובץ המעובד', b.original === false && b.path === without, b);

  console.log('\n── מחיקה');
  check('מחיקה מחזירה את מה שנמחק', removeOriginal('0b99d097208f5e91.webp', dir) === saved);
  check('והוא כבר לא קיים', !fs.existsSync(saved));
  check('מחיקה של מה שאין — לא נופלת', removeOriginal('0b99d097208f5e91.webp', dir) === null);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(uploads, { recursive: true, force: true });
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
