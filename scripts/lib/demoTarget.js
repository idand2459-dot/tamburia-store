/**
 * Decides which database the demo scripts (`demo:bootstrap`, `demo:seed`) may touch. Pure functions
 * only: no connection, no file, nothing printed with a value of the URL. They refuse, and name the
 * variable or flag at fault, and never quote the URL (it carries the password).
 *
 * The target is DEMO_DATABASE_URL, read from the owner's shell session only. It is never a file, a
 * command line argument, a chat message or a log line. Before the script connects it must be
 * well formed, must carry the host and database name that the owner typed again as
 * --confirm-host and --confirm-database, must not be the development database (DB_*) or the test
 * database (TEST_DATABASE_URL), and must not be a local host unless --allow-local is given.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Lower-cases a host and drops the brackets of an IPv6 address. */
function normalizeHost(host) {
  return String(host).toLowerCase().replace(/^\[|\]$/g, '');
}

/** Whether the host is one of the local names. */
function isLocal(host) {
  return LOCAL_HOSTS.includes(normalizeHost(host));
}

/** Decodes a URL component, or throws the script's own error. */
function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    throw new Error('DEMO_DATABASE_URL אינו כתובת תקינה.');
  }
}

/** Splits a postgres URL into { host, port, name, user, password }; throws without quoting the value. */
function parseDatabaseUrl(raw, variable) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variable} אינו כתובת תקינה.`);
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`${variable} חייב להתחיל ב-postgresql://`);
  }
  if (url.search || url.hash) throw new Error(`${variable} אסור שיכלול פרמטרים.`);
  if (!url.hostname) throw new Error(`ב-${variable} חסר מארח.`);

  const name = decode(url.pathname.replace(/^\//, ''));
  if (!name || name.includes('/')) throw new Error(`ב-${variable} חסר שם מסד.`);
  const user = decode(url.username);
  if (!user) throw new Error(`ב-${variable} חסר משתמש.`);
  const password = decode(url.password);
  if (!password) throw new Error(`ב-${variable} חסרה סיסמה.`);

  return {
    host: normalizeHost(url.hostname),
    port: url.port ? Number(url.port) : 5432,
    name,
    user,
    password,
  };
}

/** Whether two hosts are the same server: equal, or both local names. */
function sameServer(a, b) {
  return a.port === b.port && (a.host === b.host || (isLocal(a.host) && isLocal(b.host)));
}

/** The development database as server/config/env.js reads it from `env` (with its defaults). */
function developmentDatabase(env) {
  return {
    host: normalizeHost(env.DB_HOST || 'localhost'),
    port: Number(env.DB_PORT || 5432),
    name: env.DB_NAME || 'tamburia',
  };
}

/**
 * Validates the target and returns { host, port, name, user, password, local }. `env` is the
 * environment as it was BEFORE the script replaced DB_*, so the development database is still in it.
 * Throws an Error that names the variable or flag at fault and never quotes a value.
 */
function resolveDemoTarget({ env, confirmHost, confirmDatabase, allowLocal = false }) {
  if (!env.DEMO_DATABASE_URL) {
    throw new Error('חסר DEMO_DATABASE_URL. הגדירו אותו בסשן ה-PowerShell הנוכחי בלבד (לא בקובץ ולא בשורת הפקודה).');
  }
  const target = parseDatabaseUrl(env.DEMO_DATABASE_URL, 'DEMO_DATABASE_URL');

  if (!confirmHost || !confirmDatabase) {
    throw new Error('חסרים --confirm-host ו---confirm-database. הקלידו אותם בעצמכם, זהים לכתובת היעד.');
  }
  if (normalizeHost(confirmHost) !== target.host) {
    throw new Error('--confirm-host אינו זהה למארח שב-DEMO_DATABASE_URL.');
  }
  if (confirmDatabase !== target.name) {
    throw new Error('--confirm-database אינו זהה לשם המסד שב-DEMO_DATABASE_URL.');
  }

  const local = isLocal(target.host);
  if (local && !allowLocal) {
    throw new Error('DEMO_DATABASE_URL מצביע על מארח מקומי. הוסיפו --allow-local רק לחזרה על מסד זמני.');
  }
  if (!local && allowLocal) {
    throw new Error('--allow-local מותר רק עם מארח מקומי.');
  }

  const dev = developmentDatabase(env);
  if (sameServer(target, dev) && target.name === dev.name) {
    throw new Error('DEMO_DATABASE_URL מצביע על מסד הפיתוח (DB_*). אסור.');
  }

  if (env.TEST_DATABASE_URL) {
    let test = null;
    try {
      test = parseDatabaseUrl(env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    } catch {
      test = null; // a malformed test URL cannot be the target; the test guard reports it itself
    }
    if (test && sameServer(target, test) && target.name === test.name) {
      throw new Error('DEMO_DATABASE_URL מצביע על מסד הבדיקות (TEST_DATABASE_URL). אסור.');
    }
  }

  return { ...target, local };
}

/**
 * Writes the target into the variables server/config/env.js and db.js read (DB_*, DB_SSL), and sets
 * what that configuration needs so it loads: development mode, no mail, no demo mode. Call it before
 * the server configuration is required.
 */
function applyDemoTarget(env, target) {
  env.DB_HOST = target.host;
  env.DB_PORT = String(target.port);
  env.DB_NAME = target.name;
  env.DB_USER = target.user;
  env.DB_PASSWORD = target.password;
  env.DB_SSL = target.local ? 'false' : 'true';
  env.DB_LOG_QUERIES = 'false';
  env.NODE_ENV = 'development';
  env.MAIL_ENABLED = 'false';
  env.DEMO_MODE = 'false';
  delete env.DATABASE_URL;
  // required by the configuration loader; the scripts never log in
  env.ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'demo-script-unused';
  env.SESSION_SECRET = env.SESSION_SECRET || 'demo-script-unused-demo-script-unused';
}

/** Parses the flags of the demo scripts. Unknown flags are an error, so a typo cannot be ignored. */
function parseArgs(argv, { flags = [], values = [] } = {}) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const name = arg.replace(/^--/, '');
    if (!arg.startsWith('--')) throw new Error(`ארגומנט לא מוכר: ${arg}`);
    if (flags.includes(name)) {
      args[name] = true;
    } else if (values.includes(name)) {
      i += 1;
      if (argv[i] === undefined || argv[i].startsWith('--')) throw new Error(`לדגל --${name} חסר ערך.`);
      args[name] = argv[i];
    } else {
      throw new Error(`דגל לא מוכר: --${name}`);
    }
  }
  return args;
}

module.exports = {
  normalizeHost, isLocal, parseDatabaseUrl, resolveDemoTarget, applyDemoTarget, parseArgs,
};
