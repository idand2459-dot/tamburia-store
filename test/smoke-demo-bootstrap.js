/**
 * The demo bootstrap matrix (plan 006, Phase 2): `scripts/demo-bootstrap.js` and `scripts/demo-seed.js`
 * run as real child processes against scratch databases that this suite creates and drops on the
 * local PostgreSQL server (the test role needs the CREATEDB privilege; without it the suite prints
 * "NOT RUN" and exits non-zero, so the run is reported as incomplete and never as passed).
 *
 * The scripts are pointed at a scratch database only: the development database and the test
 * database are refused by the scripts themselves, and this suite checks that too. No password is
 * printed, and none may appear in a script's output.
 */
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { guardedTarget, connect, spawnServer } = require('./lib/demoServer');

const ROOT = path.join(__dirname, '..');
// the owner-approved catalogue that the seed writes (scripts/demo-data/catalogue.json)
const CATALOGUE_SIZE = require('../scripts/demo-data/catalogue.json').length;
const SCRIPT = (name) => path.join(ROOT, 'scripts', name);

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

const target = guardedTarget();
const SUFFIX = `${process.pid}`;
const scratchNames = [];

/** The connection URL of a scratch database, as the owner would put it in DEMO_DATABASE_URL. */
function urlOf(name) {
  const enc = encodeURIComponent;
  return `postgresql://${enc(target.user)}:${enc(target.password)}@localhost:${target.port}/${name}`;
}

/** Runs a demo script against a scratch database and returns { status, output }. */
function runScript(script, name, args = [], env = {}) {
  const run = spawnSync(process.execPath, [SCRIPT(script), ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, DEMO_DATABASE_URL: urlOf(name), ...env },
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

/** The flags that point a script at the scratch database. */
const confirm = (name, extra = []) => ['--allow-local', '--confirm-host', 'localhost', '--confirm-database', name, ...extra];

/** Whether an output leaked the database password. */
const leaks = (output) => output.includes(target.password);

/** Creates a scratch database and returns its name. */
async function createScratch(admin, label) {
  const name = `tamburia_demo_scratch_${label}_${SUFFIX}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  scratchNames.push(name);
  return name;
}

/** A pg client on a scratch database. */
const open = (name) => connect(target, { database: name, confirm: false });

/** Counts the rows of a table. */
async function count(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
  return rows[0].total;
}

/** The seeded content, without the dates that move with the run time. */
async function snapshot(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT json_agg(p ORDER BY id) FROM (SELECT id, name, price, category, subcategory, sku, in_stock, active FROM products) p) AS products,
      (SELECT json_agg(r ORDER BY id) FROM (SELECT id, reviewer_name, rating, text, approved FROM reviews) r) AS reviews,
      (SELECT json_agg(f ORDER BY color_code) FROM pigment_formulas f) AS pigments,
      (SELECT json_agg(o ORDER BY request_id) FROM (SELECT request_id, customer_name, customer_phone, items, total, status FROM orders) o) AS orders
  `);
  return JSON.stringify(rows[0]);
}

(async () => {
  let admin;
  try {
    admin = await connect(target, { database: 'postgres', confirm: false });
    await admin.query('SELECT 1');
    const { rows } = await admin.query('SELECT rolcreatedb OR rolsuper AS ok FROM pg_roles WHERE rolname = current_user');
    if (!rows[0].ok) throw new Error('role without CREATEDB');
  } catch (err) {
    console.log(`  ✗ NOT RUN — אין הרשאת CREATEDB או חיבור למסד התחזוקה (${err.message}). ההרצה אינה שלמה.`);
    process.exit(1);
  }

  try {
    // ── refusals that happen before any connection
    console.log('\n── סירובים לפני חיבור');
    const a = await createScratch(admin, 'a');

    let run = runScript('demo-bootstrap.js', a, ['--confirm-host', 'localhost', '--confirm-database', a]);
    check('מארח מקומי בלי --allow-local — מסרב', run.status !== 0 && run.output.includes('--allow-local') && !leaks(run.output), run.output);
    run = runScript('demo-bootstrap.js', a, ['--allow-local', '--confirm-host', 'otherhost', '--confirm-database', a]);
    check('--confirm-host שגוי — מסרב', run.status !== 0 && run.output.includes('--confirm-host') && !leaks(run.output), run.output);
    run = runScript('demo-bootstrap.js', a, ['--allow-local', '--confirm-host', 'localhost', '--confirm-database', 'wrong_name']);
    check('--confirm-database שגוי — מסרב', run.status !== 0 && run.output.includes('--confirm-database') && !leaks(run.output), run.output);
    run = runScript('demo-bootstrap.js', target.name, confirm(target.name));
    check('מסד הבדיקות כיעד — מסרב ונוקב ב-TEST_DATABASE_URL', run.status !== 0 && run.output.includes('TEST_DATABASE_URL') && !leaks(run.output), run.output);
    run = runScript('demo-bootstrap.js', a, confirm(a), { DEMO_DATABASE_URL: '' });
    check('בלי DEMO_DATABASE_URL — מסרב', run.status !== 0 && run.output.includes('DEMO_DATABASE_URL'), run.output);
    {
      const clientA = await open(a);
      check('אף סירוב לא יצר טבלה', (await clientA.query("SELECT COUNT(*)::int AS total FROM pg_tables WHERE schemaname = 'public'")).rows[0].total === 0);
      await clientA.end();
    }

    // ── a database that already holds something is refused
    console.log('\n── מסד שאינו ריק');
    {
      const clientA = await open(a);
      await clientA.query('CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT)');
      await clientA.query("INSERT INTO products (name) VALUES ('real product')");
      await clientA.end();

      run = runScript('demo-bootstrap.js', a, confirm(a));
      check('מסד עם טבלה — הבוטסטרפ מסרב', run.status !== 0 && run.output.includes('אינו ריק') && !leaks(run.output), run.output);
      run = runScript('demo-seed.js', a, confirm(a, ['--database-id', '3f2b8c1e-9d4a-4e7b-8a61-5c0d2f7e9b14']));
      check('מסד עם מוצרים ובלי סימון — demo:seed מסרב', run.status !== 0 && run.output.includes('אינו מסומן') && !leaks(run.output), run.output);

      const after = await open(a);
      const tables = (await after.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
      check('לא נוצר סימון ולא נוספה שורה', tables.join() === 'products' && (await count(after, 'products')) === 1, tables);
      await after.end();
    }

    // ── a pristine database is claimed, built, seeded and marked ready
    console.log('\n── אתחול של מסד ריק');
    const b = await createScratch(admin, 'b');
    run = runScript('demo-bootstrap.js', b, confirm(b));
    const idMatch = run.output.match(/DEMO_DATABASE_ID=([0-9a-f-]{36})/);
    check('מסד ריק — הבוטסטרפ מצליח ומדפיס מזהה', run.status === 0 && Boolean(idMatch), run.output);
    check('הסיסמה אינה מופיעה בפלט', !leaks(run.output));
    const idB = idMatch && idMatch[1];
    {
      const clientB = await open(b);
      const marker = (await clientB.query('SELECT id, state FROM demo_database_marker')).rows;
      check('הסימון: שורה אחת, המזהה שהודפס, במצב ready', marker.length === 1 && marker[0].id === idB && marker[0].state === 'ready', marker);
      check('הנתונים נזרעו', (await count(clientB, 'products')) === CATALOGUE_SIZE && (await count(clientB, 'reviews')) === 8
        && (await count(clientB, 'orders')) === 8 && (await count(clientB, 'pigment_formulas')) === 20);
      check('כל ההזמנות הזרועות מתויגות demo-seed:', (await clientB.query("SELECT COUNT(*)::int AS total FROM orders WHERE request_id LIKE 'demo-seed:%'")).rows[0].total === 8);
      const next = (await clientB.query("INSERT INTO products (name, price, stock) VALUES ('x', 1, 0) RETURNING id")).rows[0].id;
      check('הרצף של המוצרים אחרי המזהים הזרועים', next > 628, next);
      await clientB.query('DELETE FROM products WHERE id = $1', [next]);
      await clientB.end();
    }

    run = runScript('demo-bootstrap.js', b, confirm(b));
    check('בוטסטרפ שני על מסד שכבר נתבע — מסרב', run.status !== 0 && !leaks(run.output), run.output);

    // ── demo:seed
    console.log('\n── demo:seed');
    run = runScript('demo-seed.js', b, confirm(b));
    check('בלי --database-id — מסרב', run.status !== 0 && run.output.includes('--database-id'), run.output);
    run = runScript('demo-seed.js', b, confirm(b, ['--database-id', '3f2b8c1e-9d4a-4e7b-8a61-5c0d2f7e9b14']));
    check('מזהה שגוי — מסרב', run.status !== 0 && run.output.includes('אינו תואם'), run.output);

    const clientB = await open(b);
    const before = await snapshot(clientB);
    run = runScript('demo-seed.js', b, confirm(b, ['--database-id', idB]));
    check('מזהה נכון — הזריעה מצליחה', run.status === 0 && !leaks(run.output), run.output);
    run = runScript('demo-seed.js', b, confirm(b, ['--database-id', idB]));
    check('הרצה שנייה מצליחה', run.status === 0, run.output);
    check('זריעה חוזרת אינה משנה תוכן (חוץ מתאריכים)', (await snapshot(clientB)) === before);

    // a visitor order and a seeded order edited by the owner
    await clientB.query(`INSERT INTO orders (customer_name, customer_phone, delivery_method, items, subtotal, delivery_fee, total, status)
      VALUES ('דנה דמו', '050-0000011', 'pickup', '[]', 1, 0, 1, 'new')`);
    check('הזמנת מבקר נוספה', (await count(clientB, 'orders')) === 9);
    run = runScript('demo-seed.js', b, confirm(b, ['--database-id', idB]));
    check('זריעה אינה מוחקת הזמנת מבקר ואינה מכפילה הזמנות זרועות', run.status === 0 && (await count(clientB, 'orders')) === 9, run.output);
    run = runScript('demo-seed.js', b, confirm(b, ['--database-id', idB, '--reset']));
    check('--reset מוחק את הזמנות המבקרים בלבד', run.status === 0 && (await count(clientB, 'orders')) === 8
      && (await clientB.query("SELECT COUNT(*)::int AS total FROM orders WHERE request_id LIKE 'demo-seed:%'")).rows[0].total === 8, run.output);
    await clientB.end();

    // ── a failed seed leaves 'bootstrapping'; resume completes it
    console.log('\n── כשל באמצע ו---resume');
    const c = await createScratch(admin, 'c');
    run = runScript('demo-bootstrap.js', c, confirm(c), { DEMO_SEED_FAIL_FOR_TEST: 'true' });
    const idC = (run.output.match(/DEMO_DATABASE_ID=([0-9a-f-]{36})/) || [])[1];
    check('כשל מכוון בזריעה — הבוטסטרפ נכשל אחרי שנתבע', run.status !== 0 && Boolean(idC), run.output);
    {
      const clientC = await open(c);
      const marker = (await clientC.query('SELECT id, state FROM demo_database_marker')).rows;
      check('הסימון נשאר bootstrapping', marker.length === 1 && marker[0].state === 'bootstrapping', marker);
      check('אין מוצרים אחרי הכשל', (await count(clientC, 'products')) === 0);
      await clientC.end();
    }

    const refused = await spawnServer(target, {
      DB_NAME: c, DEMO_MODE: 'true', DEMO_DATABASE_ID: idC,
    });
    check('השרת מסרב לשרת מסד במצב bootstrapping', !refused.ok && refused.code !== 0 && refused.output().includes('--resume'), refused.output());

    run = runScript('demo-bootstrap.js', c, confirm(c, ['--resume', '--database-id', '3f2b8c1e-9d4a-4e7b-8a61-5c0d2f7e9b14']));
    check('--resume עם מזהה שגוי — מסרב', run.status !== 0 && run.output.includes('bootstrapping'), run.output);
    run = runScript('demo-bootstrap.js', c, confirm(c, ['--resume']));
    check('--resume בלי מזהה — מסרב', run.status !== 0 && run.output.includes('--database-id'), run.output);
    run = runScript('demo-bootstrap.js', c, confirm(c, ['--resume', '--database-id', idC]));
    check('--resume עם המזהה הנכון משלים', run.status === 0 && !leaks(run.output), run.output);
    {
      const clientC = await open(c);
      check('אחרי ההמשך: ready  והקטלוג המאושר', (await clientC.query('SELECT state FROM demo_database_marker')).rows[0].state === 'ready'
        && (await count(clientC, 'products')) === CATALOGUE_SIZE);
      await clientC.end();
    }
    run = runScript('demo-bootstrap.js', c, confirm(c, ['--resume', '--database-id', idC]));
    check('--resume על מסד שכבר ready — מסרב', run.status !== 0, run.output);

    const served = await spawnServer(target, { DB_NAME: c, DEMO_MODE: 'true', DEMO_DATABASE_ID: idC });
    check('אחרי השלמה השרת עולה על מסד ההדגמה', served.ok, served.output());
    if (served.ok) {
      const info = await (await fetch(`${served.baseUrl}/api/demo`)).json();
      check('GET /api/demo מדווח על מצב הדגמה ושלוש זהויות', info.demo === true && info.identities.length === 3, info);
      const products = await (await fetch(`${served.baseUrl}/api/products`)).json();
      check('החנות מגישה את קטלוג ההדגמה', (products.products || products).length > 0, Object.keys(products));
      await served.stop();
    }

    // ── concurrent migrations
    console.log('\n── מיגרציות מקבילות');
    const d = await createScratch(admin, 'd');
    const env = {
      ...process.env, NODE_ENV: 'development', DB_HOST: 'localhost', DB_PORT: String(target.port), DB_NAME: d,
      DB_USER: target.user, DB_PASSWORD: target.password, DB_SSL: 'false', DB_LOG_QUERIES: 'false', MAIL_ENABLED: 'false',
    };
    const runMigrate = () => new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'server', 'db', 'migrate.js')], { cwd: ROOT, env });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.on('close', (code) => resolve({ code, output }));
    });
    const [first, second] = await Promise.all([runMigrate(), runMigrate()]);
    check('שני תהליכי מיגרציה במקביל — שניהם מצליחים', first.code === 0 && second.code === 0, [first.output, second.output]);
    {
      const clientD = await open(d);
      const applied = (await clientD.query('SELECT COUNT(*)::int AS total FROM schema_migrations')).rows[0].total;
      const files = require('fs').readdirSync(path.join(ROOT, 'server', 'db', 'migrations')).filter((f) => f.endsWith('.sql')).length;
      check('כל מיגרציה נרשמה פעם אחת', applied === files, { applied, files });
      await clientD.end();
    }
  } finally {
    for (const name of scratchNames) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch((err) => {
        console.log(`  ✗ מסד זמני ${name} לא נמחק: ${err.message}`);
        failed++;
      });
    }
    await admin.end().catch(() => {});
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
