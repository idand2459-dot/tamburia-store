/**
 * שומר שסודות לא ייכנסו לגיט בטעות.
 *
 *   1. .env אינו במעקב, וגם אף קובץ .env.* אחר מלבד הדוגמאות המותרות.
 *   2. ב-.env.example כל משתנה סודי ריק — placeholder בלבד.
 *   3. אם יש .env מקומי: אף ערך סודי ממנו אינו מופיע באף קובץ במעקב.
 *
 * ההודעות נוקבות בשם המשתנה ובשם הקובץ בלבד. ערך לעולם אינו מודפס.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

const ROOT = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

// קבצי סביבה שמותר שיהיו במעקב, כי אין בהם סוד
const ALLOWED_ENV_FILES = ['.env.example', 'client/.env.development'];
const SECRET_KEY = /PASS|SECRET|TOKEN|KEY|DATABASE_URL/;

/** מפרק קובץ .env לזוגות [מפתח, ערך]. */
function parseEnv(text) {
  return text.split(/\r?\n/)
    .filter((line) => /^\s*[A-Z_][A-Z0-9_]*\s*=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    });
}

console.log('\n── קבצי סביבה במעקב');
check('git ls-files .env — ריק', git('ls-files', '.env').trim() === '');

const envFiles = git('ls-files').split('\n')
  .filter((f) => /(^|\/)\.env(\.|$)/.test(f))
  .filter((f) => !ALLOWED_ENV_FILES.includes(f));
check('אין קבצי .env אחרים במעקב', envFiles.length === 0, envFiles);

console.log('\n── .env.example');
const example = parseEnv(fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'));
const filled = example.filter(([key, value]) => SECRET_KEY.test(key) && value !== '').map(([key]) => key);
check('כל משתנה סודי ב-.env.example ריק', filled.length === 0, filled);

console.log('\n── ערכים מה-.env המקומי');
const envPath = path.join(ROOT, '.env');
if (!fs.existsSync(envPath)) {
  console.log('  — אין .env מקומי, אין מה להשוות');
} else {
  // ערך קצר מ-8 תווים אינו נבדק: הוא היה תואם מספרים ומילים מקריים
  // בקוד ובנתונים, והבדיקה הייתה נכשלת בלי שום דליפה.
  const secrets = parseEnv(fs.readFileSync(envPath, 'utf8'))
    .filter(([key, value]) => SECRET_KEY.test(key) && value.length >= 8);

  for (const [key, value] of secrets) {
    let files = [];
    try {
      files = git('grep', '-l', '-F', '-e', value, '--', '.').trim().split('\n').filter(Boolean);
    } catch {
      files = []; // git grep יוצא ב-1 כשאין התאמה
    }
    check(`הערך של ${key} אינו באף קובץ במעקב`, files.length === 0, files);
  }
}

console.log('\n── TLS של PostgreSQL');
{
  // Nothing may switch certificate verification off, in the server, the scripts or the tests. The
  // patterns are built from pieces so that this file does not match itself.
  const FORBIDDEN = [
    new RegExp('reject' + 'Unauthorized\\s*:\\s*false'),
    new RegExp('NODE_TLS_' + 'REJECT_UNAUTHORIZED'),
  ];

  /** Every .js, .mjs and .cjs file under a directory (node_modules excluded). */
  const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(?:js|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });

  const offenders = ['server', 'scripts', 'test']
    .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
    .filter((file) => file !== __filename)
    .filter((file) => FORBIDDEN.some((pattern) => pattern.test(fs.readFileSync(file, 'utf8'))))
    .map((file) => path.relative(ROOT, file));
  check('אין כיבוי של אימות תעודת TLS ב-server, scripts ו-test', offenders.length === 0, offenders);

  const db = fs.readFileSync(path.join(ROOT, 'server/config/db.js'), 'utf8');
  check('db.js מעביר ssl עם אימות מלא כש-DB_SSL פעיל',
    /ssl:\s*\{\s*rejectUnauthorized:\s*true\s*\}/.test(db));
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
