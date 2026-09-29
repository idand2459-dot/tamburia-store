/**
 * בודק את דומיין המוצרים מקצה לקצה: יצירה, קריאה, עדכון חלקי
 * ומחיקה. מנקה בסוף כל רשומה שיצר.
 *
 * הדגש כאן הוא על עדכון חלקי, כי מסך הניהול שולח כאלה: שינוי מחיר
 * בודד או היפוך המלאי נשלחים לבדם, ואסור שיאפסו וריאנטים או תמונות
 * שלא נכללו בבקשה. זה מה שמאפשר לעריכת המחיר המהירה בלשונית המוצרים
 * לשלוח רק את השדה שהשתנה.
 *
 * ועל ההסתרה, שהיא הכלל היחיד כאן שהתשובה עליו תלויה במי שואל: אותה
 * כתובת בדיוק מחזירה 404 ללקוח ו-200 לאדמין המחובר. לכן יש כאן שתי
 * דרכי פנייה — call עם העוגייה, ו-publicCall בלעדיה.
 */
const { login } = require('./helpers');
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';

let passed = 0;
let failed = 0;
const created = [];

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

let authCookie = null;

/** שולח בקשה ל-API עם עוגיית האדמין שהתקבלה בהתחברות. */
async function call(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (authCookie) headers.Cookie = authCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** שולח בקשה בלי עוגייה — מה שלקוח רגיל רואה. */
async function publicCall(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const validProduct = () => ({
  name: 'ראש מקלחת בדיקה',
  price: 120,
  category: 'bathroom',
  sku: 'TEST-SHOWER-1',
  description: 'מוצר בדיקה',
  images: ['/uploads/a.jpg', '/uploads/b.jpg'],
  colors: ['כרום', 'שחור'],
  sizes: ['קטן', 'גדול'],
});

/** בודק יצירה, ברירות מחדל ומה שנשמר כפי שנשלח. */
async function testCreate() {
  console.log('\n── יצירה');

  const plain = await call('POST', '/products', validProduct());
  created.push(plain.body.id);
  check('201 על יצירה', plain.status === 201, plain.status);
  check('עברית נשמרת', plain.body.name === 'ראש מקלחת בדיקה', plain.body.name);
  check('image_illustrative ברירת מחדל false', plain.body.image_illustrative === false, plain.body.image_illustrative);
  check('in_stock ברירת מחדל true', plain.body.in_stock === true, plain.body.in_stock);

  const illustrative = await call('POST', '/products', { ...validProduct(), sku: 'TEST-SHOWER-2', image_illustrative: true });
  created.push(illustrative.body.id);
  check('image_illustrative: true נשמר', illustrative.body.image_illustrative === true, illustrative.body.image_illustrative);

  // רק true מדליק את הדגל — מחרוזת או מספר אינם נחשבים
  const truthy = await call('POST', '/products', { ...validProduct(), sku: 'TEST-SHOWER-3', image_illustrative: 'yes' });
  created.push(truthy.body.id);
  check('ערך שאינו true → false', truthy.body.image_illustrative === false, truthy.body.image_illustrative);

  const noName = await call('POST', '/products', { ...validProduct(), name: '' });
  if (noName.status === 201) created.push(noName.body.id);
  check('בלי שם מוצר → 400', noName.status === 400, noName.status);

  return illustrative.body.id;
}

/** בודק שהשדה מוחזר גם בשליפה בודדת וגם ברשימה. */
async function testRead(id) {
  console.log('\n── קריאה');

  const one = await call('GET', `/products/${id}`);
  check('מוצר בודד', one.status === 200 && one.body.id === id, one.status);
  check('image_illustrative מוחזר בשליפה בודדת', one.body.image_illustrative === true, one.body.image_illustrative);

  const list = await call('GET', '/products?limit=500');
  const mine = list.body.products.find((p) => p.id === id);
  check('image_illustrative מוחזר ברשימה', mine && mine.image_illustrative === true, mine && mine.image_illustrative);

  const search = await call('GET', '/products?search=' + encodeURIComponent('ראש מקלחת בדיקה'));
  const rows = Array.isArray(search.body) ? search.body : search.body.products;
  check('חיפוש חופשי בעברית מוצא', rows.some((p) => p.id === id), rows.length);

  const missing = await call('GET', '/products/999999');
  check('מוצר שאינו קיים → 404', missing.status === 404, missing.status);
}

/**
 * בודק עדכון חלקי — מה שעריכת המחיר המהירה במסך הניהול שולחת.
 * בקשה עם שדה אחד בלבד לא אמורה לגעת בשאר.
 */
async function testPartialUpdate() {
  console.log('\n── עדכון חלקי');

  const withVariants = await call('POST', '/products', {
    ...validProduct(),
    sku: 'TEST-SHOWER-4',
    variants: [{ label: '1 ליטר', price: 60 }, { label: '5 ליטר', price: 250 }],
  });
  created.push(withVariants.body.id);
  const id = withVariants.body.id;
  check('מחיר המוצר הוא הזול שבוריאנטים', withVariants.body.price === 60, withVariants.body.price);

  // בדיוק מה שהעריכה המהירה שולחת: המחיר לבדו
  const priceOnly = await call('PUT', `/products/${id}`, { price: 199 });
  check('עדכון מחיר לבדו → 200', priceOnly.status === 200, priceOnly.status);
  check('המחיר התעדכן', priceOnly.body.price === 199, priceOnly.body.price);
  check('הוריאנטים שרדו עדכון מחיר',
    priceOnly.body.variants.length === 2 && priceOnly.body.variants[0].label === '1 ליטר',
    priceOnly.body.variants);
  check('התמונות שרדו עדכון מחיר',
    priceOnly.body.images.length === 2 && priceOnly.body.images[0] === '/uploads/a.jpg',
    priceOnly.body.images);
  check('הצבעים והמידות שרדו עדכון מחיר',
    priceOnly.body.colors.length === 2 && priceOnly.body.sizes.length === 2,
    { colors: priceOnly.body.colors, sizes: priceOnly.body.sizes });
  check('השם והקטגוריה לא נגעו',
    priceOnly.body.name === 'ראש מקלחת בדיקה' && priceOnly.body.category === 'bathroom',
    priceOnly.body.name);

  // אותו דבר להיפוך המלאי, שהוא מסלול העדכון החלקי הקיים
  const stockOnly = await call('PUT', `/products/${id}`, { in_stock: false });
  check('היפוך מלאי לבדו', stockOnly.body.in_stock === false, stockOnly.body.in_stock);
  check('המחיר שרד היפוך מלאי', stockOnly.body.price === 199, stockOnly.body.price);
  check('הוריאנטים שרדו היפוך מלאי', stockOnly.body.variants.length === 2, stockOnly.body.variants);

  // והדגל החדש, גם הוא לבדו
  const flagOnly = await call('PUT', `/products/${id}`, { image_illustrative: true });
  check('image_illustrative לבדו', flagOnly.body.image_illustrative === true, flagOnly.body.image_illustrative);
  check('המחיר שרד את הדגל', flagOnly.body.price === 199, flagOnly.body.price);
  check('הוריאנטים שרדו את הדגל', flagOnly.body.variants.length === 2, flagOnly.body.variants);

  const off = await call('PUT', `/products/${id}`, { image_illustrative: false });
  check('אפשר לכבות את הדגל', off.body.image_illustrative === false, off.body.image_illustrative);

  const empty = await call('PUT', `/products/${id}`, {});
  check('בקשה ריקה → 400', empty.status === 400, empty.status);

  const blankName = await call('PUT', `/products/${id}`, { name: '   ' });
  check('שם ריק בעדכון → 400', blankName.status === 400, blankName.status);

  const missing = await call('PUT', '/products/999999', { price: 10 });
  check('עדכון מוצר שאינו קיים → 404', missing.status === 404, missing.status);
}

/**
 * בודק את המרת הצבעים ואת הולידציה שלהם.
 *
 * צבע הוא { name, hex } מאז מיגרציה 008, ולפניה הוא היה שם בלבד.
 * שתי הצורות מתקבלות בכוונה: ייבוא ה-CSV שולח שמות מופרדים בפסיק,
 * וכך גם כל לקוח שנשמר ב-cache מלפני השינוי. מה שנשמר במסד הוא תמיד
 * האובייקט, וזה מה שנבדק כאן.
 */
async function testColors() {
  console.log('\n── צבעים');

  const base = { ...validProduct(), sku: 'TEST-COLORS-1' };

  // מחרוזות — הצורה הישנה
  const strings = await call('POST', '/products', { ...base, colors: ['לבן', 'אגוז'] });
  created.push(strings.body.id);
  // השוואה שדה-שדה ולא ב-JSON.stringify: jsonb מחזיר את המפתחות
  // ממוינים, והשוואה של מחרוזות היתה בודקת את הסדר הזה.
  check('מחרוזת מתקבלת ונשמרת כאובייקט',
    strings.body.colors.length === 2
      && strings.body.colors[0].name === 'לבן' && strings.body.colors[0].hex === ''
      && strings.body.colors[1].name === 'אגוז' && strings.body.colors[1].hex === '',
    strings.body.colors);

  // אובייקטים עם גוון
  const objects = await call('POST', '/products', {
    ...base, sku: 'TEST-COLORS-2',
    colors: [{ name: 'אגוז', hex: '#6B4423' }, { name: 'שקוף', hex: '' }],
  });
  created.push(objects.body.id);
  check('גוון נשמר ומנורמל לאותיות קטנות',
    objects.body.colors[0].hex === '#6b4423', objects.body.colors[0]);
  check('גוון ריק הוא מצב חוקי', objects.body.colors[1].hex === '', objects.body.colors[1]);

  // צורה מעורבת באותה רשימה
  const mixed = await call('POST', '/products', {
    ...base, sku: 'TEST-COLORS-3',
    colors: ['לבן', { name: 'פחם', hex: '#36454f' }],
  });
  created.push(mixed.body.id);
  check('מחרוזת ואובייקט באותה רשימה',
    mixed.body.colors.length === 2 && mixed.body.colors[0].hex === ''
      && mixed.body.colors[1].hex === '#36454f', mixed.body.colors);

  // שורה בלי שם נופלת ולא מפילה את הבקשה
  const empty = await call('POST', '/products', {
    ...base, sku: 'TEST-COLORS-4',
    colors: [{ name: '  ', hex: '#ffffff' }, { name: 'לבן', hex: '#ffffff' }],
  });
  created.push(empty.body.id);
  check('צבע בלי שם נזרק', empty.body.colors.length === 1, empty.body.colors);

  const bad = [
    ['גוון בלי סולמית', [{ name: 'אגוז', hex: '6b4423' }]],
    ['גוון בן שלוש ספרות', [{ name: 'לבן', hex: '#fff' }]],
    ['גוון עם תו לא חוקי', [{ name: 'לבן', hex: '#gggggg' }]],
    ['גוון ארוך מדי', [{ name: 'לבן', hex: '#ffffff00' }]],
    ['צבעים שאינם מערך', 'לבן'],
    ['פריט שאינו טקסט או אובייקט', [42]],
  ];
  for (const [name, colors] of bad) {
    const res = await call('POST', '/products', { ...base, sku: 'TEST-COLORS-BAD', colors });
    if (res.status === 201) created.push(res.body.id);
    check(`${name} → 400`, res.status === 400, `${res.status} ${res.body.error || ''}`);
  }

  // ועדכון חלקי של צבעים בלבד אינו נוגע בשאר
  const patch = await call('PUT', `/products/${objects.body.id}`, {
    colors: [{ name: 'אלון', hex: '#c89f6d' }],
  });
  check('עדכון צבעים בלבד — הצבעים התחלפו',
    patch.body.colors.length === 1 && patch.body.colors[0].name === 'אלון', patch.body.colors);
  check('עדכון צבעים בלבד — המחיר והתמונות שרדו',
    patch.body.price === 120 && patch.body.images.length === 2, patch.body);
}

/**
 * בודק את הולידציה של הגדלים.
 *
 * שני כללים חדשים: מחיר גדול מאפס, כי מחיר המוצר נגזר מהזול שבגדלים
 * וגודל ב-0 היה מוציא את כל המוצר מהמכירה; ותוויות ייחודיות, כי
 * התווית היא מה ש-pricing.service מחפש לפיה את מחיר הגודל שנבחר.
 */
async function testVariantRules() {
  console.log('\n── גדלים');

  const base = { ...validProduct(), sku: 'TEST-VARIANTS-1' };

  const ok = await call('POST', '/products', {
    ...base, variants: [{ label: '3 מטר', price: 25 }, { label: '5 מטר', price: 35 }],
  });
  created.push(ok.body.id);
  check('שני גדלים נשמרים', ok.body.variants.length === 2, ok.body.variants);
  check('מחיר המוצר הוא הזול שבהם', ok.body.price === 25, ok.body.price);

  const bad = [
    ['גודל בלי תווית', [{ label: '  ', price: 25 }]],
    ['מחיר 0', [{ label: '3 מטר', price: 0 }]],
    ['מחיר שלילי', [{ label: '3 מטר', price: -5 }]],
    ['תווית כפולה', [{ label: '3 מטר', price: 25 }, { label: '3 מטר', price: 35 }]],
  ];
  for (const [name, variants] of bad) {
    const res = await call('POST', '/products', { ...base, sku: 'TEST-VARIANTS-BAD', variants });
    if (res.status === 201) created.push(res.body.id);
    check(`${name} → 400`, res.status === 400, `${res.status} ${res.body.error || ''}`);
  }
}

/**
 * בודק את הסתרת המוצר: מה שהחנות רואה, מה שהאדמין רואה, ומה שקורה
 * להזמנה עליו.
 *
 * זו החלופה למחיקה, ולכן שתי הדרישות שלה הן שהמוצר ייעלם מהחנות
 * לגמרי ושהוא יישאר במסד לגמרי. שתיהן נבדקות כאן, וגם החזרה.
 */
async function testHidden() {
  console.log('\n── הסתרה');

  const product = (await call('POST', '/products', {
    ...validProduct(), name: 'מוצר בדיקה להסתרה', sku: 'TEST-HIDDEN-1',
  })).body;
  created.push(product.id);
  const id = product.id;

  check('מוצר חדש נוצר גלוי', product.active === true, product.active);

  const shownToPublic = await publicCall('GET', `/products/${id}`);
  check('לפני ההסתרה — הלקוח רואה אותו', shownToPublic.status === 200, shownToPublic.status);

  const hidden = await call('PUT', `/products/${id}`, { active: false });
  check('הסתרה לבדה → 200', hidden.status === 200, hidden.status);
  check('active התהפך', hidden.body.active === false, hidden.body.active);
  check('ההסתרה לא נגעה בשאר השדות',
    hidden.body.price === 120 && hidden.body.images.length === 2 && hidden.body.name === 'מוצר בדיקה להסתרה',
    hidden.body);

  const publicList = await publicCall('GET', '/products?limit=500');
  check('מוסתר אינו ברשימת החנות',
    !publicList.body.products.some((p) => p.id === id), publicList.body.pagination);

  const publicSearch = await publicCall('GET', '/products?search=' + encodeURIComponent('מוצר בדיקה להסתרה'));
  const searchRows = Array.isArray(publicSearch.body) ? publicSearch.body : publicSearch.body.products;
  check('מוסתר אינו בחיפוש של החנות', !searchRows.some((p) => p.id === id), searchRows.length);

  const publicOne = await publicCall('GET', `/products/${id}`);
  check('עמוד המוצר המוסתר → 404 ללקוח', publicOne.status === 404, publicOne.status);

  const publicIds = await publicCall('GET', `/products?ids=${id}`);
  const idRows = Array.isArray(publicIds.body) ? publicIds.body : publicIds.body.products;
  check('שליפה לפי ids מדלגת על מוסתר', idRows.length === 0, idRows);

  // אותה כתובת, עם העוגייה — וזה ההבדל כולו
  const adminOne = await call('GET', `/products/${id}`);
  check('האדמין עדיין רואה את המוצר', adminOne.status === 200 && adminOne.body.id === id, adminOne.status);

  /* לאדמין זו בקשה ולא הרשאה: בלי ?active=all הוא מקבל את אותה
     רשימה שהלקוח מקבל. בלי זה, אדמין עם חיבור פתוח שגולש בחנות היה
     רואה בה מוצרים שהוא בעצמו הסתיר. */
  const adminDefault = await call('GET', '/products?limit=500');
  check('בלי active=all גם האדמין לא רואה מוסתר ברשימה',
    !adminDefault.body.products.some((p) => p.id === id), adminDefault.body.pagination);

  const adminAll = await call('GET', '/products?limit=500&active=all');
  check('עם active=all האדמין רואה אותו',
    adminAll.body.products.some((p) => p.id === id), adminAll.body.pagination);

  const adminHidden = await call('GET', '/products?limit=500&active=false');
  check('active=false מחזיר מוסתרים בלבד',
    adminHidden.body.products.length > 0 && adminHidden.body.products.every((p) => p.active === false),
    adminHidden.body.pagination);

  // ולמי שאינו מחובר, אותו פרמטר בדיוק לא משנה דבר
  const publicAll = await publicCall('GET', '/products?limit=500&active=all');
  check('active=all מלקוח אינו חושף מוסתרים',
    !publicAll.body.products.some((p) => p.id === id), publicAll.body.pagination);

  const publicHiddenOnly = await publicCall('GET', '/products?limit=500&active=false');
  check('active=false מלקוח אינו חושף מוסתרים',
    !publicHiddenOnly.body.products.some((p) => p.id === id), publicHiddenOnly.body.pagination);

  const badActive = await call('GET', '/products?active=maybe');
  check('active בערך לא חוקי → 400', badActive.status === 400, badActive.status);

  const categoryCounts = await publicCall('GET', '/products/categories');
  const bathroom = categoryCounts.body.find((row) => row.category === 'bathroom');
  const adminCounts = await call('GET', '/products/categories');
  const adminBathroom = adminCounts.body.find((row) => row.category === 'bathroom');
  check('ספירת הקטגוריות זהה לאדמין וללקוח',
    bathroom.product_count === adminBathroom.product_count,
    { public: bathroom, admin: adminBathroom });

  const order = await publicCall('POST', '/orders', {
    customer_name: 'ישראל ישראלי',
    customer_phone: '050-000-0009',
    delivery_method: 'pickup',
    items: [{ id, name: product.name, price: 120, quantity: 1 }],
  });
  check('הזמנה על מוצר מוסתר → 400', order.status === 400, order.status);
  check('ההודעה מסבירה שהמוצר אינו זמין',
    typeof order.body.error === 'string' && order.body.error.includes('אינו זמין'), order.body.error);

  const shown = await call('PUT', `/products/${id}`, { active: true });
  check('החזרה לחנות → active שוב true', shown.body.active === true, shown.body.active);

  const backInStore = await publicCall('GET', `/products/${id}`);
  check('המוצר חזר לחנות', backInStore.status === 200, backInStore.status);

  const backInList = await publicCall('GET', '/products?limit=500');
  check('והוא שוב ברשימה', backInList.body.products.some((p) => p.id === id), backInList.body.pagination);
}

/** מוחק את כל מה שהבדיקה יצרה ומאמת שלא נשארו שאריות. */
async function cleanup() {
  console.log('\n── ניקוי');
  for (const id of created) {
    if (!id) continue;
    const { status } = await call('DELETE', `/products/${id}`);
    check(`נמחק מוצר ${id}`, status === 200, status);
  }

  const left = await call('GET', '/products?limit=500');
  check('לא נשארו מוצרי בדיקה',
    left.body.products.every((p) => !created.includes(p.id)), left.body.products.length);

  const twice = await call('DELETE', `/products/${created[0]}`);
  check('מחיקה חוזרת → 404', twice.status === 404, twice.status);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  const illustrativeId = await testCreate();
  await testRead(illustrativeId);
  await testPartialUpdate();
  await testColors();
  await testVariantRules();
  await testHidden();
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `/products/${id}`).catch(() => {});
  process.exit(1);
});
