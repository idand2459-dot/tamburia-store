/**
 * The shared start of the two scripts that write to a demo database (`demo:bootstrap`,
 * `demo:seed`): reads the flags, validates the target (scripts/lib/demoTarget.js), points the server
 * configuration at it and checks, from what PostgreSQL itself reports, that the connection reached
 * the database the owner typed. Nothing here writes.
 *
 * The scripts are run by the owner, never by the agent (PROJECT_DENY_PATTERNS in
 * .claude/hooks/block-destructive-bash.mjs).
 */
const path = require('path');
const { resolveDemoTarget, applyDemoTarget, parseArgs } = require('./demoTarget');

/** The flags both scripts understand. */
const ARG_SPEC = {
  flags: ['allow-local', 'resume', 'reset'],
  values: ['confirm-host', 'confirm-database', 'database-id'],
};

/** Reads the flags, validates the target and applies it to the environment. Returns { args, target }. */
function prepare(argv) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

  const args = parseArgs(argv, ARG_SPEC);
  const target = resolveDemoTarget({
    env: process.env,
    confirmHost: args['confirm-host'],
    confirmDatabase: args['confirm-database'],
    allowLocal: Boolean(args['allow-local']),
  });
  applyDemoTarget(process.env, target);
  return { args, target };
}

/**
 * Connects and checks that the server reports the database the owner confirmed. Prints the host,
 * database and role, never the password. Returns the open `db` module.
 */
async function connectAndConfirm(target, args) {
  const db = require('../../server/config/db');
  const { rows } = await db.pool.query('SELECT current_database() AS db, current_user AS usr');
  const identity = rows[0];
  if (identity.db !== args['confirm-database']) {
    throw new Error('שם המסד ש-PostgreSQL מדווח אינו זהה ל---confirm-database.');
  }
  console.log(`יעד: מארח ${target.host}:${target.port}, מסד ${identity.db}, משתמש ${identity.usr}`);
  return db;
}

/**
 * Whether the database holds nothing of its own: no table, view, sequence or function outside the
 * system schemas. Objects that belong to an extension do not count (a managed host may install one).
 */
async function isPristine(db) {
  const { rows } = await db.pool.query(`
    SELECT (
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
      ) OR EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      )
    ) AS has_objects
  `);
  return !rows[0].has_objects;
}

/** The marker row ({ id, state }), null when the table is empty, or undefined when there is no table. */
async function readMarker(db) {
  const { rows: exists } = await db.pool.query("SELECT to_regclass('public.demo_database_marker') AS marker");
  if (exists[0].marker === null) return undefined;
  const { rows } = await db.pool.query('SELECT id, state FROM demo_database_marker');
  return rows[0] || null;
}

module.exports = { prepare, connectAndConfirm, isPristine, readMarker };
