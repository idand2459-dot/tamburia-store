/**
 * Tests the --target rule for scripts (scripts/lib/target.js): cloud credentials come
 * from the environment file behind an explicit flag, the run refuses when they are
 * missing, no secret is ever an argument or is printed, "local" can never reach a cloud
 * database, and the guardrail hook keeps the agent from running a cloud-targeted script.
 *
 * The first cases run on fake environment objects; the later ones run the real scripts in
 * a child process with a controlled environment (no network is reached: every case here
 * stops before a connection is opened).
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { applyTarget, readTarget } = require('../scripts/lib/target');

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

const CLOUD_DB = 'postgresql://app_user:very-secret-pw-1@db.cloud.example:5432/shop';
const CLOUDINARY = 'cloudinary://key-123:very-secret-api-2@fake-cloud';

/** Runs applyTarget on a copy of an environment; returns the environment or the error message. */
function apply(argv, env) {
  const copy = { ...env };
  try {
    const result = applyTarget(argv, copy);
    return { result, env: copy };
  } catch (err) {
    return { error: err.message, env: copy };
  }
}

console.log('\n── ברירת מחדל: מקומי');
const local = apply(['--from-uploads'], { DATABASE_URL: CLOUD_DB, STORAGE_DRIVER: 'local' });
check('בלי דגל — יעד מקומי', local.result && local.result.target === 'local', local);
check('DATABASE_URL שנשאר בסביבה מתנקה, כדי שמקומי לא יגיע לענן', local.env.DATABASE_URL === '', local.env.DATABASE_URL);
check('סוג האחסון לא משתנה', local.env.STORAGE_DRIVER === 'local');
check('--target local מפורש — אותו דבר', apply(['--target', 'local'], {}).result.target === 'local');

console.log('\n── --target cloud');
const cloud = apply(['--from-uploads', '--target', 'cloud'], { CLOUD_DATABASE_URL: CLOUD_DB, CLOUDINARY_URL: CLOUDINARY });
check('עם שני הערכים — יעד ענן', cloud.result && cloud.result.target === 'cloud', cloud);
check('CLOUD_DATABASE_URL הופך למסד הריצה', cloud.env.DATABASE_URL === CLOUD_DB);
check('האחסון הופך ל-cloudinary', cloud.env.STORAGE_DRIVER === 'cloudinary');
check('הצורה --target=cloud עובדת גם היא', apply(['--target=cloud'], { CLOUD_DATABASE_URL: CLOUD_DB, CLOUDINARY_URL: CLOUDINARY }).result.target === 'cloud');

console.log('\n── ערכים חסרים: מסרב');
const noDb = apply(['--target', 'cloud'], { CLOUDINARY_URL: CLOUDINARY });
check('בלי CLOUD_DATABASE_URL — מסרב ונוקב בו', noDb.error && noDb.error.includes('CLOUD_DATABASE_URL') && !noDb.error.includes('CLOUDINARY_URL'), noDb.error);
const noCloudinary = apply(['--target', 'cloud'], { CLOUD_DATABASE_URL: CLOUD_DB });
check('בלי CLOUDINARY_URL — מסרב ונוקב בו', noCloudinary.error && noCloudinary.error.includes('CLOUDINARY_URL') && !noCloudinary.error.includes('CLOUD_DATABASE_URL'), noCloudinary.error);
const neither = apply(['--target', 'cloud'], {});
check('בלי שניהם — נוקב בשניהם', neither.error && neither.error.includes('CLOUD_DATABASE_URL') && neither.error.includes('CLOUDINARY_URL'), neither.error);
check('ערך ריק נחשב חסר', apply(['--target', 'cloud'], { CLOUD_DATABASE_URL: '', CLOUDINARY_URL: CLOUDINARY }).error.includes('CLOUD_DATABASE_URL'));
check('כשמסרב, הסביבה לא משתנה', neither.env.DATABASE_URL === undefined && neither.env.STORAGE_DRIVER === undefined, neither.env);

const notPostgres = apply(['--target', 'cloud'], { CLOUD_DATABASE_URL: 'mysql://u:very-secret-pw-1@h/db', CLOUDINARY_URL: CLOUDINARY });
check('כתובת שאינה postgres — מסרב בלי להדפיס אותה', notPostgres.error && !notPostgres.error.includes('very-secret-pw-1'), notPostgres.error);
const garbage = apply(['--target', 'cloud'], { CLOUD_DATABASE_URL: 'not a url very-secret-pw-1', CLOUDINARY_URL: CLOUDINARY });
check('כתובת לא תקינה — מסרב בלי להדפיס אותה', garbage.error && !garbage.error.includes('very-secret-pw-1'), garbage.error);

console.log('\n── סודות לא עוברים כארגומנט');
for (const arg of [CLOUD_DB, CLOUDINARY, 'CLOUDINARY_URL=cloudinary://k:s@c', 'DATABASE_URL=postgresql://u:p@h/db', 'ADMIN_PASSWORD=hunter2']) {
  const out = apply(['--target', 'cloud', arg], { CLOUD_DATABASE_URL: CLOUD_DB, CLOUDINARY_URL: CLOUDINARY });
  check(`ארגומנט כמו "${arg.slice(0, 22)}…" נדחה, בלי להדפיס אותו`, out.error && !out.error.includes('very-secret') && !out.error.includes('hunter2') && !out.error.includes(arg), out.error);
}
check('ארגומנטים רגילים (נתיב גיבוי, תאריך) אינם נחסמים', !apply(['--revert', 'design-assets\\reprocess-backup-2026-10-22.json', '--since', '2026-10-01'], {}).error);

console.log('\n── ערך לא חוקי');
let invalid = '';
try { readTarget(['--target', 'prod']); } catch (err) { invalid = err.message; }
check('--target prod → שגיאה', invalid.includes('local') && invalid.includes('cloud'), invalid);

console.log('\n── הסקריפט עצמו');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'images-products.js');

/** Runs the real script with a controlled environment. */
function runScript(args, env) {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: {
      ...process.env,
      // dotenv does not override a variable that is already set, so '' means "missing"
      CLOUD_DATABASE_URL: '', CLOUDINARY_URL: '', ...env,
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

const missing = runScript(['--from-uploads', '--target', 'cloud'], {});
check('--target cloud בלי הערכים — נכשל', missing.status !== 0, missing.status);
check('וההודעה נוקבת בשמות המשתנים', missing.output.includes('CLOUD_DATABASE_URL') && missing.output.includes('CLOUDINARY_URL'), missing.output);
check('בלי שהסקריפט פתח חיבור או עיבד משהו', !missing.output.includes('תמונות ב-uploads') && !missing.output.includes('יעד:'), missing.output);

const partial = runScript(['--from-uploads', '--target', 'cloud'], { CLOUD_DATABASE_URL: CLOUD_DB });
check('עם ערך אחד בלבד — נכשל, ולא מדפיס את הסוד', partial.status !== 0 && !partial.output.includes('very-secret-pw-1'), partial.output);

const asArgument = runScript(['--from-uploads', '--target', 'cloud', CLOUD_DB], { CLOUD_DATABASE_URL: CLOUD_DB, CLOUDINARY_URL: CLOUDINARY });
check('כתובת חיבור כארגומנט — נכשל, ולא מדפיס אותה', asArgument.status !== 0 && !asArgument.output.includes('very-secret-pw-1'), asArgument.output);

const rawMode = runScript(['--target', 'cloud'], { CLOUD_DATABASE_URL: CLOUD_DB, CLOUDINARY_URL: CLOUDINARY });
check('--target cloud במצב הצילומים הגולמיים — נכשל', rawMode.status !== 0 && rawMode.output.includes('--from-uploads'), rawMode.output);
check('ולא מדפיס סודות', !rawMode.output.includes('very-secret'), rawMode.output);

console.log('\n── ה-hook של הסוכן');
const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'block-destructive-bash.mjs');

/** The hook's verdict on a command: true when it blocks it. */
function blocked(command) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  });
  return run.status === 2;
}

check('npm run … -- --target cloud — נחסם', blocked('npm run images:products -- --from-uploads --target cloud'));
check('גם הצורה --target=cloud', blocked('node scripts/images-products.js --from-uploads --target=cloud'));
check('גם ריצה יבשה (בלי --apply)', blocked('npm run cloud:migrate-data -- --target cloud'));
check('גם אחרי מפריד פקודות', blocked('echo start && npm run db:backup -- --target cloud'));
check('--target local — לא נחסם', !blocked('npm run images:products -- --from-uploads --target local'));
check('חיפוש של הטקסט — לא נחסם', !blocked('grep "target cloud" README.md'));
check('כתיבת מסמך שמזכיר את הדגל — לא נחסם', !blocked('echo "use --target cloud" > note.txt'));

console.log(`\n${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
