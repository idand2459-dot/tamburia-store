/**
 * Tests the Cloudinary storage driver with a fake SDK and a fake fetch: no network and
 * no account. It pins what is sent (public assets for processed images, private assets
 * for originals, idempotent uploads), which URLs the driver owns, how originals are read
 * back through a short-lived signed URL, and that nothing prints the API secret.
 */
const {
  createCloudinaryDriver, parseCloudinaryUrl, PUBLIC_FOLDER, ORIGINALS_FOLDER,
} = require('../server/services/storage/cloudinary.driver');

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

const CLOUD = 'fake-cloud';
const FAKE_URL = 'cloudinary://fake-key-123:fake-secret-456@fake-cloud';

/** A fake Cloudinary SDK that records every call. */
function fakeSdk({ resource = { format: 'jpg' }, resourceError = null, uploadError = null } = {}) {
  const calls = { uploads: [], destroys: [], resources: [], signed: [] };
  return {
    calls,
    uploader: {
      upload_stream(options, callback) {
        return {
          end(buffer) {
            calls.uploads.push({ options, buffer });
            if (uploadError) callback(uploadError);
            else callback(null, { public_id: options.public_id });
          },
        };
      },
      async destroy(publicId, options) {
        calls.destroys.push({ publicId, options });
        return { result: 'ok' };
      },
    },
    api: {
      async resource(publicId, options) {
        calls.resources.push({ publicId, options });
        if (resourceError) throw resourceError;
        return resource;
      },
    },
    utils: {
      private_download_url(publicId, format, options) {
        calls.signed.push({ publicId, format, options });
        return `https://api.example.test/signed/${publicId}.${format}`;
      },
    },
  };
}

/** A fake fetch that answers from a table of URL -> { status, body }. */
function fakeFetch(table) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    const hit = table[url];
    if (!hit) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = Buffer.from(hit.body || '');
    return {
      ok: hit.status === 200,
      status: hit.status,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    };
  };
  impl.seen = seen;
  return impl;
}

async function main() {
  console.log('\n── CLOUDINARY_URL');
  const settings = parseCloudinaryUrl(FAKE_URL);
  check('מפוענח לשם ענן, מפתח וסוד',
    settings.cloud_name === CLOUD && settings.api_key === 'fake-key-123' && settings.api_secret === 'fake-secret-456' && settings.secure === true, settings);

  for (const [name, raw] of [['לא כתובת', 'not a url, fake-secret-456'], ['סכמה אחרת', 'https://k:s@cloud'], ['בלי סוד', 'cloudinary://fake-key-123@fake-cloud']]) {
    let message = '';
    try { parseCloudinaryUrl(raw); } catch (err) { message = err.message; }
    check(`${name} — נדחה בלי להדפיס את הערך`, message.includes('CLOUDINARY_URL') && !message.includes('fake-secret-456'), message);
  }

  console.log('\n── העלאת תמונה מעובדת');
  const sdk = fakeSdk();
  const driver = createCloudinaryDriver({ sdk, cloudName: CLOUD, fetchImpl: fakeFetch({}) });
  const url = await driver.saveProcessed('0b99d097208f5e91.webp', Buffer.from('webp-bytes'));
  const up = sdk.calls.uploads[0];
  check('כתובת ציבורית של הענן, בתיקיית המוצרים',
    url === `https://res.cloudinary.com/${CLOUD}/image/upload/${PUBLIC_FOLDER}/0b99d097208f5e91.webp`, url);
  check('נכס ציבורי (type upload), לפי בסיס השם', up.options.type === 'upload' && up.options.public_id === `${PUBLIC_FOLDER}/0b99d097208f5e91`, up.options);
  check('overwrite: false — העלאה חוזרת של אותו תוכן אינה דורסת', up.options.overwrite === false, up.options.overwrite);
  check('הבייטים שנשלחו הם המעובדים', up.buffer.equals(Buffer.from('webp-bytes')));

  const named = await driver.saveProcessed('product-218-a3f9c1b2.webp', Buffer.from('x'));
  check('שם של סקריפט (product-<id>-<hash>) מתקבל', named.endsWith('/products/product-218-a3f9c1b2.webp'), named);

  let unsafe = '';
  try { await driver.saveProcessed('../evil name.webp', Buffer.from('x')); } catch (err) { unsafe = err.message; }
  check('שם לא בטוח נדחה לפני הקריאה ל-API', unsafe.includes('unsafe') && sdk.calls.uploads.length === 2, unsafe);

  console.log('\n── העלאת מקור');
  await driver.saveOriginal('0b99d097208f5e91.webp', Buffer.from('jpeg-bytes'), '.jpg');
  const original = sdk.calls.uploads[2];
  check('נכס פרטי (type private) בתיקיית המקורות', original.options.type === 'private' && original.options.public_id === `${ORIGINALS_FOLDER}/0b99d097208f5e91`, original.options);
  check('גם הוא לא נדרס', original.options.overwrite === false);

  console.log('\n── כתובות');
  const base = `https://res.cloudinary.com/${CLOUD}/image/upload`;
  check('כתובת של הענן — שלו', driver.owns(`${base}/${PUBLIC_FOLDER}/abc.webp`) === true);
  check('עם מקטע גרסה — שלו', driver.owns(`${base}/v1700000000/${PUBLIC_FOLDER}/abc.webp`) === true);
  check('עם query — שלו', driver.owns(`${base}/${PUBLIC_FOLDER}/abc.webp?x=1`) === true);
  check('ענן אחר — לא שלו', driver.owns('https://res.cloudinary.com/other-cloud/image/upload/products/abc.webp') === false);
  check('תיקייה אחרת (המקורות) — לא שלו', driver.owns(`${base}/${ORIGINALS_FOLDER}/abc.jpg`) === false);
  check('כתובת מקומית — לא שלו', driver.owns('/uploads/abc.webp') === false);
  check('http בלי s — לא שלו', driver.owns(`http://res.cloudinary.com/${CLOUD}/image/upload/products/abc.webp`) === false);
  check('ערך שאינו טקסט — לא שלו', driver.owns(null) === false);

  console.log('\n── קריאה');
  const fetched = fakeFetch({
    [`${base}/${PUBLIC_FOLDER}/abc.webp`]: { status: 200, body: 'public-bytes' },
    [`https://api.example.test/signed/${ORIGINALS_FOLDER}/abc.jpg`]: { status: 200, body: 'original-bytes' },
  });
  const readSdk = fakeSdk({ resource: { format: 'jpg' } });
  const reader = createCloudinaryDriver({ sdk: readSdk, cloudName: CLOUD, fetchImpl: fetched });

  const processed = await reader.readProcessed(`${base}/${PUBLIC_FOLDER}/abc.webp`);
  check('התמונה הציבורית נקראת מהכתובת', processed && processed.equals(Buffer.from('public-bytes')), processed);
  check('כתובת זרה לא נקראת בכלל', (await reader.readProcessed('https://example.com/x.webp')) === null && !fetched.seen.includes('https://example.com/x.webp'));

  const before = Math.floor(Date.now() / 1000);
  const got = await reader.readOriginal(`${base}/${PUBLIC_FOLDER}/abc.webp`);
  const signed = readSdk.calls.signed[0];
  check('המקור נקרא דרך כתובת חתומה, עם הסיומת שלו', got && got.buffer.equals(Buffer.from('original-bytes')) && got.ext === '.jpg', got && got.ext);
  check('הכתובת החתומה לנכס פרטי', signed.options.type === 'private' && signed.publicId === `${ORIGINALS_FOLDER}/abc` && signed.format === 'jpg', signed);
  check('והיא קצרת חיים (עד 5 דקות)', signed.options.expires_at > before && signed.options.expires_at <= before + 301, signed.options.expires_at - before);

  const noOriginal = createCloudinaryDriver({
    sdk: fakeSdk({ resourceError: { http_code: 404 } }), cloudName: CLOUD, fetchImpl: fakeFetch({}),
  });
  check('אין מקור (404 מה-API) → null', (await noOriginal.readOriginal(`${base}/${PUBLIC_FOLDER}/abc.webp`)) === null);

  const broken = createCloudinaryDriver({
    sdk: fakeSdk({ resourceError: { http_code: 500, message: 'boom' } }), cloudName: CLOUD, fetchImpl: fakeFetch({}),
  });
  let rejected = false;
  try { await broken.readOriginal(`${base}/${PUBLIC_FOLDER}/abc.webp`); } catch { rejected = true; }
  check('שגיאה אחרת מהשירות לא נבלעת', rejected);

  const statSdk = fakeSdk({ resource: { format: 'webp', created_at: '2026-10-10T08:00:00Z' } });
  const statDriver = createCloudinaryDriver({ sdk: statSdk, cloudName: CLOUD, fetchImpl: fakeFetch({}) });
  const stat = await statDriver.statProcessed(`${base}/${PUBLIC_FOLDER}/abc.webp`);
  check('זמן היצירה של הנכס הציבורי (קריאת API אחת)', stat && stat.mtimeMs === Date.parse('2026-10-10T08:00:00Z') && statSdk.calls.resources.length === 1, stat);
  check('הקריאה היא לנכס הציבורי, לא למקור', statSdk.calls.resources[0].publicId === `${PUBLIC_FOLDER}/abc` && statSdk.calls.resources[0].options.type === 'upload', statSdk.calls.resources[0]);
  const missingStat = createCloudinaryDriver({ sdk: fakeSdk({ resourceError: { http_code: 404 } }), cloudName: CLOUD, fetchImpl: fakeFetch({}) });
  check('נכס שאינו קיים → null', (await missingStat.statProcessed(`${base}/${PUBLIC_FOLDER}/abc.webp`)) === null);
  check('כתובת זרה → null בלי קריאה ל-API', (await statDriver.statProcessed('/uploads/abc.webp')) === null && statSdk.calls.resources.length === 1);

  console.log('\n── מחיקה');
  const delSdk = fakeSdk();
  const deleter = createCloudinaryDriver({ sdk: delSdk, cloudName: CLOUD, fetchImpl: fakeFetch({}) });
  const removed = await deleter.remove(`${base}/${PUBLIC_FOLDER}/abc.webp`);
  const [pub, priv] = delSdk.calls.destroys;
  check('נמחקים הנכס הציבורי והמקור הפרטי', removed === true && pub.publicId === `${PUBLIC_FOLDER}/abc` && priv.publicId === `${ORIGINALS_FOLDER}/abc`, delSdk.calls.destroys);
  check('כל אחד לפי הסוג שלו', pub.options.type === 'upload' && priv.options.type === 'private', [pub.options, priv.options]);
  check('הציבורי נמחק גם מה-CDN (invalidate)', pub.options.invalidate === true);
  check('כתובת זרה → false, ובלי קריאה ל-API', (await deleter.remove('/uploads/abc.webp')) === false && delSdk.calls.destroys.length === 2);

  console.log('\n── כשל בהעלאה');
  const failing = createCloudinaryDriver({ sdk: fakeSdk({ uploadError: new Error('quota') }), cloudName: CLOUD, fetchImpl: fakeFetch({}) });
  let error = '';
  try { await failing.saveProcessed('abc.webp', Buffer.from('x')); } catch (err) { error = err.message; }
  check('שגיאת העלאה מגיעה לקורא (ההעלאה נכשלת)', error === 'quota', error);
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
