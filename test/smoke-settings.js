/**
 * בודק את הגדרות מסך הניהול: קריאה, כתיבה, ביטול ואימות.
 *
 * ההגדרה היחידה כרגע היא stats_counting_from — נקודת ההתחלה של סיכומי
 * לשונית הסטטיסטיקות. היא נשמרה עד כה ב-localStorage, ולכן עיקר הבדיקה
 * כאן הוא שהיא באמת מגיעה למסד וחוזרת ממנו: זה מה שמאפשר שאיפוס שנעשה
 * בטלפון ייראה גם במחשב שבחנות.
 *
 * הבדיקה מחזירה בסוף את הערך שהיה לפניה, כדי לא לאפס למי שמריץ אותה
 * את הסיכומים של המסך האמיתי.
 */
const { login } = require('./helpers');
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';
const PATH = '/settings/stats-counting-from';

let passed = 0;
let failed = 0;
let originalValue = null;

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
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authCookie) headers.Cookie = authCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** בודק קריאה של הגדרה שלא נקבעה, ומפתח שאינו קיים. */
async function testRead() {
  console.log('\n── קריאה');

  const res = await call('GET', PATH);
  check('200 על קריאה', res.status === 200, res.status);
  check('התשובה כוללת את המפתח', res.body.key === 'stats_counting_from', res.body.key);
  check('value קיים בתשובה (גם כשהוא null)', 'value' in res.body, res.body);

  originalValue = res.body.value;

  const unknown = await call('GET', '/settings/no-such-setting');
  check('מפתח שאינו קיים → 404', unknown.status === 404, `${unknown.status} ${unknown.body.error || ''}`);

  const unknownWrite = await call('PUT', '/settings/no-such-setting', { value: null });
  check('כתיבה למפתח שאינו קיים → 404', unknownWrite.status === 404, unknownWrite.status);
}

/** בודק שהערך נשמר במסד ונקרא ממנו — לא רק מוחזר מהבקשה. */
async function testWrite() {
  console.log('\n── כתיבה');

  const when = '2026-03-01T09:30:00.000Z';
  const saved = await call('PUT', PATH, { value: when });
  check('200 על כתיבה', saved.status === 200, saved.status);
  check('הערך שנשמר מוחזר', saved.body.value === when, saved.body.value);

  // הקריאה הזו היא העיקר: היא בקשה נפרדת, ולכן הערך חזר מהמסד ולא
  // מהזיכרון של הבקשה הקודמת. זה מה שמכשיר או דפדפן אחר יקבל.
  const read = await call('GET', PATH);
  check('הערך נקרא חזרה מהמסד', read.body.value === when, read.body.value);

  // כתיבה חוזרת מעדכנת ולא נכשלת על המפתח הראשי
  const later = '2026-04-15T12:00:00.000Z';
  const again = await call('PUT', PATH, { value: later });
  check('כתיבה חוזרת מעדכנת', again.status === 200 && again.body.value === later, again.body);

  const readAgain = await call('GET', PATH);
  check('הערך המעודכן נקרא חזרה', readAgain.body.value === later, readAgain.body.value);

  // תאריך בפורמט אחר מנורמל ל-ISO לפני השמירה
  const loose = await call('PUT', PATH, { value: '2026-05-20' });
  check('תאריך מנורמל ל-ISO', loose.body.value === '2026-05-20T00:00:00.000Z', loose.body.value);
}

/** בודק שהביטול מוחק את ההגדרה ומחזיר את התמונה המלאה. */
async function testClear() {
  console.log('\n── ביטול האיפוס');

  const cleared = await call('PUT', PATH, { value: null });
  check('200 על ביטול', cleared.status === 200, cleared.status);
  check('הביטול מחזיר null', cleared.body.value === null, cleared.body.value);

  const read = await call('GET', PATH);
  check('אחרי ביטול הקריאה מחזירה null', read.body.value === null, read.body.value);

  // מחרוזת ריקה היא אותו דבר — אין נקודת התחלה
  await call('PUT', PATH, { value: '2026-06-01T00:00:00.000Z' });
  const empty = await call('PUT', PATH, { value: '' });
  check('מחרוזת ריקה מבטלת גם היא', empty.body.value === null, empty.body.value);
}

/** בודק שכל קלט פסול נדחה ב-400 ואינו נכתב. */
async function testValidation() {
  console.log('\n── ולידציה (הכל אמור להיחסם ב-400)');

  const cases = [
    ['בלי שדה value', {}],
    ['תאריך לא תקין', { value: 'לא תאריך' }],
    ['מספר במקום תאריך', { value: 12345 }],
    ['אובייקט במקום תאריך', { value: { when: 'now' } }],
  ];

  for (const [name, body] of cases) {
    const res = await call('PUT', PATH, body);
    check(name, res.status === 400, `${res.status} ${res.body.error || ''}`);
  }

  const after = await call('GET', PATH);
  check('בקשה פסולה לא שינתה את ההגדרה', after.body.value === null, after.body.value);
}

/** מחזיר את ההגדרה למה שהייתה לפני הבדיקה. */
async function cleanup() {
  console.log('\n── ניקוי');
  const restore = await call('PUT', PATH, { value: originalValue });
  check('ההגדרה הוחזרה למצבה הקודם', restore.body.value === originalValue, restore.body.value);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  authCookie = await login(BASE.slice(0, -4));
  await testRead();
  await testWrite();
  await testClear();
  await testValidation();
  await cleanup();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('הבדיקה קרסה:', err);
  await call('PUT', PATH, { value: originalValue }).catch(() => {});
  process.exit(1);
});
