/**
 * בדיקת עשן זמנית להגשת הקליינט ולכותרות האבטחה.
 * למחיקה אחרי שה-cutover יתייצב.
 *
 *   NEW_URL=http://127.0.0.1:3100 node server/db/smoke-static.js
 */
const BASE = process.env.NEW_URL || 'http://127.0.0.1:3100';

let passed = 0;
let failed = 0;

function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

const isClientHtml = (text) => text.includes('<div id="root">');

async function testClient() {
  console.log('\n── הגשת הקליינט');

  const root = await get('/');
  check('/ מחזיר 200', root.status === 200, root.status);
  check('/ מגיש את אפליקציית React', isClientHtml(root.text), root.text.slice(0, 80));
  check('/ אינו אב-הטיפוס הישן', !root.text.includes('טמבוריה סטור'), null);
  check('index.html לא נשמר במטמון',
    /no-store/.test(root.headers.get('cache-control') || ''), root.headers.get('cache-control'));

  const admin = await get('/admin');
  check('/admin מקבל את index.html (SPA fallback)',
    admin.status === 200 && isClientHtml(admin.text), admin.status);

  // שם הקובץ מכיל hash, ולכן נמשך מתוך ה-HTML
  const asset = root.text.match(/\/static\/js\/main\.[a-z0-9]+\.js/)?.[0];
  check('נמצא נכס JS ב-HTML', Boolean(asset), asset);

  const js = await get(asset);
  check('נכס JS מוגש', js.status === 200 && js.text.length > 1000, js.status);
  check('נכס עם hash נשמר במטמון לאורך זמן',
    /immutable/.test(js.headers.get('cache-control') || ''), js.headers.get('cache-control'));

  const css = root.text.match(/\/static\/css\/main\.[a-z0-9]+\.css/)?.[0];
  check('נכס CSS מוגש', (await get(css)).status === 200, css);

  const favicon = await get('/favicon.ico');
  check('favicon מוגש', favicon.status === 200, favicon.status);
}

async function testNothingLeaks() {
  console.log('\n── מה שאסור להיחשף');

  // ה-fallback מחזיר index.html לכל GET לא מוכר. מה שחשוב הוא
  // שתוכן הקובץ עצמו לא יחזור — לא שהסטטוס יהיה 404.
  const secrets = [
    ['/server.js', 'require('],
    ['/package.json', '"dependencies"'],
    ['/package-lock.json', '"lockfileVersion"'],
    ['/.env', 'DB_PASSWORD'],
    ['/import_products.js', 'INSERT INTO'],
    ['/products_import_template.csv', ','],
    ['/legacy/index.html', 'טמבוריה סטור'],
    ['/legacy/script.js', 'cartCount'],
    ['/style.css', 'products-grid'],
    ['/server/config/db.js', 'Pool'],
    ['/.git/config', '[core]'],
  ];

  for (const [path, fingerprint] of secrets) {
    const res = await get(path);
    const leaked = res.text.includes(fingerprint) && !isClientHtml(res.text);
    check(`${path} אינו נחשף`, !leaked, `${res.status} ${res.text.slice(0, 60)}`);
  }
}

async function testApi() {
  console.log('\n── ה-API לא נפגע מה-fallback');

  const products = await get('/api/products');
  check('/api/products עדיין JSON',
    products.status === 200 && Array.isArray(JSON.parse(products.text)), products.status);

  const ghost = await get('/api/no-such-endpoint');
  const body = JSON.parse(ghost.text);
  check('נתיב API לא מוכר → 404 JSON ולא HTML',
    ghost.status === 404 && body.error === 'הנתיב לא נמצא', `${ghost.status} ${ghost.text.slice(0, 60)}`);

  const ghostSub = await get('/api/products/999999');
  check('משאב שאינו קיים → 404 JSON', ghostSub.status === 404, ghostSub.status);

  const health = await get('/api/health');
  check('/api/health עובד', health.status === 200, health.status);

  // POST לנתיב לא מוכר לא נתפס ע"י ה-fallback, שמוגבל ל-GET
  const post = await fetch(BASE + '/no-such-page', { method: 'POST' });
  check('POST לנתיב לא מוכר → 404 ולא index.html', post.status === 404, post.status);
}

async function testHeaders() {
  console.log('\n── כותרות אבטחה');

  const res = await get('/');
  const header = (name) => res.headers.get(name);

  check('X-Content-Type-Options: nosniff', header('x-content-type-options') === 'nosniff', header('x-content-type-options'));
  check('X-Frame-Options: DENY', header('x-frame-options') === 'DENY', header('x-frame-options'));
  check('Referrer-Policy מוגדר', Boolean(header('referrer-policy')), header('referrer-policy'));
  check('Permissions-Policy מוגדר', Boolean(header('permissions-policy')), header('permissions-policy'));
  check('X-Powered-By לא נשלח', header('x-powered-by') === null, header('x-powered-by'));
  check('HSTS לא נשלח בפיתוח', header('strict-transport-security') === null, header('strict-transport-security'));

  const api = await get('/api/products');
  check('הכותרות חלות גם על ה-API', api.headers.get('x-content-type-options') === 'nosniff', null);
}

async function testUploads() {
  console.log('\n── תמונות');

  const res = await get('/api/products');
  const uploaded = JSON.parse(res.text)
    .flatMap((p) => [p.image_url, ...(p.images || [])])
    .find((url) => typeof url === 'string' && url.startsWith('/uploads/'));

  if (!uploaded) {
    console.log('  — אין תמונה מועלית לבדוק, מדלג');
    return;
  }
  const image = await get(uploaded);
  check(`תמונה מוגשת (${uploaded})`, image.status === 200, image.status);

  const listing = await get('/uploads/');
  check('אין דפדוף בתיקיית התמונות', !listing.text.includes('Index of'), listing.status);
}

async function main() {
  await testClient();
  await testNothingLeaks();
  await testApi();
  await testHeaders();
  await testUploads();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
