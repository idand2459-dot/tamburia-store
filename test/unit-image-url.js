/**
 * Tests the image address rules in server/validators/product.validator.js: an address is
 * empty, a local "/uploads/<name>" path, or an https URL (Cloudinary). Anything else is a 400,
 * for the main image and for every entry of the gallery.
 */
const { parseCreate, parseUpdate } = require('../server/validators/product.validator');

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

/** Runs a parse and returns the result or { status, message } of the error it threw. */
function attempt(parse, body) {
  try {
    return { data: parse(body) };
  } catch (err) {
    return { status: err.status, message: err.message };
  }
}

const CLOUD_URL = 'https://res.cloudinary.com/fake-cloud/image/upload/products/0b99d097208f5e91.webp';

console.log('\n── image_url');
check('ריק מתקבל', attempt(parseUpdate, { image_url: '' }).data.image_url === '');
check('בלי ערך → ריק', attempt(parseCreate, { name: 'x', price: 0 }).data.image_url === '');
check('/uploads/<שם> מתקבל', attempt(parseUpdate, { image_url: '/uploads/0b99d097208f5e91.webp' }).data.image_url === '/uploads/0b99d097208f5e91.webp');
check('כתובת Cloudinary (https) מתקבלת', attempt(parseUpdate, { image_url: CLOUD_URL }).data.image_url === CLOUD_URL);
check('רווחים נחתכים', attempt(parseUpdate, { image_url: `  ${CLOUD_URL}  ` }).data.image_url === CLOUD_URL);

for (const bad of ['javascript:alert(1)', 'http://example.com/x.webp', '//example.com/x.webp', 'x.webp', '/uploads/../server.js', '/uploads/a\\b.webp', 'https://']) {
  const out = attempt(parseUpdate, { image_url: bad });
  check(`"${bad}" → 400`, out.status === 400, out);
}

check('לא טקסט → 400', attempt(parseUpdate, { image_url: 12 }).status === 400);
check('ארוך מ-500 תווים → 400', attempt(parseUpdate, { image_url: `https://example.com/${'a'.repeat(500)}` }).status === 400);

console.log('\n── images');
const mixed = attempt(parseUpdate, { images: ['/uploads/a.webp', CLOUD_URL, '', '  '] });
check('גלריה מעורבת מתקבלת, בלי ערכים ריקים', JSON.stringify(mixed.data && mixed.data.images) === JSON.stringify(['/uploads/a.webp', CLOUD_URL]), mixed);
const badGallery = attempt(parseUpdate, { images: ['/uploads/a.webp', 'javascript:alert(1)'] });
check('פריט אחד לא תקין בגלריה → 400 עם המיקום שלו', badGallery.status === 400 && badGallery.message.includes('images[1]'), badGallery);
check('לא מערך → ריק', JSON.stringify(attempt(parseUpdate, { images: 'x' }).data.images) === '[]');

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
