/**
 * Tests the local storage driver on temporary folders: saving the processed image and
 * its original, reading them back, deleting both, and that a URL can never point
 * outside the uploads folder. No server, no database, no network.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLocalDriver } = require('../server/services/storage/local.driver');

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

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-storage-uploads-'));
const originalsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-storage-originals-'));
const driver = createLocalDriver({ uploadsDir, originalsDir });

async function main() {
  console.log('\n── כתובות');
  check('"/uploads/x.webp" שייך למנהל המקומי', driver.owns('/uploads/x.webp') === true);
  check('כתובת https אינה שלו', driver.owns('https://res.cloudinary.com/c/image/upload/products/x.webp') === false);
  check('ערך שאינו טקסט אינו שלו', driver.owns(null) === false && driver.owns(undefined) === false);

  console.log('\n── שמירה וקריאה');
  const processed = Buffer.from('processed-webp-bytes');
  const url = await driver.saveProcessed('0b99d097208f5e91.webp', processed);
  check('מחזיר את הכתובת הציבורית', url === '/uploads/0b99d097208f5e91.webp', url);
  check('הקובץ נכתב בתיקיית ההעלאות', fs.readFileSync(path.join(uploadsDir, '0b99d097208f5e91.webp')).equals(processed));
  check('נקרא בחזרה לפי הכתובת', (await driver.readProcessed(url)).equals(processed));

  const again = await driver.saveProcessed('0b99d097208f5e91.webp', Buffer.from('different'));
  check('אותו שם שוב — אותה כתובת', again === url, again);
  check('ולא נדרס', fs.readFileSync(path.join(uploadsDir, '0b99d097208f5e91.webp')).equals(processed));
  check('קובץ שאינו קיים → null', (await driver.readProcessed('/uploads/missing.webp')) === null);

  const original = Buffer.from('phone-photo-bytes');
  await driver.saveOriginal('0b99d097208f5e91.webp', original, '.jpg');
  const read = await driver.readOriginal(url);
  check('המקור נשמר ונקרא עם הסיומת שלו', read && read.buffer.equals(original) && read.ext === '.jpg', read && read.ext);
  check('המקור אינו בתיקיית ההעלאות המוגשת', !fs.readdirSync(uploadsDir).some((f) => f.endsWith('.jpg')), fs.readdirSync(uploadsDir));
  check('אין מקור → null', (await driver.readOriginal('/uploads/ffffffffffffffff.webp')) === null);

  console.log('\n── מחיקה');
  check('מחיקה מחזירה true', (await driver.remove(url)) === true);
  check('הקובץ המעובד נמחק', !fs.existsSync(path.join(uploadsDir, '0b99d097208f5e91.webp')));
  check('והמקור נמחק', (await driver.readOriginal(url)) === null);
  check('מחיקה חוזרת אינה שגיאה', (await driver.remove(url)) === true);

  console.log('\n── נתיב לא יוצא מהתיקייה');
  const outside = path.join(path.dirname(uploadsDir), 'outside-secret.txt');
  fs.writeFileSync(outside, 'keep me');
  await driver.remove(`/uploads/../${path.basename(outside)}`);
  check('/uploads/../קובץ אינו מוחק קובץ מחוץ לתיקייה', fs.existsSync(outside));
  check('וגם אינו נקרא', (await driver.readProcessed(`/uploads/../${path.basename(outside)}`)) === null);
  fs.rmSync(outside, { force: true });
}

main()
  .catch((err) => {
    failed++;
    console.log(`  ✗ הבדיקה קרסה — ${err.stack}`);
  })
  .finally(() => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.rmSync(originalsDir, { recursive: true, force: true });
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
