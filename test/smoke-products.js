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
 *
 * ועל העלאת התמונות, שעוברות עיבוד בשרת: סיבוב לפי EXIF, הקטנה
 * ל-1200px ו-WebP בשם שנגזר מהתוכן. התמונות נוצרות כאן ב-sharp,
 * והקבצים שהשרת שמר נמחקים בסוף.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { login } = require('./helpers');
const { findOriginal, removeOriginal } = require('../server/utils/originals');
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';

let passed = 0;
let failed = 0;
const created = [];
const uploadedFiles = new Set();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

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
 * בודק מחירים עשרוניים מקצה לקצה דרך ה-API: הוולידציה, העמודה במסד
 * (NUMERIC(10,2) — עד כאן INTEGER שעיגל בשקט), והקריאה חזרה כמספר.
 *
 * הבאג שזה סוגר: 12.90 נשמר 13. שלוש שכבות עיגלו בדרך — הקליינט
 * (parseInt), הוולידטור (Math.round) והעמודה — ולכן הבדיקה היא שמה
 * שנשלח הוא בדיוק מה שחוזר, גם ביצירה, גם בעדכון וגם בגרסאות.
 */
async function testDecimalPrices() {
  console.log('\n── מחירים עשרוניים');

  const base = { ...validProduct(), sku: 'TEST-DECIMAL-1' };

  const decimal = await call('POST', '/products', { ...base, price: 12.9 });
  created.push(decimal.body.id);
  check('12.9 נשמר → 201', decimal.status === 201, `${decimal.status} ${decimal.body.error || ''}`);
  check('המחיר חוזר 12.9 ולא 13', decimal.body.price === 12.9, decimal.body.price);

  const read = await call('GET', `/products/${decimal.body.id}`);
  check('גם בקריאה מהמסד — מספר 12.9, לא המחרוזת "12.90"',
    read.body.price === 12.9 && typeof read.body.price === 'number', read.body.price);

  const asString = await call('POST', '/products', { ...base, sku: 'TEST-DECIMAL-2', price: '12.90' });
  created.push(asString.body.id);
  check('"12.90" כמחרוזת → 12.9', asString.body.price === 12.9, asString.body.price);

  const updated = await call('PUT', `/products/${decimal.body.id}`, { price: 7.5 });
  check('עדכון ל-7.5 נשמר כמו שהוא', updated.status === 200 && updated.body.price === 7.5,
    `${updated.status} ${updated.body.price ?? updated.body.error}`);

  const cents = await call('PUT', `/products/${decimal.body.id}`, { price: 0.01 });
  check('אגורה אחת היא מחיר תקין', cents.body.price === 0.01, cents.body.price);

  const whole = await call('PUT', `/products/${decimal.body.id}`, { price: 30 });
  check('מחיר שלם נשאר שלם', whole.body.price === 30, whole.body.price);

  // 0 אינו מחיר אלא "המחיר עוד לא הוקלד" — כך נוצרים מוצרים בלי מחיר
  const zero = await call('PUT', `/products/${decimal.body.id}`, { price: 0 });
  check('0 (ללא מחיר) עדיין מתקבל', zero.status === 200 && zero.body.price === 0, zero.body.price);

  const bad = [
    ['שלוש ספרות אחרי הנקודה', 12.999],
    ['שלילי', -1],
    ['טקסט', 'יקר'],
    ['פסיק (הקליינט ממיר, השרת לא מנחש)', '12,90'],
    ['מעל התקרה של NUMERIC(10,2)', 100_000_000],
  ];
  for (const [name, price] of bad) {
    const res = await call('PUT', `/products/${decimal.body.id}`, { price });
    check(`${name} → 400`, res.status === 400, `${res.status} ${res.body.error || ''}`);
  }
  const unchanged = await call('GET', `/products/${decimal.body.id}`);
  check('ערך שנדחה לא שינה את המחיר', unchanged.body.price === 0, unchanged.body.price);

  const variants = await call('POST', '/products', {
    ...base, sku: 'TEST-DECIMAL-3',
    variants: [{ label: '1 ליטר', price: 19.5 }, { label: '3 ליטר', price: '12.90' }],
  });
  created.push(variants.body.id);
  check('גרסאות עשרוניות נשמרות', variants.status === 201
    && variants.body.variants[0].price === 19.5 && variants.body.variants[1].price === 12.9,
  variants.body.variants || variants.body.error);
  check('מחיר המוצר הוא הזולה שבגרסאות (12.9)', variants.body.price === 12.9, variants.body.price);

  const badVariant = await call('POST', '/products', {
    ...base, sku: 'TEST-DECIMAL-BAD', variants: [{ label: '1 ליטר', price: 19.999 }],
  });
  if (badVariant.status === 201) created.push(badVariant.body.id);
  check('גרסה עם שלוש ספרות אחרי הנקודה → 400', badVariant.status === 400, badVariant.status);
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

/** מעלה קבצים ל-upload-multiple; כל קובץ הוא [שם, Buffer, סוג]. */
async function uploadFiles(files, { auth = true } = {}) {
  const form = new FormData();
  for (const [name, buffer, type] of files) {
    form.append('images', new Blob([buffer], { type }), name);
  }
  const res = await fetch(`${BASE}/upload-multiple`, {
    method: 'POST',
    headers: auth ? { Cookie: authCookie } : {},
    body: form,
  });
  const body = await res.json();
  for (const url of body.imageUrls || []) uploadedFiles.add(path.basename(url));
  return { status: res.status, body };
}

/**
 * קורא את מידות ופורמט הקובץ שהשרת שמר בפועל. דרך Buffer ולא נתיב,
 * כי ב-Windows המטמון של sharp מחזיק את הקובץ פתוח והניקוי נכשל.
 */
function savedMeta(url) {
  return sharp(fs.readFileSync(path.join(UPLOADS_DIR, path.basename(url)))).metadata();
}

/** תמונת JPEG בגודל נתון, ברעש כדי שלא תהיה זהה בין ריצות. */
function jpeg(width, height, orientation) {
  const img = sharp(Buffer.from(Array.from({ length: 12 }, () => Math.floor(Math.random() * 256))), {
    raw: { width: 2, height: 2, channels: 3 },
  }).resize(width, height, { kernel: 'nearest' });
  if (orientation) img.withMetadata({ orientation });
  return img.jpeg().toBuffer();
}

/** צבע הפיקסל (x, y) בקובץ שהשרת שמר, כ-[r, g, b]. */
async function savedPixel(url, x, y) {
  const { data, info } = await sharp(fs.readFileSync(path.join(UPLOADS_DIR, path.basename(url))))
    .raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [data[at], data[at + 1], data[at + 2]];
}

/** האם שני צבעים קרובים. WebP מאבד מעט, ולכן לא השוואה מדויקת. */
const near = (a, b, tolerance = 24) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

/** תמונה בגודל נתון מפסים אופקיים בצבעים נתונים, מלמעלה למטה. */
function bands(width, height, colours) {
  const band = Math.floor(height / colours.length);
  return sharp({ create: { width, height, channels: 3, background: colours[colours.length - 1] } })
    .composite(colours.slice(0, -1).map((background, i) => ({
      input: { create: { width, height: band, channels: 3, background } }, top: i * band, left: 0,
    })));
}

/**
 * בודק את עיבוד התמונות בהעלאה: הקטנה לצלע של 1200, השלמה לריבוע בלי
 * חיתוך, וסיבוב לפי EXIF.
 *
 * כל תמונה יוצאת ריבועית, ולכן המידות לבדן כבר לא מראות שהסיבוב קרה.
 * הסיבוב נבדק לפי התוכן: תמונה שנשמרה שוכבת, חציה השמאלי אדום וחציה
 * הימני כחול, עם תגית סיבוב 6 (90° עם השעון) — אחרי העיבוד האדום
 * למעלה והכחול למטה.
 */
async function testUploads() {
  console.log('\n── העלאת תמונות');

  const bigSource = await jpeg(3000, 2000);
  const big = await uploadFiles([['big.jpg', bigSource, 'image/jpeg']]);
  check('העלאה → 200', big.status === 200, big.status);
  const bigUrl = big.body.imageUrls?.[0] || '';
  check('שם הקובץ הוא hash עם סיומת webp',
    /^\/uploads\/[0-9a-f]{16}\.webp$/.test(bigUrl), bigUrl);
  const bigMeta = await savedMeta(bigUrl);
  check('נשמר כ-WebP', bigMeta.format === 'webp', bigMeta.format);
  check('הוקטן והושלם לריבוע של 1200', bigMeta.width === 1200 && bigMeta.height === 1200,
    [bigMeta.width, bigMeta.height]);

  // הצילום המקורי נשמר כמו שהגיע, בשם המקושר לקובץ המעובד — ולא מוגש
  const original = findOriginal(path.basename(bigUrl));
  check('המקור נשמר: אותו בסיס שם, סיומת jpg',
    original && path.basename(original) === path.basename(bigUrl, '.webp') + '.jpg', original && path.basename(original));
  check('המקור הוא בדיוק הקובץ שהועלה, ברזולוציה מלאה',
    original && fs.readFileSync(original).equals(bigSource));
  const exposed = await fetch(`${BASE.slice(0, -4)}/uploads-originals/${path.basename(original || '')}`);
  check('תיקיית המקורות אינה מוגשת', !(exposed.headers.get('content-type') || '').startsWith('image/'),
    `${exposed.status} ${exposed.headers.get('content-type')}`);
  const sideBySide = await fetch(`${BASE.slice(0, -4)}/uploads/${path.basename(original || '')}`);
  check('וגם לא דרך /uploads', sideBySide.status === 404, sideBySide.status);

  const small = await uploadFiles([['small.png', await sharp({
    create: { width: 300, height: 200, channels: 3, background: '#c89f6d' },
  }).png().toBuffer(), 'image/png']]);
  const smallMeta = await savedMeta(small.body.imageUrls[0]);
  check('תמונה קטנה לא מוגדלת — רק הושלמה לריבוע של 300', smallMeta.width === 300 && smallMeta.height === 300,
    [smallMeta.width, smallMeta.height]);

  const square = await uploadFiles([['square.png', await sharp({
    create: { width: 640, height: 640, channels: 3, background: '#4a7a3c' },
  }).png().toBuffer(), 'image/png']]);
  const squareMeta = await savedMeta(square.body.imageUrls[0]);
  check('תמונה ריבועית נשארת במידותיה', squareMeta.width === 640 && squareMeta.height === 640,
    [squareMeta.width, squareMeta.height]);

  // מוצר ארוך בצילום עומד (מגב, מטאטא): ראש אדום, ידית כחולה, קצה ירוק,
  // על רקע אפור-לבן. שום פס לא נחתך, והתוספת בצדדים בצבע הרקע של אותה שורה.
  const tall = await bands(300, 600, ['#d22b2b', '#2b4bd2', '#2bd24b']).png().toBuffer();
  const mop = (await uploadFiles([['mop.png', tall, 'image/png']])).body.imageUrls[0];
  const mopMeta = await savedMeta(mop);
  check('תמונה עומדת → ריבוע 600×600', mopMeta.width === 600 && mopMeta.height === 600,
    [mopMeta.width, mopMeta.height]);
  check('הראש לא נחתך (אדום בשורה הראשונה)', near(await savedPixel(mop, 300, 4), [210, 43, 43]),
    await savedPixel(mop, 300, 4));
  check('הקצה לא נחתך (ירוק בשורה האחרונה)', near(await savedPixel(mop, 300, 595), [43, 210, 75]),
    await savedPixel(mop, 300, 595));
  check('התוספת בצד ממשיכה את השורה שלה (אדום ליד הראש)',
    near(await savedPixel(mop, 10, 60), [210, 43, 43]), await savedPixel(mop, 10, 60));
  check('ובאמצע — כחול ליד הידית',
    near(await savedPixel(mop, 590, 300), [43, 75, 210]), await savedPixel(mop, 590, 300));

  // תמונה שוכבת: התוספת למעלה ולמטה
  const wide = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#c89f6d' } }).png().toBuffer();
  const wideUrl = (await uploadFiles([['wide.png', wide, 'image/png']])).body.imageUrls[0];
  const wideMeta = await savedMeta(wideUrl);
  check('תמונה שוכבת → ריבוע 600×600', wideMeta.width === 600 && wideMeta.height === 600,
    [wideMeta.width, wideMeta.height]);
  check('התוספת למעלה בצבע הרקע', near(await savedPixel(wideUrl, 300, 20), [200, 159, 109]),
    await savedPixel(wideUrl, 300, 20));

  // בשני שלבים: ב-sharp ה-composite רץ אחרי ה-rotate של אותו pipeline
  const upright = await bands(200, 400, ['#d22b2b', '#2b4bd2']).png().toBuffer();
  const stored = await sharp(upright).rotate(-90).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const rotatedUrl = (await uploadFiles([['rotated.jpg', stored, 'image/jpeg']])).body.imageUrls[0];
  const rotatedMeta = await savedMeta(rotatedUrl);
  check('סובב לפי EXIF — אדום למעלה', near(await savedPixel(rotatedUrl, 200, 40), [210, 43, 43], 40),
    await savedPixel(rotatedUrl, 200, 40));
  check('וכחול למטה', near(await savedPixel(rotatedUrl, 200, 360), [43, 75, 210], 40),
    await savedPixel(rotatedUrl, 200, 360));
  check('תגית הסיבוב הוסרה', !rotatedMeta.orientation || rotatedMeta.orientation === 1,
    rotatedMeta.orientation);

  // אותו תוכן פעמיים → אותו שם, וקובץ אחד בדיסק
  const same = await jpeg(500, 500);
  const twice = await uploadFiles([['a.jpg', same, 'image/jpeg'], ['b.jpg', same, 'image/jpeg']]);
  check('תוכן זהה → אותו שם', twice.body.imageUrls?.length === 2
    && twice.body.imageUrls[0] === twice.body.imageUrls[1], twice.body.imageUrls);

  // JPEG תקין עם ריפוד בסופו — המפענח מתעלם ממה שאחרי סוף התמונה,
  // וכך אפשר לבדוק את מגבלת הגודל בלי לייצר צילום אמיתי של 11MB.
  const base = await jpeg(800, 600);
  const eleven = Buffer.concat([base, Buffer.alloc(11 * 1024 * 1024 - base.length)]);
  const elevenRes = await uploadFiles([['iphone.jpg', eleven, 'image/jpeg']]);
  check('קובץ של 11MB מתקבל', elevenRes.status === 200, `${elevenRes.status} ${elevenRes.body.error || ''}`);

  const huge = Buffer.concat([base, Buffer.alloc(16 * 1024 * 1024 - base.length)]);
  const hugeRes = await uploadFiles([['huge.jpg', huge, 'image/jpeg']]);
  check('קובץ של 16MB → 413', hugeRes.status === 413, hugeRes.status);

  // HEIC: גם לפי השם, וגם כשהוא מתחזה ל-JPG ורק התוכן מסגיר אותו
  const heicHeader = Buffer.concat([
    Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.from([0, 0, 0, 0]),
    Buffer.from('mif1heic'), Buffer.alloc(64),
  ]);
  const heicByName = await uploadFiles([['IMG_0001.HEIC', heicHeader, 'image/heic']]);
  check('HEIC לפי שם → 415', heicByName.status === 415, heicByName.status);
  check('הודעה ברורה בעברית', heicByName.body.error?.includes('המירו ל-JPG'), heicByName.body.error);

  const heicDisguised = await uploadFiles([['IMG_0001.jpg', heicHeader, 'image/jpeg']]);
  check('HEIC בסיומת jpg → 415', heicDisguised.status === 415, heicDisguised.status);
  check('גם כאן ההודעה על HEIC', heicDisguised.body.error?.includes('HEIC'), heicDisguised.body.error);

  // AVIF יושב באותה מעטפת ftyp, ואסור שייתפס כ-HEIC
  const avif = await uploadFiles([['photo.avif', await jpeg(300, 300).then((b) => sharp(b).avif().toBuffer()), 'image/avif']]);
  check('AVIF מתקבל', avif.status === 200, `${avif.status} ${avif.body.error || ''}`);

  const broken = await uploadFiles([['broken.jpg', Buffer.from('not really an image'), 'image/jpeg']]);
  check('קובץ פגום → 400', broken.status === 400, broken.status);

  const anonymous = await uploadFiles([['x.jpg', base, 'image/jpeg']], { auth: false });
  check('בלי התחברות → 401', anonymous.status === 401, anonymous.status);
}

/**
 * בודק את תת-הקטגוריה: מזהה מ-categories.js ששייך לקטגוריה של המוצר.
 *
 * שם בעברית או מזהה מקטגוריה אחרת נדחים ב-400 — מוצר כזה לא היה
 * מופיע באף סינון בחנות. ריק מותר. העריכה המהירה ברשימה שולחת רק
 * subcategory, והבדיקה שלה היא מול הקטגוריה הקיימת של המוצר.
 */
async function testSubcategory() {
  console.log('\n── תת-קטגוריה');

  const { categories } = require('../server/utils/categories').load();
  const bathroomSub = categories.find((c) => c.id === 'bathroom').subcategories[0];
  const bathroomSub2 = categories.find((c) => c.id === 'bathroom').subcategories[1];
  const paintingSub = categories.find((c) => c.id === 'painting').subcategories[0];
  const base = { ...validProduct(), category: 'bathroom' };

  const ok = await call('POST', '/products', { ...base, sku: 'TEST-SUB-1', subcategory: bathroomSub.id });
  created.push(ok.body.id);
  check('תת-קטגוריה של הקטגוריה → 201', ok.status === 201, `${ok.status} ${ok.body.error || ''}`);
  check('ונשמרת', ok.body.subcategory === bathroomSub.id, ok.body.subcategory);

  const empty = await call('POST', '/products', { ...base, sku: 'TEST-SUB-2', subcategory: '' });
  created.push(empty.body.id);
  check('ריק מותר → 201, נשמר כ-null', empty.status === 201 && empty.body.subcategory === null,
    `${empty.status} ${empty.body.subcategory}`);

  const foreign = await call('POST', '/products', { ...base, sku: 'TEST-SUB-BAD', subcategory: paintingSub.id });
  if (foreign.status === 201) created.push(foreign.body.id);
  check('תת-קטגוריה של קטגוריה אחרת → 400', foreign.status === 400, foreign.status);
  check('ההודעה בעברית, עם שני השמות',
    foreign.body.error === `תת-הקטגוריה "${paintingSub.name}" אינה שייכת לקטגוריה "מוצרי אמבטיה"`,
    foreign.body.error);

  const freeText = await call('POST', '/products', { ...base, sku: 'TEST-SUB-BAD', subcategory: 'מסורים' });
  if (freeText.status === 201) created.push(freeText.body.id);
  check('שם חופשי בעברית במקום מזהה → 400', freeText.status === 400, freeText.status);

  // העריכה המהירה: רק subcategory, מול הקטגוריה הקיימת
  const quick = await call('PUT', `/products/${empty.body.id}`, { subcategory: bathroomSub2.id });
  check('שיבוץ מהיר (subcategory בלבד) → 200', quick.status === 200 && quick.body.subcategory === bathroomSub2.id,
    `${quick.status} ${quick.body.subcategory ?? quick.body.error}`);
  const quickBad = await call('PUT', `/products/${empty.body.id}`, { subcategory: paintingSub.id });
  check('שיבוץ מהיר לא שייך → 400', quickBad.status === 400, quickBad.status);
  const unchanged = await call('GET', `/products/${empty.body.id}`);
  check('והערך הקודם נשאר', unchanged.body.subcategory === bathroomSub2.id, unchanged.body.subcategory);

  const cleared = await call('PUT', `/products/${empty.body.id}`, { subcategory: null });
  check('ניקוי תת-הקטגוריה מותר', cleared.status === 200 && cleared.body.subcategory === null, cleared.body.subcategory);

  // מעבר קטגוריה בלי תת-קטגוריה בבקשה מנקה את מה שכבר לא שייך
  const moved = await call('PUT', `/products/${ok.body.id}`, { category: 'painting' });
  check('מעבר קטגוריה מנקה תת-קטגוריה שלא שייכת', moved.status === 200 && moved.body.subcategory === null,
    `${moved.status} ${moved.body.subcategory}`);
  const movedWith = await call('PUT', `/products/${ok.body.id}`, { category: 'painting', subcategory: paintingSub.id });
  check('מעבר קטגוריה יחד עם תת-קטגוריה שלה → נשמר', movedWith.body.subcategory === paintingSub.id,
    movedWith.body.subcategory);
}

/**
 * בודק את מחיקת המוצר, בשני המקרים.
 *
 * בלי הזמנות: המוצר נמחק, הביקורות שלו נמחקות, וקובץ תמונה שאף מוצר
 * אחר אינו משתמש בו נמחק מ-uploads — אבל קובץ שמוצר אחר עדיין מציג
 * נשאר. השם נגזר מהתוכן, ולכן תמונה משותפת היא מקרה אמיתי ולא תיאורטי.
 *
 * עם הזמנות: 409 עם ההודעה שמסך הניהול מציג כמו שהיא, הפרטים שהוא
 * צריך כדי להציע "הסתר", ושום דבר לא נמחק — לא המוצר, לא הביקורות
 * ולא התמונות.
 */
async function testDelete() {
  console.log('\n── מחיקה');

  const exists = (url) => fs.existsSync(path.join(UPLOADS_DIR, path.basename(url)));

  const [own, shared] = (await uploadFiles([
    ['own.jpg', await jpeg(320, 320), 'image/jpeg'],
    ['shared.jpg', await jpeg(330, 330), 'image/jpeg'],
  ])).body.imageUrls;
  check('שתי תמונות הועלו', exists(own) && exists(shared), [own, shared]);

  const doomed = await call('POST', '/products', {
    ...validProduct(), sku: 'TEST-DELETE-1', image_url: own, images: [shared],
  });
  const keeper = await call('POST', '/products', {
    ...validProduct(), sku: 'TEST-DELETE-2', image_url: shared, images: [],
  });
  created.push(keeper.body.id);

  const review = await publicCall('POST', '/reviews', {
    reviewer_name: 'בודק מחיקה', rating: 5, text: 'ביקורת שאמורה להימחק עם המוצר',
    type: 'product', product_id: doomed.body.id,
  });
  check('נוצרה ביקורת על המוצר', review.status === 201, review.status);

  const removed = await call('DELETE', `/products/${doomed.body.id}`);
  check('מוצר בלי הזמנות → 200', removed.status === 200, `${removed.status} ${removed.body.error || ''}`);
  check('גם הביקורת שלו נמחקה (1)', removed.body.deleted?.reviews === 1, removed.body.deleted);
  check('הקובץ שרק הוא השתמש בו נמחק מ-uploads', !exists(own), own);
  check('והצילום המקורי שלו איתו', findOriginal(path.basename(own)) === null);
  check('הקובץ שמוצר אחר מציג נשאר', exists(shared), shared);
  check('והמקור שלו נשאר', findOriginal(path.basename(shared)) !== null);
  check('התשובה מונה רק את הקובץ שנמחק',
    JSON.stringify(removed.body.deleted?.files) === JSON.stringify([own]), removed.body.deleted?.files);

  const gone = await call('GET', `/products/${doomed.body.id}`);
  check('המוצר אינו במסד', gone.status === 404, gone.status);
  const reviewGone = await call('GET', `/reviews/${review.body.id}`);
  check('הביקורת אינה במסד', reviewGone.status === 404, reviewGone.status);

  // מוצר שנמכר
  const sold = await call('POST', '/products', { ...validProduct(), sku: 'TEST-DELETE-3', price: 15, image_url: shared });
  created.push(sold.body.id);
  const order = await publicCall('POST', '/orders', {
    customer_name: 'בודק מחיקה', customer_phone: '050-673-5040', delivery_method: 'pickup',
    items: [{ id: sold.body.id, name: sold.body.name, price: 15, quantity: 1 }],
  });
  check('נוצרה הזמנה על המוצר', order.status === 201, `${order.status} ${order.body.error || ''}`);

  const blocked = await call('DELETE', `/products/${sold.body.id}`);
  check('מוצר עם הזמנות → 409', blocked.status === 409, blocked.status);
  check('ההודעה בעברית, כמו שהיא מוצגת',
    blocked.body.error === 'למוצר יש הזמנות, ולכן אי אפשר למחוק אותו. אפשר להסתיר אותו מהחנות', blocked.body.error);
  check('הפרטים אומרים למסך הניהול להציע "הסתר"',
    blocked.body.details?.reason === 'has_orders' && blocked.body.details?.orders === 1
      && blocked.body.details?.active === true, blocked.body.details);

  const stillThere = await call('GET', `/products/${sold.body.id}`);
  check('המוצר נשאר במסד', stillThere.status === 200, stillThere.status);
  check('והתמונה שלו נשארה', exists(shared), shared);

  // מה שהכפתור "הסתר" בהודעה עושה
  const hidden = await call('PUT', `/products/${sold.body.id}`, { active: false });
  check('"הסתר" במקום מחיקה עובד', hidden.status === 200 && hidden.body.active === false, hidden.body.active);

  const missing = await call('DELETE', '/products/999999');
  check('מחיקת מוצר שאינו קיים → 404', missing.status === 404, missing.status);

  // ההזמנה נמחקת כאן, כדי שהניקוי יוכל למחוק את המוצר
  const orderDeleted = await call('DELETE', `/orders/${order.body.id}`);
  check('ניקוי: הזמנת הבדיקה נמחקה', orderDeleted.status === 200, orderDeleted.status);
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

  for (const name of uploadedFiles) {
    fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });
    removeOriginal(name);
  }
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  const illustrativeId = await testCreate();
  await testRead(illustrativeId);
  await testPartialUpdate();
  await testColors();
  await testVariantRules();
  await testDecimalPrices();
  await testSubcategory();
  await testHidden();
  await testUploads();
  await testDelete();
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `/products/${id}`).catch(() => {});
  for (const name of uploadedFiles) {
    fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });
    removeOriginal(name);
  }
  process.exit(1);
});
