/**
 * Tests the reprocessing of already-uploaded images (scripts/images-products.js,
 * --from-uploads) with a fake storage module, a fake database and a fake background
 * remover: no network, no ML model, and nothing written to photos/ or uploads/.
 *
 * It pins the two paths: a local image is read from its file exactly as before, and a
 * remote (Cloudinary) image is read through the storage module, from the original when
 * the storage kept one, and written back through the storage module on --apply.
 */
const fs = require('fs');
const os = require('os');
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

const CLOUD = 'https://res.cloudinary.test/image/upload/products';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tamburia-reprocess-'));
const uploadsDir = path.join(tmp, 'uploads');
const outDir = path.join(tmp, 'out');
fs.mkdirSync(uploadsDir, { recursive: true });

/** Puts a fake module in the require cache. */
function stub(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

/** A solid-colour PNG, optionally a white square with a dark block in the middle (a finished image). */
const photo = (width, height, color) => sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
const finished = () => sharp({ create: { width: 120, height: 120, channels: 3, background: '#ffffff' } })
  .composite([{ input: { create: { width: 40, height: 40, channels: 3, background: '#223344' } }, left: 40, top: 40 }])
  .png().toBuffer();

/* ── The fakes ─────────────────────────────────────────────── */

const products = new Map();
const remote = new Map(); // url -> { processed, original, mtimeMs }
const saved = [];
const cutoutInputs = [];

stub('../server/config/db', {
  async query() { return { rows: [...products.values()].map((p) => ({ ...p })) }; },
  async close() {},
});
stub('../server/models/product.model', {
  async findById(id) { return products.has(id) ? { ...products.get(id), images: [...products.get(id).images] } : null; },
  async update(id, fields) { Object.assign(products.get(id), fields); },
  async findUnreferencedImages(urls) {
    const used = new Set([...products.values()].flatMap((p) => [p.image_url, ...p.images]));
    return urls.filter((url) => !used.has(url));
  },
});
stub('../server/services/storage', {
  UPLOADS_DIR: uploadsDir,
  isManaged: (url) => typeof url === 'string' && (url.startsWith('/uploads/') || url.startsWith(`${CLOUD}/`)),
  async statProcessed(url) { return remote.has(url) ? { mtimeMs: remote.get(url).mtimeMs } : null; },
  async readProcessed(url) { return remote.has(url) ? remote.get(url).processed : null; },
  async readOriginal(url) { const r = remote.get(url); return r && r.original ? { buffer: r.original, ext: '.jpg' } : null; },
  async saveProcessed(name, buffer) {
    saved.push({ name, bytes: buffer.length });
    return `${CLOUD}/${name}`;
  },
});
stub('../scripts/lib/cutout', {
  async cutout(inPath, outPath) {
    const { width, height } = await sharp(inPath).metadata();
    cutoutInputs.push({ width, height });
    const block = await sharp({ create: { width: Math.round(width / 2), height: Math.round(height / 2), channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: block, left: Math.round(width / 4), top: Math.round(height / 4) }])
      .png().toFile(outPath);
  },
  stop() {},
});

const {
  collectUploadJobs, runUploadsProcessing, applyFromUploads,
} = require('../scripts/images-products');

const quiet = (fn) => async (...args) => {
  const log = console.log;
  console.log = () => {};
  try { return await fn(...args); } finally { console.log = log; }
};

async function main() {
  /* A local file, and remote images: with an original, processed only, finished, and gone. */
  fs.writeFileSync(path.join(uploadsDir, 'local.png'), await photo(300, 200, '#a33'));
  remote.set(`${CLOUD}/withorig.webp`, { processed: await photo(120, 180, '#33a'), original: await photo(400, 600, '#33a'), mtimeMs: Date.parse('2026-10-10') });
  remote.set(`${CLOUD}/plain.webp`, { processed: await photo(150, 100, '#3a3'), original: null, mtimeMs: Date.parse('2026-10-20') });
  remote.set(`${CLOUD}/done.webp`, { processed: await finished(), original: null, mtimeMs: Date.parse('2026-10-20') });

  products.set(1, {
    id: 1, name: 'מוצר מקומי', category: 'tools', image_url: '/uploads/local.png',
    images: [`${CLOUD}/withorig.webp`, `${CLOUD}/gone.webp`, 'https://elsewhere.example/x.jpg'],
  });
  products.set(2, {
    id: 2, name: 'מוצר בענן', category: 'tools', image_url: `${CLOUD}/plain.webp`, images: [`${CLOUD}/done.webp`],
  });

  console.log('\n── איסוף');
  const { jobs, missing, products: count } = await collectUploadJobs({});
  check('נאספות תמונות מקומיות ומרוחקות של המוצרים', jobs.length === 4 && count === 2, jobs.map((j) => j.url));
  check('מקומית: קובץ, בלי remote', jobs[0].file && jobs[0].remote !== true, jobs[0]);
  check('מרוחקת: בלי קובץ, עם remote', jobs[1].file === null && jobs[1].remote === true, jobs[1]);
  check('כתובת שאינה באחסון ושאינה מקומית — מתעלמים', !jobs.some((j) => j.url.includes('elsewhere')) && !missing.some((m) => m.url.includes('elsewhere')));
  check('כתובת מרוחקת שאין לה תמונה — ברשימת החסרים', missing.length === 1 && missing[0].url === `${CLOUD}/gone.webp`, missing);

  const since = await collectUploadJobs({ since: new Date('2026-10-15') });
  check('--since חל גם על תמונה מרוחקת (לפי זמן היצירה)',
    !since.jobs.some((j) => j.url.endsWith('withorig.webp')) && since.jobs.some((j) => j.url.endsWith('plain.webp')), since.jobs.map((j) => j.url));

  console.log('\n── עיבוד');
  const run = await quiet(runUploadsProcessing)(jobs, { outDir });
  const by = (suffix) => run.entries.find((e) => e.url.endsWith(suffix));

  const withOriginal = by('withorig.webp');
  check('מרוחקת עם מקור — מעובדת מהמקור', withOriginal.fromOriginal === true && withOriginal.sourceWidth === 400 && withOriginal.sourceHeight === 600, [withOriginal.fromOriginal, withOriginal.sourceWidth]);
  check('הפלט נכתב לתיקיית היעד', fs.existsSync(path.join(outDir, '1-2.webp')), fs.readdirSync(outDir));

  const plain = by('plain.webp');
  check('מרוחקת בלי מקור — מעובדת מהקובץ המעובד', plain.fromOriginal === false && plain.sourceWidth === 150, [plain.fromOriginal, plain.sourceWidth]);

  const done = by('done.webp');
  check('מרוחקת שכבר על לבן — לא נוגעים', done.alreadyDone === true && !done.output, done);

  const local = by('local.png');
  check('מקומית — נקראת מהקובץ, כמו קודם', local.fromOriginal === false && local.sourceWidth === 300 && !local.error, local);
  check('הסרת הרקע רצה על שלוש תמונות בלבד (לא על זו שכבר על לבן)', cutoutInputs.length === 3, cutoutInputs);

  // an image that disappears between collecting and processing is an error entry, not a crash
  const ghost = { ...jobs[1], id: 9, url: `${CLOUD}/vanished.webp`, index: 1 };
  const failedRun = await quiet(runUploadsProcessing)([ghost], { outDir });
  check('תמונה שנעלמה מהאחסון — רשומת שגיאה, בלי קריסה', failedRun.entries[0].error && failedRun.counts.failed === 1, failedRun.entries[0]);

  console.log('\n── חיבור (--apply)');
  const applied = await quiet(applyFromUploads)(run.entries, { includeFlagged: true });
  try {
    check('נכתבות תמונות חדשות דרך האחסון, בשם product-<id>-<hash>', saved.length === 3 && saved.every((s) => /^product-[12](-\d)?-[0-9a-f]{8}\.webp$/.test(s.name)), saved.map((s) => s.name));
    check('הכתובות במסד הוחלפו בכתובות שהאחסון החזיר',
      products.get(1).image_url.startsWith(`${CLOUD}/product-1-`) && products.get(2).image_url.startsWith(`${CLOUD}/product-2-`), [products.get(1).image_url, products.get(2).image_url]);
    check('מקום התמונה בגלריה נשמר, ותמונה שלא עובדה נשארת', products.get(1).images[0].startsWith(`${CLOUD}/product-1-2-`)
      && products.get(1).images[1] === `${CLOUD}/gone.webp` && products.get(2).images[0] === `${CLOUD}/done.webp`, products.get(1).images);
    check('מוצרים עודכנו: 2', applied.updated === 2, applied.updated);
    check('נכתב גיבוי לפני השינוי', applied.backupPath && fs.existsSync(applied.backupPath));
    const backup = JSON.parse(fs.readFileSync(applied.backupPath, 'utf8'));
    check('הגיבוי מחזיק את הכתובות הישנות', backup.rows.find((r) => r.id === 1).image_url === '/uploads/local.png', backup.rows);
  } finally {
    if (applied.backupPath) fs.rmSync(applied.backupPath, { force: true });
  }

  console.log('\n── תמונה שהוחלפה באדמין בינתיים');
  products.get(2).image_url = `${CLOUD}/replaced-by-admin.webp`;
  const before = saved.length;
  const entry = { ...plain, output: path.relative(path.join(__dirname, '..'), path.join(outDir, '2.webp')), flags: [] };
  const again = await quiet(applyFromUploads)([entry], {});
  try {
    check('לא נוגעים בתמונה שכבר אינה מה שעובד', again.updated === 0 && again.changedMeanwhile.length === 1 && saved.length === before, again);
  } finally {
    if (again.backupPath) fs.rmSync(again.backupPath, { force: true });
  }
}

main()
  .catch((err) => {
    failed++;
    console.log(`  ✗ הבדיקה קרסה — ${err.stack}`);
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
    process.exit(failed === 0 ? 0 : 1);
  });
