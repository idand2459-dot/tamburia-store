/**
 * Keeps the test suites away from every database except a separate local one.
 *
 * The suites create and delete records, and `npm run a11y` logs in as admin, so they
 * must never reach the development database (or any remote one). This guard fails closed:
 *
 *   1. NODE_ENV=production: refuses.
 *   2. TEST_DATABASE_URL is required. Missing, empty, malformed (not a postgres URL, no
 *      host, user, password or database name, or carrying query parameters) or non-local:
 *      refuses.
 *   3. It may not be the development database: the same server (host and port, with the
 *      local names counted as one server) and the same database name as DB_*, using the
 *      defaults server/config/env.js uses when DB_* is unset.
 *
 * server/config/env.js only reads DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD, so
 * the URL is translated into those variables, before that file is loaded. A leftover
 * DATABASE_URL is removed so it can never win. Because a variable that is set is not the
 * same as a variable that is used, callers then confirm the configuration the server
 * really loaded with assertEffectiveDatabase().
 *
 * Messages name the variable only: a connection URL carries the password, so no value is
 * ever printed.
 */
const path = require('path');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** What server/config/env.js uses for the development database when DB_* is unset. */
const DEV_DEFAULTS = { host: 'localhost', port: 5432, name: 'tamburia' };

/** Lower-cases a host and drops the brackets of an IPv6 address. */
function normalizeHost(host) {
  return String(host).toLowerCase().replace(/^\[|\]$/g, '');
}

/** Whether the host is one of the local names. */
function isLocal(host) {
  return LOCAL_HOSTS.includes(normalizeHost(host));
}

/** Decodes a URL component, or throws the guard's own error. */
function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    throw new Error('TEST_DATABASE_URL אינו כתובת תקינה.');
  }
}

/**
 * Splits TEST_DATABASE_URL into the fields the server configuration takes.
 * Throws an error that names the variable and never quotes the value.
 */
function parseTestDatabaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('TEST_DATABASE_URL אינו כתובת תקינה.');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('TEST_DATABASE_URL חייב להתחיל ב-postgresql://');
  }
  if (url.search || url.hash) {
    throw new Error('TEST_DATABASE_URL אסור שיכלול פרמטרים.');
  }
  if (!url.hostname) throw new Error('ב-TEST_DATABASE_URL חסר מארח.');

  const name = decode(url.pathname.replace(/^\//, ''));
  if (!name || name.includes('/')) throw new Error('ב-TEST_DATABASE_URL חסר שם מסד.');

  const user = decode(url.username);
  if (!user) throw new Error('ב-TEST_DATABASE_URL חסר משתמש.');

  // server/config/env.js treats an empty DB_PASSWORD as missing, so the guard does too.
  const password = decode(url.password);
  if (!password) throw new Error('ב-TEST_DATABASE_URL חסרה סיסמה.');

  return {
    host: normalizeHost(url.hostname),
    port: url.port ? Number(url.port) : 5432,
    name,
    user,
    password,
  };
}

/** The development database, as server/config/env.js would read it from `env`. */
function developmentDatabase(env) {
  return {
    host: normalizeHost(env.DB_HOST || DEV_DEFAULTS.host),
    port: Number(env.DB_PORT || DEV_DEFAULTS.port),
    name: env.DB_NAME || DEV_DEFAULTS.name,
  };
}

/** Whether two hosts are the same server: equal, or both local names. */
function sameHost(a, b) {
  return a === b || (isLocal(a) && isLocal(b));
}

/**
 * Applies the guard to `env` and returns the database the run will use (no password).
 * Throws an Error whose message names the variable at fault.
 *
 * With the real process environment it first loads the local environment file the same
 * way server/config/env.js does (dotenv never overrides a variable that is already set),
 * so TEST_DATABASE_URL and DB_* can come from there.
 */
function prepareTestDatabase(env = process.env) {
  if (env === process.env) {
    require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production: הבדיקות לא רצות בייצור.');
  }

  if (!env.TEST_DATABASE_URL) {
    throw new Error(
      'חסר TEST_DATABASE_URL. הבדיקות רצות רק מול מסד מקומי נפרד: צור אותו עם createdb ' +
      'והוסף ל-.env שורה בצורה TEST_DATABASE_URL=postgresql://<משתמש>:<סיסמה>@localhost:5432/<שם המסד>.',
    );
  }

  const target = parseTestDatabaseUrl(env.TEST_DATABASE_URL);
  if (!isLocal(target.host)) {
    throw new Error('TEST_DATABASE_URL מצביע על מארח שאינו מקומי. הבדיקות רצות רק מול מסד מקומי.');
  }

  // Read before DB_* is overwritten below: this is the development database.
  const dev = developmentDatabase(env);
  if (sameHost(target.host, dev.host) && target.port === dev.port && target.name === dev.name) {
    throw new Error('TEST_DATABASE_URL מצביע על מסד הפיתוח (DB_*). הבדיקות צריכות מסד נפרד.');
  }

  env.DB_HOST = target.host;
  env.DB_PORT = String(target.port);
  env.DB_NAME = target.name;
  env.DB_USER = target.user;
  env.DB_PASSWORD = target.password;
  delete env.DATABASE_URL;

  return { source: 'TEST_DATABASE_URL', host: target.host, port: target.port, name: target.name, user: target.user };
}

/**
 * Confirms that the database configuration the server actually loaded (`config.db` from
 * server/config/env.js) is the test database that prepareTestDatabase() returned.
 * Throws otherwise, so a run can never continue on a database it did not mean to use.
 */
function assertEffectiveDatabase(target, effective) {
  const matches = Boolean(effective)
    && normalizeHost(effective.host) === target.host
    && Number(effective.port) === target.port
    && effective.name === target.name
    && effective.user === target.user;

  if (!matches) {
    throw new Error('הגדרת המסד שהשרת טען (config.db) אינה מסד הבדיקות. הבדיקות לא רצות.');
  }
}

/** One line for the run's log: the database name and where it is, never the password. */
function describeTestDatabase(target) {
  return `מסד בדיקות נפרד (${target.name} @ ${target.host}:${target.port})`;
}

module.exports = {
  prepareTestDatabase, assertEffectiveDatabase, describeTestDatabase, LOCAL_HOSTS,
};
