/**
 * בודק את דומיין חוות הדעת מקצה לקצה, כולל ההפרדה בין הרשימה
 * הציבורית לרשימת הניהול. מנקה בסוף כל רשומה שיצר.
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

/** צריך מוצר אמיתי כדי לבדוק חוות דעת על מוצר ואת ה-JOIN לשמו */
async function pickProduct() {
  const { body } = await call('GET', '/products?limit=1');
  const product = body.products[0];
  if (!product) throw new Error('אין מוצרים ב-DB — הבדיקה דורשת לפחות אחד');
  return product;
}

/** בודק יצירה: ערכים שנשמרים, ברירות מחדל ושדות שהשרת קובע. */
async function testCreate(product) {
  console.log('\n── יצירה');

  const store = await call('POST', '/reviews', {
    reviewer_name: 'רונית לוי',
    rating: 5,
    text: 'שירות מעולה ויחס אישי. ממליצה בחום!',
    type: 'store',
  });
  created.push(store.body.id);
  check('201 על יצירה', store.status === 201, store.status);
  check('נשמרת כלא-מאושרת', store.body.approved === false, store.body.approved);
  check('type ברירת מחדל נשמר', store.body.type === 'store', store.body.type);
  check('חוות דעת על החנות בלי product_id', store.body.product_id === null, store.body.product_id);
  check('עברית נשמרת', store.body.reviewer_name === 'רונית לוי', store.body.reviewer_name);

  const sneaky = await call('POST', '/reviews', {
    reviewer_name: 'תוקף',
    rating: 5,
    text: 'ניסיון לעקוף את האישור',
    type: 'store',
    approved: true,
  });
  created.push(sneaky.body.id);
  check('approved מהלקוח לא נכנס', sneaky.body.approved === false, sneaky.body.approved);

  const onProduct = await call('POST', '/reviews', {
    reviewer_name: 'משה כהן',
    rating: 4,
    text: 'מוצר טוב, כיסוי יפה',
    type: 'product',
    product_id: product.id,
  });
  created.push(onProduct.body.id);
  check('חוות דעת על מוצר', onProduct.body.product_id === product.id, onProduct.body.product_id);

  const noType = await call('POST', '/reviews', { reviewer_name: 'אנונימי', rating: 3, text: 'בסדר' });
  created.push(noType.body.id);
  check('בלי type → store', noType.body.type === 'store', noType.body.type);

  return { storeId: store.body.id, productReviewId: onProduct.body.id };
}

/** בודק שכל קלט פסול נדחה בקוד 400. */
async function testValidation(product) {
  console.log('\n── ולידציה (הכל אמור להיחסם ב-400)');

  const base = { reviewer_name: 'בודק', rating: 5, text: 'טקסט', type: 'store' };
  const cases = [
    ['בלי שם כותב', { ...base, reviewer_name: '   ' }],
    ['בלי טקסט', { ...base, text: '' }],
    ['טקסט ארוך מ-2000', { ...base, text: 'א'.repeat(2001) }],
    ['דירוג 0', { ...base, rating: 0 }],
    ['דירוג 6', { ...base, rating: 6 }],
    ['דירוג לא שלם', { ...base, rating: 4.5 }],
    ['דירוג חסר', { reviewer_name: 'בודק', text: 'טקסט' }],
    ['type לא מוכר', { ...base, type: 'video' }],
    ['חוות דעת על מוצר בלי product_id', { ...base, type: 'product' }],
    ['product_id לא תקין', { ...base, type: 'product', product_id: 'abc' }],
  ];

  for (const [name, body] of cases) {
    const { status, body: res } = await call('POST', '/reviews', body);
    if (status === 201) created.push(res.id);
    check(name, status === 400, `${status} ${res.error || ''}`);
  }

  const ghost = await call('POST', '/reviews', { ...base, type: 'product', product_id: 999999 });
  if (ghost.status === 201) created.push(ghost.body.id);
  check('מוצר שאינו קיים → 409', ghost.status === 409, `${ghost.status} ${ghost.body.error || ''}`);
  void product;
}

/** בודק שהרשימה הציבורית מציגה מאושרות בלבד. */
async function testPublicList(ids) {
  console.log('\n── רשימה ציבורית (מאושרות בלבד)');

  const before = await call('GET', '/reviews');
  check('מערך שטוח', Array.isArray(before.body), typeof before.body);
  check('חוות דעת לא מאושרת אינה מופיעה', !before.body.some((r) => r.id === ids.storeId), before.body.length);

  const bypass = await call('GET', '/reviews?approved=false');
  check('approved=false לא עוקף את הסינון', !bypass.body.some((r) => r.id === ids.storeId), bypass.body.length);

  await call('PUT', `/reviews/${ids.storeId}/approve`, { approved: true });
  const after = await call('GET', '/reviews');
  check('אחרי אישור — מופיעה', after.body.some((r) => r.id === ids.storeId), after.body.length);
  check('הרשימה ממוינת מהחדש לישן',
    after.body.every((r, i) => i === 0 || new Date(after.body[i - 1].created_at) >= new Date(r.created_at)), null);
  check('אין product_name בנתיב הציבורי', !('product_name' in after.body[0]), Object.keys(after.body[0]));

  const byType = await call('GET', '/reviews?type=store');
  check('סינון לפי type', byType.body.every((r) => r.type === 'store'), byType.body.length);

  const badType = await call('GET', '/reviews?type=video');
  check('type לא חוקי בסינון → 400', badType.status === 400, badType.status);

  const paged = await call('GET', '/reviews?limit=1');
  check('limit מחזיר אובייקט עם pagination',
    Array.isArray(paged.body.reviews) && paged.body.reviews.length === 1 && paged.body.pagination.total >= 1,
    paged.body);
}

/** בודק שרשימת הניהול מציגה הכל, כולל שם המוצר. */
async function testAdminList(product, ids) {
  console.log('\n── רשימת האדמין (/all)');

  const all = await call('GET', '/reviews/all');
  check('מערך שטוח', Array.isArray(all.body), typeof all.body);
  check('כוללת גם לא-מאושרות', all.body.some((r) => r.approved === false), all.body.length);

  const withName = all.body.find((r) => r.id === ids.productReviewId);
  check('product_name מגיע מה-JOIN', withName?.product_name === product.name, withName?.product_name);

  const storeReview = all.body.find((r) => r.type === 'store');
  check('חוות דעת על החנות — product_name ריק', storeReview.product_name === null, storeReview.product_name);

  const pending = await call('GET', '/reviews/all?approved=false');
  check('סינון ללא-מאושרות', pending.body.every((r) => r.approved === false), pending.body.length);
}

/** בודק שליפה בודדת ועדכון חלקי. */
async function testReadUpdate(ids) {
  console.log('\n── קריאה ועדכון');

  const one = await call('GET', `/reviews/${ids.storeId}`);
  check('חוות דעת בודדת', one.status === 200 && one.body.id === ids.storeId, one.status);

  const missing = await call('GET', '/reviews/999999');
  check('שאינה קיימת → 404', missing.status === 404, missing.status);

  const badId = await call('GET', '/reviews/abc');
  check('מזהה לא מספרי → 400', badId.status === 400, badId.status);

  const partial = await call('PUT', `/reviews/${ids.storeId}`, { text: 'עודכן' });
  check('עדכון חלקי משנה רק את text',
    partial.body.text === 'עודכן' && partial.body.reviewer_name === 'רונית לוי' && partial.body.rating === 5,
    partial.body);

  const readonly = await call('PUT', `/reviews/${ids.storeId}`, { type: 'product', product_id: 1 });
  check('type ו-product_id אינם ניתנים לעריכה → 400', readonly.status === 400, `${readonly.status} ${readonly.body.error}`);

  const badRating = await call('PUT', `/reviews/${ids.storeId}`, { rating: 9 });
  check('דירוג לא חוקי בעדכון → 400', badRating.status === 400, badRating.status);

  const unapprove = await call('PUT', `/reviews/${ids.storeId}/approve`, { approved: false });
  check('ביטול אישור', unapprove.body.approved === false, unapprove.body.approved);

  const noBody = await call('PUT', `/reviews/${ids.storeId}/approve`, {});
  check('בלי שדה approved → 400', noBody.status === 400, noBody.status);

  const notThere = await call('PUT', '/reviews/999999/approve', { approved: true });
  check('אישור לחוות דעת שאינה קיימת → 404', notThere.status === 404, notThere.status);
}

/**
 * בודק את חישוב הממוצע וההתפלגות.
 *
 * הבדיקה נמדדת כהפרש לפני ואחרי, ולא מול מספרים מוחלטים: הסטטיסטיקה
 * היא על כל חוות הדעת המאושרות במסד, ולכן כל חוות דעת אמיתית אחת
 * הייתה שוברת בדיקה שמצפה ל-total מוחלט.
 */
async function testStats(ids) {
  console.log('\n── סטטיסטיקה');

  const before = await call('GET', '/reviews/stats');
  const baseTotal = before.body.total;
  const baseFives = before.body.distribution['5'];
  const baseFours = before.body.distribution['4'];

  await call('PUT', `/reviews/${ids.storeId}/approve`, { approved: true });
  await call('PUT', `/reviews/${ids.productReviewId}/approve`, { approved: true });

  const stats = await call('GET', '/reviews/stats');
  check('מבנה התשובה',
    typeof stats.body.total === 'number' && typeof stats.body.average === 'number' && stats.body.distribution,
    stats.body);
  check('סופר רק מאושרות — שתיים נוספו',
    stats.body.total === baseTotal + 2,
    `${baseTotal} → ${stats.body.total}`);
  check('התפלגות — דירוג 5 ודירוג 4 עלו באחד',
    stats.body.distribution['5'] === baseFives + 1 && stats.body.distribution['4'] === baseFours + 1,
    stats.body.distribution);

  // הממוצע חייב להיות עקבי עם ההתפלגות שהוחזרה באותה תשובה.
  const sum = Object.entries(stats.body.distribution)
    .reduce((acc, [rating, count]) => acc + Number(rating) * count, 0);
  const expected = Math.round((sum / stats.body.total) * 100) / 100;
  check('הממוצע עקבי עם ההתפלגות',
    Math.abs(stats.body.average - expected) < 0.005,
    `${stats.body.average} מול ${expected}`);

  const scoped = await call('GET', `/reviews/stats?type=product&product_id=${ids.productId}`);
  check('סטטיסטיקה מסוננת', scoped.status === 200, scoped.status);
}

/** מוחק את כל מה שהבדיקה יצרה ומאמת שלא נשארו שאריות. */
async function cleanup() {
  console.log('\n── ניקוי');
  for (const id of created) {
    if (!id) continue;
    const { status } = await call('DELETE', `/reviews/${id}`);
    check(`נמחקה חוות דעת ${id}`, status === 200, status);
  }
  const left = await call('GET', '/reviews/all');
  check('לא נשארו חוות דעת בדיקה', left.body.every((r) => !created.includes(r.id)), left.body.length);

  const twice = await call('DELETE', `/reviews/${created[0]}`);
  check('מחיקה חוזרת → 404', twice.status === 404, twice.status);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  const product = await pickProduct();
  const ids = await testCreate(product);
  ids.productId = product.id;

  await testValidation(product);
  await testPublicList(ids);
  await testAdminList(product, ids);
  await testReadUpdate(ids);
  await testStats(ids);
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `/reviews/${id}`).catch(() => {});
  process.exit(1);
});
