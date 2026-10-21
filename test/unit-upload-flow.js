/**
 * Tests the upload middleware's flow with a fake storage module: the processed image is
 * saved first and its URL is what the client gets, the original is saved after and its
 * failure never fails the upload, a processed-save failure stops everything, a file that
 * is not an image never reaches storage, and each buffer is released after use.
 */
const path = require('path');
const sharp = require('sharp');

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

/** The storage module's place in the require cache, taken by a recording fake. */
const storagePath = require.resolve('../server/services/storage');
const calls = [];
const behaviour = { processedError: null, originalError: null };
require.cache[storagePath] = {
  id: storagePath,
  filename: storagePath,
  loaded: true,
  exports: {
    UPLOADS_DIR: path.join(__dirname, 'unused'),
    async saveProcessed(name) {
      calls.push(['processed', name]);
      if (behaviour.processedError) throw behaviour.processedError;
      return `https://fake.example/products/${name}`;
    },
    async saveOriginal(name, buffer, ext) {
      calls.push(['original', name, ext, buffer.length > 0]);
      if (behaviour.originalError) throw behaviour.originalError;
    },
  },
};

const { processUploads } = require('../server/middleware/upload');

/** A small real PNG, so the image pipeline has something to process. */
function png(color) {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: color } }).png().toBuffer();
}

/** Calls the middleware the way Express does; resolves with what it passed to next(). */
async function run(files) {
  const req = { files };
  let nextArg;
  let nextCalled = false;
  try {
    await processUploads(req, {}, (arg) => { nextCalled = true; nextArg = arg; });
  } catch (err) {
    return { req, error: err, nextCalled };
  }
  return { req, nextArg, nextCalled };
}

async function main() {
  console.log('\n── העלאה תקינה');
  calls.length = 0;
  const first = { originalname: 'IMG_1.JPG', mimetype: 'image/jpeg', buffer: await png('#c33') };
  const second = { originalname: 'IMG_2.png', mimetype: 'image/png', buffer: await png('#33c') };
  const ok = await run([first, second]);
  check('next() נקרא בלי שגיאה', ok.nextCalled && ok.nextArg === undefined, ok.nextArg);
  check('לכל קובץ יש כתובת מהאחסון', first.url.startsWith('https://fake.example/products/') && second.url.startsWith('https://fake.example/products/'), [first.url, second.url]);
  check('השם נגזר מהתוכן המעובד (WebP)', /^[0-9a-f]{16}\.webp$/.test(first.filename), first.filename);
  check('הסדר: מעובד ואז מקור, קובץ אחרי קובץ',
    JSON.stringify(calls.map((c) => c[0])) === JSON.stringify(['processed', 'original', 'processed', 'original']), calls.map((c) => c[0]));
  check('המקור נשמר עם הסיומת שלו', calls[1][2] === '.jpg' && calls[3][2] === '.png', [calls[1][2], calls[3][2]]);
  check('המקור נשלח עם תוכן', calls[1][3] === true);
  check('הבאפר משוחרר אחרי השימוש', first.buffer === null && second.buffer === null);

  console.log('\n── כשל בשמירת המקור');
  calls.length = 0;
  behaviour.originalError = new Error('private upload refused');
  const quiet = console.error;
  console.error = () => {};
  const soft = { originalname: 'a.png', mimetype: 'image/png', buffer: await png('#3c3') };
  const softRun = await run([soft]);
  console.error = quiet;
  check('ההעלאה לא נכשלת', softRun.nextCalled && softRun.nextArg === undefined && !softRun.error, softRun.error && softRun.error.message);
  check('והכתובת של התמונה המעובדת נשמרה', typeof soft.url === 'string', soft.url);
  behaviour.originalError = null;

  console.log('\n── כשל בשמירת התמונה המעובדת');
  calls.length = 0;
  behaviour.processedError = new Error('storage down');
  const hard = { originalname: 'a.png', mimetype: 'image/png', buffer: await png('#999') };
  const hardRun = await run([hard]);
  check('הבקשה נכשלת עם השגיאה', hardRun.error && hardRun.error.message === 'storage down' && !hardRun.nextCalled, hardRun.error && hardRun.error.message);
  check('המקור לא נשמר בלי תמונה מעובדת', !calls.some((c) => c[0] === 'original'), calls);
  behaviour.processedError = null;

  console.log('\n── קובץ שאינו תמונה');
  calls.length = 0;
  const junk = { originalname: 'a.png', mimetype: 'image/png', buffer: Buffer.from('this is not an image at all') };
  const junkRun = await run([junk]);
  check('נדחה ב-400', junkRun.error && junkRun.error.status === 400, junkRun.error && junkRun.error.status);
  check('ולא הגיע לאחסון', calls.length === 0, calls);
}

main()
  .catch((err) => {
    failed++;
    console.log(`  ✗ הבדיקה קרסה — ${err.stack}`);
  })
  .finally(() => {
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
