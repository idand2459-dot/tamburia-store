/**
 * Refreshes the curated rows of an existing demo database. Owner-run; the agent never runs it.
 *
 *   npm run demo:seed -- --database-id <id> --confirm-host <host> --confirm-database <name>
 *   npm run demo:seed -- --reset --database-id <id> ...   (also deletes every visitor order and
 *                                                           re-anchors the seeded dates)
 *
 * It needs a marker in state 'ready' whose id equals --database-id, and the same typed
 * confirmations as the bootstrap. It can never claim an unmarked database: that is the bootstrap's
 * job alone, and only on a pristine database.
 */
const { prepare, connectAndConfirm, readMarker } = require('./lib/demoSession');
const { seed } = require('./lib/demoSeed');

async function main() {
  const { args, target } = prepare(process.argv.slice(2));
  if (!args['database-id']) throw new Error('חסר --database-id.');
  const db = await connectAndConfirm(target, args);

  try {
    const marker = await readMarker(db);
    if (!marker) throw new Error('המסד אינו מסומן כמסד הדגמה. demo:seed מסרב (רק הבוטסטרפ מסמן).');
    if (marker.id !== args['database-id']) throw new Error('--database-id אינו תואם לסימון שבמסד.');
    if (marker.state !== 'ready') throw new Error('הסימון אינו במצב ready. השלימו את הבוטסטרפ עם --resume.');

    const counts = await db.withTransaction((client) => seed(client, { reset: Boolean(args.reset) }));
    console.log(`✓ הזריעה הושלמה: ${counts.products} מוצרים, ${counts.reviews} חוות דעת, ${counts.orders} הזמנות הדגמה`
      + (args.reset ? `, נמחקו ${counts.visitorOrdersRemoved} הזמנות מבקרים.` : '.'));
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('✗ הזריעה נעצרה:', err.message);
  process.exit(1);
});
