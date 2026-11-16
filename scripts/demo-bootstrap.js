/**
 * First-time setup of the portfolio demo database. Owner-run, once, against a NEW EMPTY database
 * (plan 006, Phase 2). The agent never runs it.
 *
 *   $env:DEMO_DATABASE_URL = '<the direct connection URL of the new empty database>'   (this session only)
 *   npm run demo:bootstrap -- --confirm-host <host> --confirm-database <name>
 *   npm run demo:bootstrap -- --resume --database-id <id> --confirm-host <host> --confirm-database <name>
 *
 * Steps:
 *   1. Identity, read-only: the target is validated (scripts/lib/demoTarget.js), the typed host and
 *      database name must equal the URL's, and the database must be PRISTINE (nothing in it). A
 *      database that has anything is refused here, which is what protects a real or development
 *      database. There is no flag that skips the check.
 *   2. Claim: one transaction creates demo_database_marker with a new random id, state 'bootstrapping'.
 *      The id is printed once; store it as DEMO_DATABASE_ID in the host's secret store.
 *   3. Schema: the migrations run under the advisory lock.
 *   4. Seed, one transaction, ending with state = 'ready'.
 * A crash after step 2 leaves 'bootstrapping'; the server refuses such a database, and --resume with
 * the same id repeats steps 3 and 4 (both idempotent).
 *
 * --allow-local lets the owner rehearse on a scratch local database; the URL itself is never printed.
 */
const crypto = require('crypto');
const { prepare, connectAndConfirm, isPristine, readMarker } = require('./lib/demoSession');
const { seed } = require('./lib/demoSeed');

/** Creates the marker table and its single row, in one transaction. Returns the new id. */
async function claim(db) {
  const id = crypto.randomUUID();
  await db.withTransaction(async (client) => {
    await client.query(`
      CREATE TABLE demo_database_marker (
        singleton  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        id         UUID        NOT NULL,
        state      TEXT        NOT NULL CHECK (state IN ('bootstrapping', 'ready')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("INSERT INTO demo_database_marker (id, state) VALUES ($1, 'bootstrapping')", [id]);
  });
  return id;
}

/** Steps 3 and 4: migrations, then the seed and the switch to 'ready' in one transaction. */
async function build(db, id) {
  await require('../server/db/migrate').runMigrations();

  const summary = await db.withTransaction(async (client) => {
    const counts = await seed(client);
    if (process.env.DEMO_SEED_FAIL_FOR_TEST === 'true' && process.argv.includes('--allow-local')) {
      throw new Error('כשל מכוון לבדיקה (DEMO_SEED_FAIL_FOR_TEST).');
    }
    const { rowCount } = await client.query(
      "UPDATE demo_database_marker SET state = 'ready' WHERE id = $1 AND state = 'bootstrapping'", [id]
    );
    if (rowCount !== 1) throw new Error('הסימון אינו במצב bootstrapping.');
    return counts;
  });
  return summary;
}

async function main() {
  const { args, target } = prepare(process.argv.slice(2));
  const db = await connectAndConfirm(target, args);

  try {
    const marker = await readMarker(db);
    let id;

    if (args.resume) {
      if (!args['database-id']) throw new Error('--resume דורש --database-id.');
      if (!marker || marker.id !== args['database-id'] || marker.state !== 'bootstrapping') {
        throw new Error('אין סימון במצב bootstrapping עם המזהה הזה. ההמשך מסרב.');
      }
      id = marker.id;
      console.log('ממשיך אתחול שלא הסתיים.');
    } else {
      if (marker !== undefined) throw new Error('המסד כבר מסומן כמסד הדגמה. הבוטסטרפ מסרב (השתמשו ב---resume או ב-demo:seed).');
      if (!(await isPristine(db))) {
        throw new Error('המסד אינו ריק (יש בו טבלאות, תצוגות, רצפים או פונקציות). הבוטסטרפ מסרב, ואין דגל שעוקף זאת.');
      }
      id = await claim(db);
      console.log(`המסד סומן כמסד הדגמה. DEMO_DATABASE_ID=${id}`);
      console.log('שמרו את המזהה הזה כעת ב-Render כ-DEMO_DATABASE_ID. הוא לא יודפס שוב.');
    }

    const counts = await build(db, id);
    console.log(`✓ המסד מוכן (ready): ${counts.products} מוצרים (${counts.catalogueSource}), ${counts.pigments} גווני פיגמנט, `
      + `${counts.reviews} חוות דעת, ${counts.orders} הזמנות הדגמה.`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('✗ הבוטסטרפ נעצר:', err.message);
  process.exit(1);
});
