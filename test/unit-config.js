/**
 * בודק את כללי העלייה של server/config/env.js: מה גורם לשרת לסרב לעלות.
 *
 * כל מקרה רץ בתהליך נפרד, כי הקונפיגורציה נקראת פעם אחת בטעינה. הערכים
 * כאן מזויפים ונקבעים במפורש; dotenv אינו דורס משתנה שכבר קיים בסביבה,
 * ולכן מה שב-.env אינו משפיע על המקרים — הוא רק ממלא את מה שלא נקבע.
 */
const path = require('path');
const { spawnSync } = require('child_process');

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

const ENV_JS = path.join(__dirname, '../server/config/env.js');
const STRONG = 'correct-horse-battery';
const SECRET = 'a'.repeat(64);

/** טוען את הקונפיגורציה עם הסביבה הנתונה, ומחזיר הצליח / הודעת השגיאה. */
function load(overrides) {
  const run = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(ENV_JS)})`], {
    env: {
      ...process.env,
      DB_PASSWORD: 'test-db-password',
      MAIL_ENABLED: 'false',
      ADMIN_PASSWORD: STRONG,
      SESSION_SECRET: SECRET,
      ...overrides,
    },
    encoding: 'utf8',
  });
  return { ok: run.status === 0, message: run.stderr };
}

console.log('\n── ייצור');
const prod = load({ NODE_ENV: 'production' });
check('ייצור עם סוד וסיסמה של 12+ תווים — עולה', prod.ok, prod.message);

const noSecret = load({ NODE_ENV: 'production', SESSION_SECRET: '' });
check('ייצור בלי SESSION_SECRET — מסרב', !noSecret.ok && noSecret.message.includes('SESSION_SECRET'), noSecret.message);

const short = 'only11chars';
const shortPw = load({ NODE_ENV: 'production', ADMIN_PASSWORD: short });
check('ייצור עם סיסמת אדמין של 11 תווים — מסרב', !shortPw.ok && shortPw.message.includes('ADMIN_PASSWORD'), shortPw.message);
check('ההודעה אינה מדפיסה את הסיסמה', !shortPw.message.includes(short));

const exactly12 = load({ NODE_ENV: 'production', ADMIN_PASSWORD: 'x'.repeat(12) });
check('בדיוק 12 תווים — עולה', exactly12.ok, exactly12.message);

console.log('\n── פיתוח');
const dev = load({ NODE_ENV: 'development', ADMIN_PASSWORD: 'short', SESSION_SECRET: '' });
check('פיתוח עם סיסמה קצרה ובלי סוד — עולה (עם אזהרה)', dev.ok, dev.message);

console.log('\n── מייל');
const noMail = load({ MAIL_ENABLED: 'false', MAIL_USER: '', MAIL_PASS: '' });
check('MAIL_ENABLED=false בלי MAIL_USER / MAIL_PASS — עולה', noMail.ok, noMail.message);

const mailOn = load({ MAIL_ENABLED: 'true', MAIL_USER: '', MAIL_PASS: '' });
check('מייל פעיל בלי פרטי חשבון — מסרב ונוקב בשמות', !mailOn.ok
  && mailOn.message.includes('MAIL_USER') && mailOn.message.includes('MAIL_PASS'), mailOn.message);

/** Loads the configuration with the given environment and returns the values (P8.1 step C), or the failure. */
function loadValues(overrides) {
  const code = `const c = require(${JSON.stringify(ENV_JS)});`
    + 'console.log(JSON.stringify({ rateLimits: c.rateLimits, trustProxyHops: c.trustProxyHops }));';
  const run = spawnSync(process.execPath, ['-e', code], {
    env: {
      ...process.env,
      DB_PASSWORD: 'test-db-password',
      MAIL_ENABLED: 'false',
      ADMIN_PASSWORD: STRONG,
      SESSION_SECRET: SECRET,
      // the defaults are being tested: nothing from the machine's own environment may change them
      ORDER_RATE_MAX: '', ORDER_RATE_WINDOW_MS: '', REVIEW_RATE_MAX: '', REVIEW_RATE_WINDOW_MS: '', TRUST_PROXY_HOPS: '',
      ...overrides,
    },
    encoding: 'utf8',
  });
  return { ok: run.status === 0, message: run.stderr, values: run.status === 0 ? JSON.parse(run.stdout) : null };
}

console.log('\n── הגבלות קצב והגדרת ה-proxy');
{
  const dev = loadValues({ NODE_ENV: 'development' });
  check('ברירת המחדל: 10 הזמנות ל-15 דקות', dev.ok && dev.values.rateLimits.orders.max === 10
    && dev.values.rateLimits.orders.windowMs === 900000, dev.values);
  check('ברירת המחדל: 5 חוות דעת לשעה', dev.ok && dev.values.rateLimits.reviews.max === 5
    && dev.values.rateLimits.reviews.windowMs === 3600000, dev.values);
  check('TRUST_PROXY_HOPS בפיתוח: 0', dev.ok && dev.values.trustProxyHops === 0, dev.values);

  const prod = loadValues({ NODE_ENV: 'production' });
  check('TRUST_PROXY_HOPS בייצור: 1 (כמו קודם)', prod.ok && prod.values.trustProxyHops === 1, prod.values);

  const custom = loadValues({
    NODE_ENV: 'production', ORDER_RATE_MAX: '3', ORDER_RATE_WINDOW_MS: '60000',
    REVIEW_RATE_MAX: '2', REVIEW_RATE_WINDOW_MS: '120000', TRUST_PROXY_HOPS: '2',
  });
  check('המשתנים דורסים את ברירות המחדל', custom.ok && custom.values.rateLimits.orders.max === 3
    && custom.values.rateLimits.orders.windowMs === 60000 && custom.values.rateLimits.reviews.max === 2
    && custom.values.rateLimits.reviews.windowMs === 120000 && custom.values.trustProxyHops === 2, custom.values);

  const noProxy = loadValues({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' });
  check('TRUST_PROXY_HOPS=0 בייצור מכבה את האמון ב-proxy', noProxy.ok && noProxy.values.trustProxyHops === 0, noProxy.values);
  const devProxy = loadValues({ NODE_ENV: 'development', TRUST_PROXY_HOPS: '1' });
  check('TRUST_PROXY_HOPS=1 בפיתוח מתקבל', devProxy.ok && devProxy.values.trustProxyHops === 1, devProxy.values);

  for (const [name, overrides, key] of [
    ['ORDER_RATE_MAX=0', { ORDER_RATE_MAX: '0' }, 'ORDER_RATE_MAX'],
    ['ORDER_RATE_MAX=abc', { ORDER_RATE_MAX: 'abc' }, 'ORDER_RATE_MAX'],
    ['REVIEW_RATE_MAX=-1', { REVIEW_RATE_MAX: '-1' }, 'REVIEW_RATE_MAX'],
    ['REVIEW_RATE_MAX=1.5', { REVIEW_RATE_MAX: '1.5' }, 'REVIEW_RATE_MAX'],
    ['ORDER_RATE_WINDOW_MS=0', { ORDER_RATE_WINDOW_MS: '0' }, 'ORDER_RATE_WINDOW_MS'],
    ['ORDER_RATE_WINDOW_MS מעל יממה', { ORDER_RATE_WINDOW_MS: '86400001' }, 'ORDER_RATE_WINDOW_MS'],
    ['REVIEW_RATE_WINDOW_MS מעל יממה', { REVIEW_RATE_WINDOW_MS: '999999999999' }, 'REVIEW_RATE_WINDOW_MS'],
    ['TRUST_PROXY_HOPS=6', { TRUST_PROXY_HOPS: '6' }, 'TRUST_PROXY_HOPS'],
    ['TRUST_PROXY_HOPS=-1', { TRUST_PROXY_HOPS: '-1' }, 'TRUST_PROXY_HOPS'],
    ['TRUST_PROXY_HOPS=true', { TRUST_PROXY_HOPS: 'true' }, 'TRUST_PROXY_HOPS'],
  ]) {
    const bad = loadValues({ NODE_ENV: 'development', ...overrides });
    check(`${name} — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes(key), bad.message);
  }
  check('יממה בדיוק מתקבלת', loadValues({ ORDER_RATE_WINDOW_MS: '86400000' }).ok);
}

console.log('\n── דמי משלוח: לקוח, שרת ותיעוד');
{
  const fs = require('fs');
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const first = (text, pattern) => (text.match(pattern) || [])[1];

  const client = first(read('client/src/js/utils/delivery.js'), /export const DELIVERY_FEE = (\d+(?:\.\d+)?);/);
  const server = first(read('server/config/env.js'), /number\('DELIVERY_FEE', (\d+(?:\.\d+)?)/);
  const example = first(read('.env.example'), /^DELIVERY_FEE=(\d+(?:\.\d+)?)\s*$/m);

  check('הקבוע בלקוח (utils/delivery.js) נמצא', client !== undefined, client);
  check('ברירת המחדל בשרת (config/env.js) נמצאת', server !== undefined, server);
  check('הערך ב-.env.example נמצא', example !== undefined, example);
  check('הלקוח והשרת מסכימים על דמי המשלוח', client === server, { client, server });
  check('ו-.env.example מסכים איתם', example === server, { example, server });
  // KNOWN: בדיקה זו משווה קוד ותיעוד בלבד. DELIVERY_FEE שנדרס בסביבת הייצור לא נראה לה,
  // והלקוח לא יודע אותו בזמן ריצה — ראו את הפריט ב-.plan/000-backlog.md.
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
