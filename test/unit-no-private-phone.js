/**
 * Keeps a real mobile phone number out of the repository: source, tests, docs, plans and the built client.
 *
 * It is an ALLOWLIST. It does not search for one particular number (that would mean storing the number here
 * in some form, which is exactly what it must never do). Instead every Israeli mobile-looking number found in
 * the files below must be on one of three explicit lists, otherwise the test fails and names the file:
 *
 *   1. Fictional shapes: the unassigned 05X-00000xx block (demo and test data), the obvious placeholders
 *      05X-1234567 and 05X-7654321, and seven equal digits.
 *   2. APPROVED_FIXTURES: exact test fixtures that a human reviewed and confirmed are invented.
 *   3. PUBLIC_MOBILE_NUMBERS: a mobile number the store itself publishes (for example a WhatsApp line).
 *      It is empty today; the public store telephone is a landline and is not matched at all.
 *
 * Scope: files in this repository only. It never sees runtime data, so a customer's phone number typed into
 * the checkout, stored in the database, or sent in an email is unaffected. Landlines (02-09), 1-700 numbers,
 * ids, timestamps, prices, SKUs and barcodes are not matched, because a match needs 05X plus exactly seven
 * more digits, with no digit on either side.
 *
 * Adding a number: put it in the right list below, with a comment saying why it is safe to publish.
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

/** Records one check. */
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

/**
 * An Israeli mobile number: 05X and seven more digits, in the local or the +972 form, with at most one
 * separator (hyphen, dot, space, no-break space or an RTL mark) between digits and no digit on either side.
 */
const MOBILE = /(?<!\d)(?:\+?972[-.\s]?|0)(5\d)((?:[-.\s\u00a0\u200e\u200f]?\d){7})(?!\d)/g;

/** The seven-digit subscriber part is fictional when it has one of these shapes. */
const FICTIONAL_SHAPES = [
  (tail) => /^00000\d\d$/.test(tail),
  (tail) => tail === '1234567',
  (tail) => tail === '7654321',
  (tail) => /^(\d)\1{6}$/.test(tail),
];

/** Exact invented fixtures that match no fictional shape. Empty: every fixture uses a fictional shape. Reviewed by the owner; each addition needs a reason. */
const APPROVED_FIXTURES = new Set([
]);

/** Mobile numbers the store publishes on purpose. Empty: the public store telephone is a landline. */
const PUBLIC_MOBILE_NUMBERS = new Set([]);

/** Returns the mobile numbers (as 10 local digits) found in a text. */
function mobileNumbersIn(text) {
  const found = [];
  for (const match of text.matchAll(MOBILE)) {
    found.push('0' + match[1] + match[2].replace(/\D/g, ''));
  }
  return found;
}

/** Whether a number may appear in the repository. */
function isAllowed(local) {
  return FICTIONAL_SHAPES.some((shape) => shape(local.slice(3)))
    || APPROVED_FIXTURES.has(local)
    || PUBLIC_MOBILE_NUMBERS.has(local);
}

const TEXT_EXT = new Set(['.js', '.jsx', '.json', '.html', '.css', '.txt', '.md', '.mdc', '.map', '.svg', '.xml', '.webmanifest', '.csv', '.yml', '.yaml', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'build', 'coverage', '.git']);

/** Lists the text files under a path (a directory or a single file), skipping dependencies and build output. */
function listFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return TEXT_EXT.has(path.extname(target).toLowerCase()) ? [target] : [];
  const found = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full));
    else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

/** Files (relative paths) under the given paths that hold a mobile number which is not allowed. */
function violations(targets, { includeBuild = false } = {}) {
  const hits = [];
  const files = targets.flatMap((target) => (includeBuild ? listBuild(target) : listFiles(target)));
  for (const file of files) {
    const bad = mobileNumbersIn(fs.readFileSync(file, 'utf8')).filter((n) => !isAllowed(n));
    if (bad.length > 0) hits.push(`${path.relative(ROOT, file)} (${bad.length})`);
  }
  return hits;
}

/** Like listFiles, but for the build directory, which listFiles skips by name. */
function listBuild(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listBuild(full));
    else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

console.log('\n── המזהה עצמו (בדיקות עצמיות, בלי מספר אמיתי)');
// A number that is on no list, built from arithmetic so that no real number is written in this file.
const SUBSCRIBER = String((1234567 * 7919) % 10000000).padStart(7, '0');
const UNLISTED = '052' + SUBSCRIBER;
check('המספר לדוגמה אינו ברשימה', !isAllowed(UNLISTED) && !FICTIONAL_SHAPES.some((s) => s(SUBSCRIBER)), UNLISTED.length);
const forms = [
  UNLISTED,
  `${UNLISTED.slice(0, 3)}-${UNLISTED.slice(3)}`,
  `${UNLISTED.slice(0, 3)}-${UNLISTED.slice(3, 6)}-${UNLISTED.slice(6)}`,
  `${UNLISTED.slice(0, 3)}-${UNLISTED.slice(3, 6)}-${UNLISTED.slice(6, 8)}-${UNLISTED.slice(8)}`,
  `${UNLISTED.slice(0, 3)} ${UNLISTED.slice(3)}`,
  `+972${UNLISTED.slice(1)}`,
  `972${UNLISTED.slice(1)}`,
  `+972-${UNLISTED.slice(1, 3)}-${UNLISTED.slice(3, 6)}-${UNLISTED.slice(6)}`,
  `tel:+972${UNLISTED.slice(1)}`,
  `wa.me/972${UNLISTED.slice(1)}`,
];
for (const form of forms) {
  check(`נתפס בצורה ${form.replace(/\d/g, 'N')}`, mobileNumbersIn(`x ${form} y`).includes(UNLISTED), mobileNumbersIn(form));
}
check('מספר ברשימת הצורות הבדויות מותר', ['0500000012', '0521234567', '0517654321', '0513333333'].every(isAllowed), null);
check('מספר מאושר ידנית מותר', [...APPROVED_FIXTURES].every(isAllowed), null);
check('קו קבוע ציבורי אינו נתפס', mobileNumbersIn('טלפון 03-1234567, 02-5551234, 1-700-555-123').length === 0, mobileNumbersIn('03-1234567'));
for (const sample of ['1773797323570', '2026-11-16', 'SKU 87039/1', '99999999.99', '7290000000012', '0501234567890', 'id 12345678901', 'a1b2c3d4-0000-4000-8000-000000000000']) {
  check(`ערך שאינו טלפון אינו נתפס: ${sample.replace(/\d/g, 'N')}`, mobileNumbersIn(sample).length === 0, mobileNumbersIn(sample));
}

console.log('\n── קוד המקור והמסמכים');
const dirs = (names) => names.map((n) => path.join(ROOT, n));
check('הקליינט (src ו-public) נקי', violations(dirs(['client/src', 'client/public'])).length === 0, violations(dirs(['client/src', 'client/public'])));
check('השרת ותבניות המייל נקיים', violations(dirs(['server'])).length === 0, violations(dirs(['server'])));
check('נתוני הבדיקה (test/) נקיים', violations([__dirname]).length === 0, violations([__dirname]));
check('הסקריפטים (scripts/) נקיים', violations(dirs(['scripts'])).length === 0, violations(dirs(['scripts'])));
check('המסמכים והתוכניות נקיים', violations(dirs(['docs', '.doc', '.plan', '.github', 'README.md', 'SETUP.md', 'AGENTS.md', 'CLAUDE.md'])).length === 0, violations(dirs(['docs', '.doc', '.plan', '.github', 'README.md', 'SETUP.md', 'AGENTS.md', 'CLAUDE.md'])));

console.log('\n── הבילד');
const buildDir = path.join(ROOT, 'client', 'build');
if (fs.existsSync(buildDir)) {
  const hits = violations([buildDir], { includeBuild: true });
  check('client/build נקי', hits.length === 0, hits);
} else {
  console.log('  – אין client/build, הבילד לא נבדק (npm run build:client יוצר אותו)');
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exit(failed === 0 ? 0 : 1);
