/**
 * בודק את דומיין גווני הפיגמנט מקצה לקצה.
 * נוגע רק ברשומות שהוא עצמו יצר, ומאמת בסוף שהגוונים האמיתיים לא זזו.
 */
const { login } = require('./helpers');
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';
const PATH = '/pigment-formulas';

/** תחילית ייחודית, כדי שלא נתנגש בגוון אמיתי לעולם */
const TEST_CODE = '_smoke_test_color';

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

const validFormula = () => ({
  color_code: TEST_CODE,
  color_name_he: 'גוון בדיקה',
  hex: '#a1b2c3',
  ml_per_liter_light: 20,
  ml_per_liter_medium: 50,
  ml_per_liter_dark: 100,
  sort_order: 999,
});

/** בודק את הרשימה: סדר, חיפוש, מיון ודפדוף. */
async function testList() {
  console.log('\n── רשימה');

  const { status, body } = await call('GET', PATH);
  check('מערך שטוח', Array.isArray(body), typeof body);
  check('עשרים הגוונים קיימים', body.length >= 20, body.length);
  check('200', status === 200, status);
  check('ממוין לפי sort_order',
    body.every((f, i) => i === 0 || body[i - 1].sort_order <= f.sort_order), null);
  check('עברית תקינה', body.some((f) => f.color_name_he === 'שמנת'), body[0]?.color_name_he);

  const search = await call('GET', `${PATH}?search=` + encodeURIComponent('כחול'));
  check('חיפוש בעברית', search.body.length >= 1 && search.body.every((f) => f.color_name_he.includes('כחול')), search.body.length);

  const byCode = await call('GET', `${PATH}?search=turquoise`);
  check('חיפוש לפי color_code', byCode.body.some((f) => f.color_code === 'turquoise'), byCode.body.length);

  const paged = await call('GET', `${PATH}?limit=3`);
  check('limit מחזיר אובייקט עם pagination',
    Array.isArray(paged.body.formulas) && paged.body.formulas.length === 3 && paged.body.pagination.total >= 20,
    paged.body.pagination);

  const sorted = await call('GET', `${PATH}?sort=color_code&order=desc`);
  check('מיון לפי color_code יורד',
    sorted.body.every((f, i) => i === 0 || sorted.body[i - 1].color_code >= f.color_code), null);

  const badSort = await call('GET', `${PATH}?sort=hex`);
  check('sort שאינו ברשימה → 400', badSort.status === 400, badSort.status);

  return body;
}

/** בודק שליפה בודדת, מזהים שאינם קיימים וקלט לא תקין. */
async function testRead(existing) {
  console.log('\n── קריאה בודדת');

  const sample = existing.find((f) => f.color_code === 'blue');

  const byId = await call('GET', `${PATH}/${sample.id}`);
  check('לפי id', byId.status === 200 && byId.body.color_code === 'blue', byId.status);

  const byCode = await call('GET', `${PATH}/code/blue`);
  check('לפי color_code', byCode.body.id === sample.id, byCode.body);

  const upper = await call('GET', `${PATH}/code/BLUE`);
  check('color_code לא רגיש לאותיות גדולות', upper.body.id === sample.id, upper.status);

  const missing = await call('GET', `${PATH}/999999`);
  check('id שאינו קיים → 404', missing.status === 404, missing.status);

  const noCode = await call('GET', `${PATH}/code/no_such_color`);
  check('code שאינו קיים → 404', noCode.status === 404, noCode.status);

  const badCode = await call('GET', `${PATH}/code/bad-code!`);
  check('code בפורמט לא חוקי → 400', badCode.status === 400, badCode.status);

  const badId = await call('GET', `${PATH}/abc`);
  check('id לא מספרי → 400', badId.status === 400, badId.status);
}

/** בודק יצירה: ערכים שנשמרים, ברירות מחדל ושדות שהשרת קובע. */
async function testCreate() {
  console.log('\n── יצירה');

  const { status, body } = await call('POST', PATH, validFormula());
  created.push(body.id);
  check('201', status === 201, status);
  check('hex מנורמל לאותיות גדולות', body.hex === '#A1B2C3', body.hex);
  check('הכמויות נשמרו', body.ml_per_liter_dark === 100, body.ml_per_liter_dark);
  check('עברית נשמרת', body.color_name_he === 'גוון בדיקה', body.color_name_he);

  const duplicate = await call('POST', PATH, validFormula());
  if (duplicate.status === 201) created.push(duplicate.body.id);
  check('color_code כפול → 409', duplicate.status === 409, `${duplicate.status} ${duplicate.body.error || ''}`);

  const noSort = await call('POST', PATH, { ...validFormula(), color_code: TEST_CODE + '_2', sort_order: undefined });
  created.push(noSort.body.id);
  check('בלי sort_order → 0', noSort.body.sort_order === 0, noSort.body.sort_order);

  return body.id;
}

/** בודק שכל קלט פסול נדחה בקוד 400. */
async function testValidation() {
  console.log('\n── ולידציה (הכל אמור להיחסם ב-400)');

  const cases = [
    ['בלי color_code', { ...validFormula(), color_code: '' }],
    ['color_code עם מקף', { ...validFormula(), color_code: 'sky-blue' }],
    ['color_code בעברית', { ...validFormula(), color_code: 'כחול' }],
    ['בלי שם בעברית', { ...validFormula(), color_name_he: '  ' }],
    ['hex בלי סולמית', { ...validFormula(), hex: 'A1B2C3' }],
    ['hex מקוצר', { ...validFormula(), hex: '#ABC' }],
    ['hex לא הקסדצימלי', { ...validFormula(), hex: '#GGGGGG' }],
    ['כמות אפס', { ...validFormula(), ml_per_liter_light: 0 }],
    ['כמות לא שלמה', { ...validFormula(), ml_per_liter_medium: 55.5 }],
    ['כמות מעל התקרה', { ...validFormula(), ml_per_liter_dark: 5000 }],
    ['כהה קטן מבהיר', { ...validFormula(), ml_per_liter_dark: 10 }],
    ['בינוני שווה לבהיר', { ...validFormula(), ml_per_liter_medium: 20 }],
    ['sort_order שלילי', { ...validFormula(), sort_order: -1 }],
  ];

  for (const [name, body] of cases) {
    const { status, body: res } = await call('POST', PATH, body);
    if (status === 201) created.push(res.id);
    check(name, status === 400, `${status} ${res.error || ''}`);
  }
}

/** בודק עדכון חלקי ואת הכללים שאסור לעקוף. */
async function testUpdate(id) {
  console.log('\n── עדכון');

  const partial = await call('PUT', `${PATH}/${id}`, { color_name_he: 'שם מעודכן' });
  check('עדכון חלקי משנה רק שדה אחד',
    partial.body.color_name_he === 'שם מעודכן' && partial.body.ml_per_liter_dark === 100 && partial.body.hex === '#A1B2C3',
    partial.body);

  const code = await call('PUT', `${PATH}/${id}`, { color_code: 'something_else' });
  check('color_code אינו ניתן לעריכה → 400', code.status === 400, `${code.status} ${code.body.error}`);

  const breaks = await call('PUT', `${PATH}/${id}`, { ml_per_liter_dark: 30 });
  check('כהה נמוך מבינוני הקיים → 400', breaks.status === 400, `${breaks.status} ${breaks.body.error}`);

  const ok = await call('PUT', `${PATH}/${id}`, { ml_per_liter_dark: 140 });
  check('עדכון כמות תקין עובר', ok.body.ml_per_liter_dark === 140, ok.body.ml_per_liter_dark);

  const together = await call('PUT', `${PATH}/${id}`, { ml_per_liter_light: 200, ml_per_liter_medium: 300, ml_per_liter_dark: 400 });
  check('עדכון שלושתם יחד נבדק כמכלול', together.body.ml_per_liter_light === 200, together.body);

  const empty = await call('PUT', `${PATH}/${id}`, {});
  check('בלי שדות → 400', empty.status === 400, empty.status);

  const missing = await call('PUT', `${PATH}/999999`, { color_name_he: 'x' });
  check('גוון שאינו קיים → 404', missing.status === 404, missing.status);
}

/** מוחק את כל מה שהבדיקה יצרה ומאמת שלא נשארו שאריות. */
async function cleanup(before) {
  console.log('\n── ניקוי ואימות שהנתונים האמיתיים לא נגעו');

  for (const id of created) {
    if (!id) continue;
    const { status } = await call('DELETE', `${PATH}/${id}`);
    check(`נמחק גוון בדיקה ${id}`, status === 200, status);
  }

  const twice = await call('DELETE', `${PATH}/${created[0]}`);
  check('מחיקה חוזרת → 404', twice.status === 404, twice.status);

  const after = (await call('GET', PATH)).body;
  check('אין שאריות בדיקה', !after.some((f) => f.color_code.startsWith('_smoke')), after.length);
  check('הגוונים האמיתיים זהים לחלוטין למצב ההתחלתי',
    JSON.stringify(before) === JSON.stringify(after),
    { before: before.length, after: after.length });
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  const before = await testList();
  await testRead(before);
  const id = await testCreate();
  await testValidation();
  await testUpdate(id);
  await cleanup(before);

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  for (const id of created) if (id) await call('DELETE', `${PATH}/${id}`).catch(() => {});
  process.exit(1);
});
