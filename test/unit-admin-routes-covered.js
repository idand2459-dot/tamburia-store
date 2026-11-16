/**
 * Keeps the admin authorization table (test/lib/adminRoutes.js) honest. A source scan in the style
 * of unit-repo-hygiene, not a router inspection: it reads server/api/index.js for the mount paths and
 * every `*.routes.js` for the routes that use requireAdmin or requireAdminRead, then fails when
 *   - a protected route has no row in the table, or a row has no route;
 *   - a row's access (read or owner) does not match the middleware the route uses;
 *   - requireAdminRead appears on anything other than router.get;
 *   - the viewer allowlist is not exactly the seven approved reads.
 * A new route that uses requireAdmin without a row fails here, which is what makes default-deny
 * visible to a reviewer.
 */
const fs = require('fs');
const path = require('path');
const { ROUTES, VIEWER_READ_ROUTES } = require('./lib/adminRoutes');

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

const API_DIR = path.join(__dirname, '..', 'server', 'api');

/** The mount path of every routes file, from `router.use('/orders', ..., require('./order/order.routes'))`. */
function mounts() {
  const index = fs.readFileSync(path.join(API_DIR, 'index.js'), 'utf8');
  const result = new Map();
  for (const match of index.matchAll(/router\.use\('([^']*)',[^\n]*require\('\.\/([^']+\.routes)'\)\)/g)) {
    result.set(`${match[2]}.js`, match[1] === '/' ? '' : match[1]);
  }
  return result;
}

const mountOf = mounts();
check('נמצאו נקודות הרכבה לכל קבצי ה-routes', mountOf.size >= 7, [...mountOf.keys()]);

/** Every route that uses a guard: { key: 'METHOD /api/path', method, guard, line }. */
function protectedRoutes() {
  const found = [];
  for (const [file, mount] of mountOf) {
    const text = fs.readFileSync(path.join(API_DIR, file), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*router\.(get|post|put|patch|delete)\('([^']*)'(.*)$/);
      if (!match) continue;
      const guard = /\brequireAdminRead\b/.test(match[3]) ? 'requireAdminRead'
        : /\brequireAdmin\b/.test(match[3]) ? 'requireAdmin' : null;
      if (!guard) continue;
      const sub = match[2] === '/' ? '' : match[2];
      const method = match[1].toUpperCase();
      found.push({ key: `${method} /api${mount}${sub}`, method, guard, line: line.trim() });
    }
  }
  return found;
}

const found = protectedRoutes();
const tableKeys = ROUTES.map((row) => `${row.method} ${row.path}`);
const foundKeys = found.map((route) => route.key);

console.log('\n── הטבלה והקוד');
check('יש נתיבים מוגנים בקוד', found.length >= 20, found.length);
check('כל נתיב מוגן יש לו שורה בטבלה', foundKeys.every((key) => tableKeys.includes(key)),
  foundKeys.filter((key) => !tableKeys.includes(key)));
check('לכל שורה בטבלה יש נתיב בקוד', tableKeys.every((key) => foundKeys.includes(key)),
  tableKeys.filter((key) => !foundKeys.includes(key)));
check('אין שורה כפולה בטבלה', new Set(tableKeys).size === tableKeys.length, tableKeys);

console.log('\n── ההרשאה בשורה זהה לשומר שבקוד');
for (const route of found) {
  const row = ROUTES.find((item) => `${item.method} ${item.path}` === route.key);
  if (!row) continue;
  const expected = row.access === 'read' ? 'requireAdminRead' : 'requireAdmin';
  check(`${route.key} → ${expected}`, route.guard === expected, route.guard);
}

console.log('\n── requireAdminRead רק על GET, והרשימה סגורה');
check('requireAdminRead מופיע רק ב-router.get', found.filter((route) => route.guard === 'requireAdminRead')
  .every((route) => route.method === 'GET'), found.filter((route) => route.guard === 'requireAdminRead' && route.method !== 'GET'));
{
  const reads = ROUTES.filter((row) => row.access === 'read').map((row) => `${row.method} ${row.path}`).sort();
  check('רשימת הצופה בטבלה היא בדיוק שבעת הנתיבים המאושרים', JSON.stringify(reads) === JSON.stringify([...VIEWER_READ_ROUTES].sort()), reads);
  const inCode = found.filter((route) => route.guard === 'requireAdminRead').map((route) => route.key).sort();
  check('ורשימת הצופה בקוד זהה לה', JSON.stringify(inCode) === JSON.stringify([...VIEWER_READ_ROUTES].sort()), inCode);
  check('כל שורת כתיבה (לא GET) בטבלה היא owner', ROUTES.filter((row) => row.method !== 'GET').every((row) => row.access === 'owner'));
}

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
