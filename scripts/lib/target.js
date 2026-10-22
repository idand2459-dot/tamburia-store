/**
 * Which environment a script works on: --target local (the default) or --target cloud.
 *
 * A script that touches the cloud database or Cloudinary takes its credentials from the
 * local environment file, behind this explicit flag, and nowhere else:
 *
 *   --target local   the DB_* database and STORAGE_DRIVER of the environment file, as
 *                    always. A stray DATABASE_URL is cleared, so "local" can never reach
 *                    a cloud database by accident.
 *   --target cloud   CLOUD_DATABASE_URL becomes the run's database and Cloudinary becomes
 *                    its storage (CLOUDINARY_URL). Both must be in the environment file;
 *                    the script refuses to run without them.
 *
 * Secrets are never arguments and are never typed into the shell: PowerShell keeps typed
 * commands in its history file, in plain text. An argument that looks like a connection
 * string is refused, and no message here ever prints a value, only the variable's name.
 *
 * applyTarget must run before anything requires server/config: the configuration is read
 * once, when it is first loaded.
 */
const path = require('path');

const TARGETS = ['local', 'cloud'];

/** An argument that carries credentials: a URL with user info, or NAME=value for a secret. */
const SECRET_ARG = /^[a-z][a-z0-9+.-]*:\/\/[^\s/]*@|(?:DATABASE_URL|CLOUDINARY_URL|PASSWORD|SECRET|TOKEN)=/i;

/** Reads --target (also --target=cloud) from the arguments; local when absent. */
function readTarget(argv) {
  let target = 'local';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      target = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    }
  }
  if (!TARGETS.includes(target)) throw new Error('--target חייב להיות local או cloud');
  return target;
}

/** Refuses any argument that looks like a secret. The message never shows it. */
function assertNoSecretArguments(argv) {
  if (argv.some((arg) => SECRET_ARG.test(arg))) {
    throw new Error(
      'אחד הארגומנטים נראה כמו סוד (כתובת חיבור, סיסמה או טוקן). סודות לא מועברים כארגומנט ולא ' +
      'מוקלדים בשורת הפקודה: הם נקראים מקובץ הסביבה, בעזרת --target cloud.',
    );
  }
}

/**
 * Applies the target to `env` and returns { target }. Throws an Error that names the
 * variable at fault, never its value.
 */
function applyTarget(argv, env = process.env) {
  assertNoSecretArguments(argv);
  const target = readTarget(argv);

  // dotenv does not override a variable that is already set, so this only fills in what the
  // shell left out, the same as server/config/env.js does when it loads.
  if (env === process.env) {
    require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
  }

  if (target === 'local') {
    env.DATABASE_URL = '';
    return { target };
  }

  const missing = ['CLOUD_DATABASE_URL', 'CLOUDINARY_URL'].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `--target cloud דורש ${missing.join(' ו-')} בקובץ הסביבה (.env). ` +
      'מוסיפים אותם שם בעצמך; לא מקלידים אותם בשורת הפקודה.',
    );
  }

  let protocol;
  try {
    ({ protocol } = new URL(env.CLOUD_DATABASE_URL));
  } catch {
    throw new Error('CLOUD_DATABASE_URL אינו כתובת תקינה');
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error('CLOUD_DATABASE_URL חייב להתחיל ב-postgres:// או ב-postgresql://');
  }

  env.DATABASE_URL = env.CLOUD_DATABASE_URL;
  env.STORAGE_DRIVER = 'cloudinary';
  return { target };
}

/** One line for the run's log: the target, and for the cloud the database host (not a secret). */
function describeTarget({ target }, env = process.env) {
  if (target === 'local') return 'יעד: מקומי (מסד ה-DB_* ואחסון מקומי)';
  return `יעד: ענן (מסד ב-${new URL(env.CLOUD_DATABASE_URL).hostname}, Cloudinary)`;
}

module.exports = {
  applyTarget, readTarget, describeTarget, assertNoSecretArguments, TARGETS,
};
