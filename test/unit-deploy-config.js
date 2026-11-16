/**
 * Validates the deployment configuration of the portfolio demo (plan 006, Phase 7) without deploying
 * anything: the runbook's environment list and build command agree with `.env.example` and
 * `package.json`, the build inputs exist, and the guardrails around the owner-run scripts are in place.
 * No network, no database.
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
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));

const runbook = read('docs/demo-deployment.md');
const example = read('.env.example');
const pkg = JSON.parse(read('package.json'));

/** The variable names a text sets on a line of the form `NAME=` (an .env file). */
const exampleNames = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));

/** The names in the runbook's environment table: rows that start with `| `NAME` |`. */
const envSection = runbook.split('### Environment variables')[1].split('\n## ')[0];
const tableNames = [...envSection.matchAll(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/gm)].map((m) => m[1]);

/** Names the host reads that are not application settings, so they are not in .env.example. */
const HOST_ONLY = ['NODE_VERSION'];

console.log('\n── משתני הסביבה');
check('הטבלה במדריך מכילה משתנים', tableNames.length >= 18, tableNames);
check('כל משתנה בטבלה קיים ב-.env.example (או שהוא של המארח בלבד)',
  tableNames.every((name) => exampleNames.has(name) || HOST_ONLY.includes(name)),
  tableNames.filter((name) => !exampleNames.has(name) && !HOST_ONLY.includes(name)));
check('אין משתנה כפול בטבלה', new Set(tableNames).size === tableNames.length);

const REQUIRED = ['NODE_ENV', 'DEMO_MODE', 'DEMO_DATABASE_ID', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'DB_SSL', 'SESSION_SECRET', 'ADMIN_PASSWORD', 'ADMIN_URL', 'MAIL_ENABLED', 'TRUST_PROXY_HOPS', 'ORDER_RATE_MAX',
  'ORDER_RATE_WINDOW_MS', 'REVIEW_RATE_MAX', 'DEMO_MAX_VISITOR_ORDERS', 'DEMO_ORDER_TTL_HOURS', 'HSTS_ENABLED'];
check('כל המשתנים שהתוכנית מחייבת מופיעים בטבלה', REQUIRED.every((name) => tableNames.includes(name)),
  REQUIRED.filter((name) => !tableNames.includes(name)));
check('הטבלה אינה מכילה ערך של סוד', !/(?:password|secret)[^|\n]*\|\s*`[^`]{8,}`/i.test(envSection));
check('.env.example: מצב ההדגמה כבוי כברירת מחדל', /^DEMO_MODE=false$/m.test(example));
check('.env.example: DEMO_DATABASE_ID ריק (אין סוד או מזהה בקובץ)', /^DEMO_DATABASE_ID=$/m.test(example));
check('.env.example: DEMO_DATABASE_URL אינו מופיע בו', !/DEMO_DATABASE_URL=/.test(example));

console.log('\n── פקודות הבנייה וההרצה');
const BUILD = 'npm ci && npm ci --prefix client && npm run build:client && node scripts/demo-copy-images.js';
check('פקודת הבנייה במדריך היא זו שבתוכנית', runbook.includes(`\`${BUILD}\``));
check('פקודת ההפעלה היא npm start', /Start command \| `npm start`/.test(runbook) && pkg.scripts.start === 'node server/server.js', pkg.scripts.start);
check('build:client קיים', pkg.scripts['build:client'] === 'npm run build --prefix client', pkg.scripts['build:client']);
check('סקריפטי ההדגמה קיימים ומצביעים על קבצים קיימים', ['demo:bootstrap', 'demo:seed', 'demo:candidates', 'demo:catalogue']
  .every((name) => pkg.scripts[name] && exists(pkg.scripts[name].replace(/^node /, ''))),
  ['demo:bootstrap', 'demo:seed', 'demo:candidates', 'demo:catalogue'].map((name) => pkg.scripts[name]));
check('scripts/demo-copy-images.js קיים', exists('scripts/demo-copy-images.js'));
check('engines.node נקבע ל-20 ומעלה', /^>=\s*2\d/.test(pkg.engines && pkg.engines.node), pkg.engines);
check('שני קבצי ה-lock קיימים (npm ci)', exists('package-lock.json') && exists('client/package-lock.json'));
check('אין render.yaml ואין Docker (התוכנית: הגדרות בדשבורד)', !exists('render.yaml') && !exists('Dockerfile') && !exists('docker-compose.yml'));

console.log('\n── מה נפרס ומה לא');
const gitignore = read('.gitignore');
check('uploads/ אינו במעקב (התוכן מועתק בבנייה)', /^uploads\/\*$/m.test(gitignore) && exists('uploads/.gitkeep'));
check('uploads-originals/ ו-photos/ אינם במעקב', /^uploads-originals\/$/m.test(gitignore) && /^photos\/raw\/\*$/m.test(gitignore));
check('גיליון המועמדים אינו במעקב', /^design-assets\/demo-candidates\.csv$/m.test(gitignore) && /^design-assets\/demo-candidates\.html$/m.test(gitignore));
const ignoreRules = gitignore.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
check('demo-assets/ ו-scripts/demo-data/ אינם מוחרגים (הם מה שנפרס)', !ignoreRules.some((rule) => /demo-assets|demo-data/.test(rule)), ignoreRules.filter((rule) => /demo-assets|demo-data/.test(rule)));
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
check('אין בגיט תמונות מ-uploads/, photos/ או design-assets/ שאינן קבצי הדגמה',
  !tracked.some((file) => /^(?:uploads|uploads-originals|photos)\/.+\.(?:webp|jpe?g|png|heic)$/i.test(file)), tracked.filter((f) => /^(?:uploads|uploads-originals|photos)\//.test(f)).slice(0, 5));

console.log('\n── מעקות בטיחות');
const hook = read('.claude/hooks/block-destructive-bash.mjs');
const settings = JSON.parse(read('.claude/settings.json'));
const wired = JSON.stringify(settings.hooks).includes('block-destructive-bash.mjs');
check('ה-hook החוסם מחובר ב-settings.json', wired);
check('ה-hook מכיל תבנית ל-demo:bootstrap ול-demo:seed ולשני הקבצים', /demo:\(\?:bootstrap\|seed\)/.test(hook) && /demo-\(\?:bootstrap\|seed\)\\\.js/.test(hook));
check('סקריפט שכותב למסד מרוחק מכוסה בתבנית (כלל AGENTS.md)', ['demo-bootstrap.js', 'demo-seed.js']
  .every((file) => exists(`scripts/${file}`)));
check('הסקריפטים אינם קוראים קובץ סביבה לכתובת היעד ואינם מדפיסים אותה', ['scripts/demo-bootstrap.js', 'scripts/demo-seed.js', 'scripts/lib/demoSession.js', 'scripts/lib/demoTarget.js']
  .every((file) => !/console\.(?:log|error)\([^)]*DEMO_DATABASE_URL/.test(read(file)) && !/readFileSync\([^)]*\.env/.test(read(file))));

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
