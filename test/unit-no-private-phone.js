/**
 * שומר שהפלאפון האישי של בעל החנות לא יופיע בשום מקום ציבורי: לא בקוד
 * הקליינט, לא בקבצים הסטטיים שלו, לא בתבניות המייל שנשלחות ללקוחות, ולא
 * בבילד המוכן (client/build), אם קיים.
 *
 * המספר מורכב מחלקים כדי שהקובץ הזה עצמו לא יכיל אותו. הבדיקה מכסה את
 * הצורה הגולמית (0506735040 ו-972506735040), ואת הצורה עם המקפים כפי
 * שהיא מוצגת (050-6735040).
 *
 * חיפוש בבילד דורש בילד עדכני: אם client/build ישן, הוא ייכשל עד
 * ש-npm run build:client ירוץ מחדש. בלי בילד — הבדיקה מדלגת עליו ואומרת זאת.
 */
const fs = require('fs');
const path = require('path');

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
const LOCAL = ['050', '6735040'];
const FORMS = [
  LOCAL.join(''),
  `972${LOCAL.join('').slice(1)}`,
  LOCAL.join('-'),
  `+972-${LOCAL.join('').slice(1, 3)}-${LOCAL[1]}`,
];
const TEXT_EXT = new Set(['.js', '.jsx', '.json', '.html', '.css', '.txt', '.md', '.map', '.svg', '.xml', '.webmanifest']);

/** Lists the text files under a directory, skipping dependencies. */
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full));
    else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

/** Returns the files (relative) under the given directories that contain the number. */
function filesWithNumber(dirs) {
  const hits = [];
  for (const file of dirs.flatMap(listFiles)) {
    const text = fs.readFileSync(file, 'utf8');
    if (FORMS.some((form) => text.includes(form))) hits.push(path.relative(ROOT, file));
  }
  return hits;
}

console.log('\n── קוד המקור');
check('הקליינט (src ו-public) נקי', filesWithNumber([path.join(ROOT, 'client', 'src'), path.join(ROOT, 'client', 'public')]).length === 0,
  filesWithNumber([path.join(ROOT, 'client', 'src'), path.join(ROOT, 'client', 'public')]));
check('תבניות המייל והשרת נקיים', filesWithNumber([path.join(ROOT, 'server')]).length === 0, filesWithNumber([path.join(ROOT, 'server')]));

console.log('\n── הבילד');
const buildDir = path.join(ROOT, 'client', 'build');
if (fs.existsSync(buildDir)) {
  const hits = filesWithNumber([buildDir]);
  check('client/build נקי', hits.length === 0, hits);
} else {
  console.log('  – אין client/build, הבילד לא נבדק (npm run build:client יוצר אותו)');
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
