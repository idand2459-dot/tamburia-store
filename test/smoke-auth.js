/**
 * בדיקות לאימות האדמין: התחברות, הגנה על הנתיבים והגבלת קצב.
 */
const BASE = (process.env.NEW_URL || 'http://127.0.0.1:3100') + '/api';
const PASSWORD = process.env.ADMIN_PASSWORD;

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

/** שולח בקשה ל-API עם עוגייה אופציונלית ומחזיר סטטוס, גוף ועוגיות. */
async function call(method, path, { body, cookie } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.status,
    body: await res.json().catch(() => ({})),
    setCookie: res.headers.getSetCookie?.() || [],
  };
}

/** מחלץ את ערך עוגיית ההתחברות מכותרות Set-Cookie. */
function sessionCookie(setCookie) {
  const raw = setCookie.find((c) => c.startsWith('tamburia_admin='));
  return raw ? raw.split(';')[0] : null;
}

/** בודק את מסלול ההתחברות ואת תכונות העוגייה. */
async function testLogin() {
  console.log('\n── התחברות');

  const empty = await call('POST', '/auth/login', { body: {} });
  check('בלי סיסמה → 400', empty.status === 400, empty.status);

  const wrong = await call('POST', '/auth/login', { body: { password: 'לא נכון' } });
  check('סיסמה שגויה → 401', wrong.status === 401, wrong.status);
  check('סיסמה שגויה לא מחזירה עוגייה', sessionCookie(wrong.setCookie) === null, wrong.setCookie);

  const ok = await call('POST', '/auth/login', { body: { password: PASSWORD } });
  check('סיסמה נכונה → 200', ok.status === 200, ok.status);
  check('התשובה מסמנת התחברות', ok.body.authenticated === true, ok.body);

  const raw = ok.setCookie.find((c) => c.startsWith('tamburia_admin='));
  check('העוגייה httpOnly', /HttpOnly/i.test(raw), raw);
  check('העוגייה SameSite=Strict', /SameSite=Strict/i.test(raw), raw);
  check('האסימון אינו בגוף התשובה', !JSON.stringify(ok.body).includes('.'), ok.body);

  return sessionCookie(ok.setCookie);
}

/** בודק שנתיבי הכתיבה חסומים בלי אסימון ופתוחים איתו. */
async function testProtectedRoutes(cookie) {
  console.log('\n── נתיבים מוגנים');

  const guarded = [
    ['POST', '/products', { name: 'בדיקה' }],
    ['PUT', '/products/1', { name: 'בדיקה' }],
    ['DELETE', '/products/1', null],
    ['GET', '/orders', null],
    ['GET', '/orders/stats', null],
    ['PUT', '/orders/1/status', { status: 'new' }],
    ['DELETE', '/orders/1', null],
    ['GET', '/reviews/all', null],
    ['PUT', '/reviews/1/approve', { approved: true }],
    ['DELETE', '/reviews/1', null],
    ['POST', '/pigment-formulas', {}],
    ['PUT', '/pigment-formulas/1', {}],
    ['DELETE', '/pigment-formulas/1', null],
    ['POST', '/upload', null],
    ['POST', '/upload-multiple', null],
    ['GET', '/auth/me', null],
  ];

  for (const [method, path, body] of guarded) {
    const res = await call(method, path, { body });
    check(`${method} ${path} בלי אסימון → 401`, res.status === 401, `${res.status} ${res.body.error || ''}`);
  }

  const me = await call('GET', '/auth/me', { cookie });
  check('GET /auth/me עם אסימון → 200', me.status === 200 && me.body.authenticated, me.body);

  const orders = await call('GET', '/orders', { cookie });
  check('GET /orders עם אסימון → 200', orders.status === 200 && Array.isArray(orders.body), orders.status);
}

/** בודק שהנתיבים הציבוריים נשארו פתוחים ללקוחות. */
async function testPublicRoutes() {
  console.log('\n── נתיבים ציבוריים נשארו פתוחים');

  const open = [
    ['GET', '/products'],
    ['GET', '/products/categories'],
    ['GET', '/reviews'],
    ['GET', '/reviews/stats'],
    ['GET', '/pigment-formulas'],
    ['GET', '/orders/by-phone/0501234567'],
    ['GET', '/health'],
  ];

  for (const [method, path] of open) {
    const res = await call(method, path);
    check(`${method} ${path} → 200`, res.status === 200, res.status);
  }

  const order = await call('POST', '/orders', { body: {} });
  check('POST /orders נגיש ללקוח (400 על גוף ריק, לא 401)', order.status === 400, order.status);

  const review = await call('POST', '/reviews', { body: {} });
  check('POST /reviews נגיש ללקוח (400 על גוף ריק, לא 401)', review.status === 400, review.status);
}

/** בודק שאסימון מזויף או פגום נדחה. */
async function testBadTokens() {
  console.log('\n── אסימונים פסולים');

  const cases = [
    ['ערך אקראי', 'tamburia_admin=notatoken'],
    ['חתימה מזויפת', 'tamburia_admin=eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.AAAA'],
    ['בלי חתימה', 'tamburia_admin=eyJzdWIiOiJhZG1pbiJ9'],
    ['עוגייה ריקה', 'tamburia_admin='],
  ];

  for (const [name, cookie] of cases) {
    const res = await call('GET', '/auth/me', { cookie });
    check(`${name} → 401`, res.status === 401, res.status);
  }
}

/** בודק שניתוק מבטל את העוגייה. */
async function testLogout(cookie) {
  console.log('\n── ניתוק');

  const out = await call('POST', '/auth/logout', { cookie });
  check('ניתוק → 200', out.status === 200, out.status);

  const cleared = out.setCookie.find((c) => c.startsWith('tamburia_admin='));
  check('העוגייה מתבטלת', /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(cleared), cleared);

  const withoutCookie = await call('POST', '/auth/logout');
  check('ניתוק בלי התחברות → 200', withoutCookie.status === 200, withoutCookie.status);
}

/** בודק שרצף ניחושים נחסם ושהתחברות תקינה מאפסת את המונה. */
async function testRateLimit() {
  console.log('\n── הגבלת קצב');

  let blocked = null;
  for (let i = 0; i < 15; i++) {
    const res = await call('POST', '/auth/login', { body: { password: 'ניחוש' } });
    if (res.status === 429) { blocked = { attempt: i + 1, body: res.body }; break; }
  }

  check('ניחושים חוזרים נחסמים ב-429', blocked !== null, 'לא נחסם אחרי 15 ניסיונות');
  if (blocked) check('החסימה מגיעה אחרי 10 ניסיונות', blocked.attempt === 11, blocked.attempt);

  const correct = await call('POST', '/auth/login', { body: { password: PASSWORD } });
  check('החסימה חלה גם על הסיסמה הנכונה', correct.status === 429, correct.status);
}

/** מריץ את כל הבדיקות לפי הסדר. */
async function main() {
  if (!PASSWORD) throw new Error('חסר ADMIN_PASSWORD בסביבה');

  const cookie = await testLogin();
  await testProtectedRoutes(cookie);
  await testPublicRoutes();
  await testBadTokens();
  await testLogout(cookie);
  await testRateLimit();

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
