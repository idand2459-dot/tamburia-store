/**
 * Which database each kind of server may run on (plan 006, Phase 2), on the guarded test database.
 * The server is started as a real child process (test/lib/demoServer.js) so the startup decision in
 * server/server.js is the one under test:
 *   - a demo server refuses a database with no marker, a marker with another id and a marker that is
 *     still 'bootstrapping';
 *   - a normal server refuses a database that carries a marker;
 *   - a refusal happens before any write: no table and no row changes.
 * The marker is a fixture created here and always removed in `finally`.
 */
const crypto = require('crypto');
const { guardedTarget, connect, installMarker, removeMarker, markerExists, spawnServer } = require('./lib/demoServer');

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

/** Every public table with its row count, as one comparable string. */
async function fingerprint(db) {
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows;
  const parts = [];
  for (const { tablename } of tables) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM "${tablename}"`);
    parts.push(`${tablename}:${rows[0].total}`);
  }
  return parts.join(',');
}

(async () => {
  const target = guardedTarget();
  const db = await connect(target);

  try {
    if (await markerExists(db)) {
      console.error('✗ הבדיקה לא רצה: נמצא סימון demo_database_marker שנשאר ממסד הבדיקות. הסירו אותו ידנית ונסו שוב.');
      process.exit(1);
    }

    // The test database needs its schema before a refusal can be compared with "nothing changed".
    const warm = await spawnServer(target, { NODE_ENV: 'production', DEMO_MODE: 'false' });
    check('שרת רגיל על מסד בלי סימון — עולה', warm.ok, warm.output());
    if (warm.ok) {
      const info = await (await fetch(`${warm.baseUrl}/api/demo`)).json();
      check('GET /api/demo בשרת רגיל: demo=false', info.demo === false && info.identities === undefined, info);
      const demoLogin = await fetch(`${warm.baseUrl}/api/auth/demo-login`, { method: 'POST' });
      check('POST /api/auth/demo-login בשרת רגיל → 404 (אין כניסת צופה מחוץ להדגמה)', demoLogin.status === 404, demoLogin.status);
      const upload = await fetch(`${warm.baseUrl}/api/upload-multiple`, { method: 'POST' });
      check('בשרת רגיל העלאה ללא התחברות → 401 (לא הושבתה)', upload.status === 401, upload.status);
      await warm.stop();
    }

    const otherId = crypto.randomUUID();

    console.log('\n── שרת הדגמה');
    let before = await fingerprint(db);
    let run = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: otherId });
    check('בלי טבלת סימון — מסרב', !run.ok && run.code !== 0 && run.output().includes('מסד הדגמה מסומן'), run.output());
    check('ההודעה אינה מדפיסה את המזהה', !run.output().includes(otherId));
    check('הסירוב לא שינה שום טבלה', (await fingerprint(db)) === before);

    const id = await installMarker(db, 'ready');
    before = await fingerprint(db);

    run = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: otherId });
    check('מזהה שונה מהסימון — מסרב', !run.ok && run.code !== 0 && run.output().includes('DEMO_DATABASE_ID'), run.output());
    check('הסירוב לא שינה שום טבלה', (await fingerprint(db)) === before);

    await db.query("UPDATE demo_database_marker SET state = 'bootstrapping'");
    run = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: id });
    check('מצב bootstrapping — מסרב ומפנה ל---resume', !run.ok && run.code !== 0 && run.output().includes('--resume'), run.output());
    check('הסירוב לא שינה שום טבלה', (await fingerprint(db)) === before);

    await db.query("UPDATE demo_database_marker SET state = 'ready'");
    run = await spawnServer(target, { DEMO_MODE: 'true', DEMO_DATABASE_ID: id });
    check('סימון ready עם המזהה הנכון — עולה', run.ok, run.output());
    if (run.ok) {
      const info = await (await fetch(`${run.baseUrl}/api/demo`)).json();
      check('GET /api/demo בשרת הדגמה: demo=true עם שלוש זהויות', info.demo === true && info.identities.length === 3, info);
      await run.stop();
    }

    console.log('\n── שרת רגיל על מסד הדגמה');
    before = await fingerprint(db);
    run = await spawnServer(target, { DEMO_MODE: 'false' });
    check('שרת רגיל על מסד מסומן — מסרב', !run.ok && run.code !== 0 && run.output().includes('שייך לאתר הדגמה'), run.output());
    check('הסירוב לא שינה שום טבלה', (await fingerprint(db)) === before);

    console.log('\n── ניקוי');
    await removeMarker(db);
    check('הסימון הוסר', !(await markerExists(db)));
  } finally {
    await removeMarker(db).catch(() => {});
    await db.end().catch(() => {});
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('הבדיקה קרסה:', err);
  process.exit(1);
});
