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
      DATABASE_URL: '',
      DB_HOST: 'localhost',
      DB_POOL_MAX: '',
      STORAGE_DRIVER: '',
      CLOUDINARY_URL: '',
      SITE_MODE: '',
      ...overrides,
    },
    encoding: 'utf8',
  });
  return { ok: run.status === 0, message: run.stderr, stdout: run.stdout };
}

/** Loads the configuration and returns the JSON of one expression over it. */
function read(overrides, expression) {
  const run = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(ENV_JS)}); console.log(JSON.stringify(${expression}))`], {
    env: {
      ...process.env,
      DB_PASSWORD: 'test-db-password',
      MAIL_ENABLED: 'false',
      ADMIN_PASSWORD: STRONG,
      SESSION_SECRET: SECRET,
      DATABASE_URL: '',
      DB_HOST: 'localhost',
      DB_POOL_MAX: '',
      STORAGE_DRIVER: '',
      CLOUDINARY_URL: '',
      SITE_MODE: '',
      ...overrides,
    },
    encoding: 'utf8',
  });
  return run.status === 0 ? JSON.parse(run.stdout) : { error: run.stderr };
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

console.log('\n── DATABASE_URL');
const FAKE_URL = 'postgresql://app_user:p%40ss@db.example.test:5433/shopdb';
const urlOnly = load({ DATABASE_URL: FAKE_URL, DB_PASSWORD: '' });
check('DATABASE_URL בלי DB_PASSWORD — עולה', urlOnly.ok, urlOnly.message);

const parsed = read({ DATABASE_URL: FAKE_URL, DB_HOST: 'ignored-host' }, '[c.db.host, c.db.port, c.db.name, c.db.user, c.db.password]');
check('DATABASE_URL גובר על DB_* ומפוענח לשדות',
  JSON.stringify(parsed) === JSON.stringify(['db.example.test', 5433, 'shopdb', 'app_user', 'p@ss']), parsed);

const notUrl = 'definitely not a url, secret-token-123';
const badUrl = load({ DATABASE_URL: notUrl });
check('DATABASE_URL לא תקין — מסרב ונוקב בשם המשתנה', !badUrl.ok && badUrl.message.includes('DATABASE_URL'), badUrl.message);
check('ההודעה אינה מדפיסה את ערך המשתנה', !badUrl.message.includes('secret-token-123'));

const wrongScheme = load({ DATABASE_URL: 'mysql://u:p@host/db' });
check('DATABASE_URL שאינו postgres — מסרב', !wrongScheme.ok && wrongScheme.message.includes('DATABASE_URL'), wrongScheme.message);

console.log('\n── SSL וגודל ה-pool');
check('מארח מקומי — בלי SSL', read({}, 'c.db.ssl') === false);
check('מארח מרוחק — SSL פעיל', read({ DB_HOST: 'db.example.test' }, 'c.db.ssl') === true);
check('DATABASE_URL מרוחק — SSL פעיל', read({ DATABASE_URL: FAKE_URL }, 'c.db.ssl') === true);
check('DB_POOL_MAX ברירת מחדל 10', read({}, 'c.db.poolMax') === 10);
check('DB_POOL_MAX=5 — 5', read({ DB_POOL_MAX: '5' }, 'c.db.poolMax') === 5);
const badPool = load({ DB_POOL_MAX: '0' });
check('DB_POOL_MAX=0 — מסרב', !badPool.ok && badPool.message.includes('DB_POOL_MAX'), badPool.message);

console.log('\n── אחסון תמונות');
check('STORAGE_DRIVER ברירת מחדל local', read({}, 'c.storage.driver') === 'local');
const badDriver = load({ STORAGE_DRIVER: 's3' });
check('STORAGE_DRIVER לא מוכר — מסרב', !badDriver.ok && badDriver.message.includes('STORAGE_DRIVER'), badDriver.message);
const noCloud = load({ STORAGE_DRIVER: 'cloudinary' });
check('cloudinary בלי CLOUDINARY_URL — מסרב ונוקב בשם', !noCloud.ok && noCloud.message.includes('CLOUDINARY_URL'), noCloud.message);
const cloud = load({ STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: 'cloudinary://fake-key:fake-secret@fake-cloud' });
check('cloudinary עם CLOUDINARY_URL — עולה', cloud.ok, cloud.message);
check('local לא דורש CLOUDINARY_URL', load({ STORAGE_DRIVER: 'local' }).ok);

console.log('\n── מצב האתר');
check('SITE_MODE ברירת מחדל open', read({}, 'c.siteMode') === 'open');
for (const mode of ['open', 'catalog', 'closed']) {
  check(`SITE_MODE=${mode} — עולה`, read({ SITE_MODE: mode }, 'c.siteMode') === mode);
}
const badMode = load({ SITE_MODE: 'maintenance' });
check('SITE_MODE לא מוכר — מסרב ונוקב בשם', !badMode.ok && badMode.message.includes('SITE_MODE'), badMode.message);

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
