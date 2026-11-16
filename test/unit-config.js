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
const PROD_ADMIN_URL = 'https://shop.example.com/admin';

/**
 * The variables every case starts from, so that nothing in the machine's own environment, or in the
 * local environment file the config loads, changes a case: that loader fills only what is not set,
 * and an empty value counts as set. An empty value means "not set" to the config.
 */
const BASE_ENV = {
  DB_PASSWORD: 'test-db-password',
  MAIL_ENABLED: 'false',
  ADMIN_PASSWORD: STRONG,
  SESSION_SECRET: SECRET,
  ADMIN_URL: PROD_ADMIN_URL,
  CORS_ORIGINS: '',
  DB_HOST: 'localhost',
  PORT: '',
  DB_PORT: '',
  SESSION_TTL_HOURS: '',
  LOGIN_WINDOW_MS: '',
};

/** טוען את הקונפיגורציה עם הסביבה הנתונה, ומחזיר הצליח / הודעת השגיאה. */
function load(overrides) {
  const run = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(ENV_JS)})`], {
    env: {
      ...process.env,
      ...BASE_ENV,
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

/**
 * Loads the configuration with the given environment and returns the values (never a secret), or
 * the failure. Used by the rate-limit and proxy cases (P8.1 step C) and the environment rules (step D).
 */
function loadValues(overrides) {
  const code = `const c = require(${JSON.stringify(ENV_JS)});`
    + 'console.log(JSON.stringify({ rateLimits: c.rateLimits, trustProxyHops: c.trustProxyHops,'
    + ' nodeEnv: c.nodeEnv, isProduction: c.isProduction, port: c.port, dbPort: c.db.port,'
    + ' ttlHours: c.auth.ttlHours, loginWindowMs: c.auth.loginWindowMs,'
    + ' corsOrigins: c.corsOrigins, adminUrl: c.adminUrl }));';
  const run = spawnSync(process.execPath, ['-e', code], {
    env: {
      ...process.env,
      ...BASE_ENV,
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

/*
 * P8.1 step D: the rules for the environment. In every case below NODE_ENV is given explicitly, or
 * is '' for "not set" (the config treats an empty value as unset, and the loader of the local
 * environment file cannot fill it in, because the key exists).
 */
console.log('\n── NODE_ENV');
{
  const unset = loadValues({ NODE_ENV: '' });
  check('NODE_ENV לא מוגדר — ברירת המחדל נשארת פיתוח', unset.ok && unset.values.nodeEnv === 'development'
    && unset.values.isProduction === false, unset.values || unset.message);

  for (const value of ['development', 'test', 'production']) {
    const ok = loadValues({ NODE_ENV: value });
    check(`NODE_ENV=${value} — מתקבל`, ok.ok && ok.values.nodeEnv === value && ok.values.isProduction === (value === 'production'),
      ok.values || ok.message);
  }

  for (const value of ['prod', 'Production', 'PRODUCTION', 'production ', ' production', 'dev', 'develop', 'staging', 'live', 'true', '1']) {
    const bad = loadValues({ NODE_ENV: value });
    check(`NODE_ENV="${value}" — מסרב ונוקב בשם המשתנה ובערכים המותרים`, !bad.ok && bad.message.includes('NODE_ENV')
      && bad.message.includes('development, test, production'), bad.message);
  }
}

console.log('\n── NODE_ENV לא מוגדר ו-DB_HOST לא מקומי');
{
  for (const host of ['db.example.com', '10.0.0.5', '192.168.1.20', 'example.internal', '::2', 'localhost.example.com']) {
    const bad = loadValues({ NODE_ENV: '', DB_HOST: host });
    check(`בלי NODE_ENV ועם DB_HOST=${host} — מסרב ונוקב בשני המשתנים`, !bad.ok
      && bad.message.includes('NODE_ENV') && bad.message.includes('DB_HOST'), bad.message);
    check(`ההודעה אינה מדפיסה את המארח ${host}`, !bad.ok && !bad.message.includes(host), bad.message);
  }

  for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '/var/run/postgresql', '']) {
    const ok = loadValues({ NODE_ENV: '', DB_HOST: host });
    check(`בלי NODE_ENV ועם DB_HOST="${host}" (מקומי או לא מוגדר) — עולה כפיתוח`, ok.ok && ok.values.nodeEnv === 'development',
      ok.values || ok.message);
  }

  for (const value of ['development', 'test']) {
    const ok = loadValues({ NODE_ENV: value, DB_HOST: 'db.example.com' });
    check(`NODE_ENV=${value} מפורש עם DB_HOST לא מקומי — עולה (הבדיקה אינה תחליף להגדרה, והיא נדלקת רק כשאין NODE_ENV)`, ok.ok, ok.message);
  }
  const prodRemote = loadValues({ NODE_ENV: 'production', DB_HOST: 'db.example.com' });
  check('NODE_ENV=production עם DB_HOST לא מקומי — עולה', prodRemote.ok, prodRemote.message);
}

console.log('\n── SESSION_SECRET בייצור');
{
  const SHORT_31 = 'Zq9'.repeat(10) + 'Z';
  const EXACT_32 = 'Zq9'.repeat(10) + 'ZZ';
  check('סוד של 31 תווים מכיל 31 תווים (הנחת הבדיקה)', SHORT_31.length === 31 && EXACT_32.length === 32);

  const short = loadValues({ NODE_ENV: 'production', SESSION_SECRET: SHORT_31 });
  check('בייצור, סוד של 31 תווים — מסרב ונוקב בשם המשתנה', !short.ok && short.message.includes('SESSION_SECRET'), short.message);
  check('ההודעה אינה מדפיסה את הסוד', !short.ok && !short.message.includes(SHORT_31) && !short.message.includes('Zq9'), short.message);

  const exact = loadValues({ NODE_ENV: 'production', SESSION_SECRET: EXACT_32 });
  check('בייצור, סוד של 32 תווים בדיוק — עולה', exact.ok, exact.message);

  const one = loadValues({ NODE_ENV: 'production', SESSION_SECRET: 'x' });
  check('בייצור, סוד של תו אחד — מסרב', !one.ok && one.message.includes('SESSION_SECRET'), one.message);

  const none = loadValues({ NODE_ENV: 'production', SESSION_SECRET: '' });
  check('בייצור, בלי סוד — עדיין מסרב ונוקב בשם המשתנה', !none.ok && none.message.includes('SESSION_SECRET'), none.message);

  const dev = loadValues({ NODE_ENV: 'development', SESSION_SECRET: 'short' });
  check('בפיתוח סוד קצר מתקבל', dev.ok, dev.message);
  const test = loadValues({ NODE_ENV: 'test', SESSION_SECRET: 'short' });
  check('ב-test סוד קצר מתקבל', test.ok, test.message);
}

console.log('\n── ADMIN_URL בייצור');
{
  const LEAKY = 'http://secret-host.example.com/admin?token=abc123';
  const missing = loadValues({ NODE_ENV: 'production', ADMIN_URL: '' });
  check('בייצור בלי ADMIN_URL — מסרב ונוקב בשם המשתנה', !missing.ok && missing.message.includes('ADMIN_URL'), missing.message);

  for (const value of [LEAKY, 'http://shop.example.com/admin', 'shop.example.com/admin', 'ftp://shop.example.com', 'https://', 'https:', '//shop.example.com', 'not a url', 'javascript:alert(1)']) {
    const bad = loadValues({ NODE_ENV: 'production', ADMIN_URL: value });
    check(`בייצור, ADMIN_URL="${value}" — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes('ADMIN_URL'), bad.message);
  }
  const leaked = loadValues({ NODE_ENV: 'production', ADMIN_URL: LEAKY });
  check('ההודעה אינה מדפיסה את הכתובת', !leaked.ok && !leaked.message.includes('secret-host') && !leaked.message.includes('abc123'), leaked.message);

  for (const value of ['https://shop.example.com/admin', 'https://shop.example.com', 'https://shop.example.com:8443/admin', 'https://localhost/admin']) {
    const ok = loadValues({ NODE_ENV: 'production', ADMIN_URL: value });
    check(`בייצור, ADMIN_URL=${value} — מתקבל`, ok.ok && ok.values.adminUrl === value, ok.values || ok.message);
  }

  for (const value of ['http://localhost:3000/admin', 'http://shop.example.com/admin', '']) {
    const ok = loadValues({ NODE_ENV: 'development', ADMIN_URL: value });
    check(`בפיתוח, ADMIN_URL="${value}" — מתקבל (כמו קודם)`, ok.ok, ok.message);
  }
}

console.log('\n── CORS_ORIGINS');
{
  const exact = loadValues({ NODE_ENV: 'development', CORS_ORIGINS: 'https://a.com,http://localhost:3000, https://b.example.com:8443 ,' });
  check('רשימת origins מדויקים (עם רווחים ופסיק מיותר) — מתקבלת', exact.ok
    && JSON.stringify(exact.values.corsOrigins) === JSON.stringify(['https://a.com', 'http://localhost:3000', 'https://b.example.com:8443']),
  exact.values || exact.message);
  const empty = loadValues({ NODE_ENV: 'development', CORS_ORIGINS: '' });
  check('CORS_ORIGINS ריק — מתקבל, בלי origins', empty.ok && empty.values.corsOrigins.length === 0, empty.values || empty.message);
  const prodOk = loadValues({ NODE_ENV: 'production', CORS_ORIGINS: 'https://shop.example.com' });
  check('בייצור, origin מדויק — מתקבל', prodOk.ok, prodOk.message);

  for (const value of [
    '*', 'a.com', 'https://a.com/', 'https://a.com/path', 'https://a.com?x=1', 'https://a.com#top', 'ftp://a.com',
    'https://a.com:443', 'http://a.com:80', 'https://A.com', 'null', 'https://', 'https://user@a.com', 'https://a.com,*',
    'https://a.com,b.com', 'https://a.com https://b.com',
  ]) {
    for (const nodeEnv of ['development', 'production']) {
      const bad = loadValues({ NODE_ENV: nodeEnv, CORS_ORIGINS: value });
      check(`${nodeEnv}: CORS_ORIGINS="${value}" — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes('CORS_ORIGINS'), bad.message);
    }
  }
  const second = loadValues({ NODE_ENV: 'development', CORS_ORIGINS: 'https://a.com,b.com' });
  check('ההודעה מציינת איזו רשומה שגויה (מספר סידורי)', !second.ok && /הרשומה 2\b/.test(second.message), second.message);
}

console.log('\n── PORT ו-DB_PORT');
{
  for (const key of ['PORT', 'DB_PORT']) {
    for (const value of ['1', '80', '3000', '5432', '65535']) {
      const ok = loadValues({ NODE_ENV: 'development', [key]: value });
      const got = key === 'PORT' ? ok.values && ok.values.port : ok.values && ok.values.dbPort;
      check(`${key}=${value} — מתקבל`, ok.ok && got === Number(value), ok.values || ok.message);
    }
    for (const value of ['0', '-1', '65536', '70000', '99999999', 'abc', '1.5', '3000x']) {
      const bad = loadValues({ NODE_ENV: 'development', [key]: value });
      check(`${key}=${value} — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes(key), bad.message);
    }
  }
  const defaults = loadValues({ NODE_ENV: 'development' });
  check('ברירות המחדל: PORT 3000, DB_PORT 5432', defaults.ok && defaults.values.port === 3000 && defaults.values.dbPort === 5432, defaults.values);
}

console.log('\n── SESSION_TTL_HOURS');
{
  for (const value of ['1', '12', '24', '167', '168']) {
    const ok = loadValues({ NODE_ENV: 'development', SESSION_TTL_HOURS: value });
    check(`SESSION_TTL_HOURS=${value} — מתקבל`, ok.ok && ok.values.ttlHours === Number(value), ok.values || ok.message);
  }
  for (const value of ['169', '720', '1e3', '0', '-1', '1.5', 'abc']) {
    const bad = loadValues({ NODE_ENV: 'development', SESSION_TTL_HOURS: value });
    check(`SESSION_TTL_HOURS=${value} — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes('SESSION_TTL_HOURS'), bad.message);
  }
  const prodMax = loadValues({ NODE_ENV: 'production', SESSION_TTL_HOURS: '169' });
  check('הגבלה חלה גם בייצור', !prodMax.ok && prodMax.message.includes('SESSION_TTL_HOURS'), prodMax.message);
  const defaults = loadValues({ NODE_ENV: 'development' });
  check('ברירת המחדל נשארת 12 שעות', defaults.ok && defaults.values.ttlHours === 12, defaults.values);
}

console.log('\n── LOGIN_WINDOW_MS');
{
  for (const value of ['1', '2000', '900000', '86400000']) {
    const ok = loadValues({ NODE_ENV: 'development', LOGIN_WINDOW_MS: value });
    check(`LOGIN_WINDOW_MS=${value} — מתקבל`, ok.ok && ok.values.loginWindowMs === Number(value), ok.values || ok.message);
  }
  for (const value of ['86400001', '2147483648', '999999999999', '0', '-1', 'abc', '1.5']) {
    const bad = loadValues({ NODE_ENV: 'development', LOGIN_WINDOW_MS: value });
    check(`LOGIN_WINDOW_MS=${value} — מסרב ונוקב בשם המשתנה`, !bad.ok && bad.message.includes('LOGIN_WINDOW_MS'), bad.message);
  }
  const defaults = loadValues({ NODE_ENV: 'development' });
  check('ברירת המחדל נשארת 15 דקות', defaults.ok && defaults.values.loginWindowMs === 900000, defaults.values);
  const prodDefaults = loadValues({ NODE_ENV: 'production' });
  check('TRUST_PROXY_HOPS בייצור נשאר 1, ובפיתוח 0 (שלב C לא השתנה)', prodDefaults.ok && prodDefaults.values.trustProxyHops === 1
    && defaults.values.trustProxyHops === 0, [prodDefaults.values, defaults.values]);
}

console.log('\n── כמה בעיות יחד ושמירה על סודות');
{
  const SECRET_TEXT = 'Zq9short-secret';
  const PASSWORD_TEXT = 'Pw-short-1';
  const many = loadValues({
    NODE_ENV: 'production', SESSION_SECRET: SECRET_TEXT, ADMIN_PASSWORD: PASSWORD_TEXT,
    ADMIN_URL: 'http://shop.example.com/admin', CORS_ORIGINS: 'https://a.com/',
  });
  check('כל הבעיות מדווחות בהודעה אחת', !many.ok && ['SESSION_SECRET', 'ADMIN_PASSWORD', 'ADMIN_URL', 'CORS_ORIGINS']
    .every((name) => many.message.includes(name)), many.message);
  check('ואף סוד אינו מודפס', !many.ok && !many.message.includes(SECRET_TEXT) && !many.message.includes(PASSWORD_TEXT)
    && !many.message.includes('test-db-password'), many.message);

  const everything = loadValues({ NODE_ENV: '', DB_HOST: 'db.example.com', CORS_ORIGINS: '*', SESSION_SECRET: SECRET_TEXT });
  check('בלי NODE_ENV, עם מארח מרוחק ו-origin שגוי — שתי הבעיות יחד',
    !everything.ok && everything.message.includes('DB_HOST') && everything.message.includes('CORS_ORIGINS'), everything.message);
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
