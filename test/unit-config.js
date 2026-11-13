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
