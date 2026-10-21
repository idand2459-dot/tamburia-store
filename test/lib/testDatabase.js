/**
 * שומר שהבדיקות לא ייגעו בשום מסד פרט למסד מקומי.
 *
 * הבדיקות יוצרות ומוחקות רשומות, ו-npm run a11y מתחבר כאדמין: אסור להן
 * להגיע למסד בענן, גם אם DATABASE_URL של הענן נשאר בסביבה בטעות.
 *
 *   1. NODE_ENV=production — מסרב.
 *   2. TEST_DATABASE_URL חובה: מסד מקומי נפרד, שנוצר עם createdb. הוא משמש
 *      כ-DATABASE_URL של הריצה, וגובר על כל DATABASE_URL שכבר בסביבה.
 *   3. המארח שלו חייב להיות מקומי, והוא לא יכול להיות מסד הפיתוח עצמו
 *      (אותו מארח, פורט ושם מסד כמו DB_*): הבדיקות מוחקות ויוצרות רשומות.
 *
 * ההודעות נוקבות בשם המשתנה בלבד. כתובת חיבור נושאת סיסמה, ולכן ערכה לא מודפס.
 */
const path = require('path');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** Returns the host of a connection URL, or null when it is not a valid URL. */
function hostOf(raw) {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** Returns the database name of a connection URL. */
function databaseOf(raw) {
  return decodeURIComponent(new URL(raw).pathname.slice(1));
}

/** Throws unless the host is a local one. `source` is the variable that supplied it. */
function assertLocal(host, source) {
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`${source} מצביע על מארח שאינו מקומי. הבדיקות רצות רק מול מסד מקומי.`);
  }
}

/**
 * Applies the guard to `env` and returns what the run will use.
 * Throws an Error whose message names the variable at fault.
 */
function prepareTestDatabase(env = process.env) {
  // dotenv does not override a variable that is already set, so loading it here
  // only fills what the shell left out, the same as server/config/env.js does.
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

  const host = hostOf(env.TEST_DATABASE_URL);
  if (host === null) throw new Error('TEST_DATABASE_URL אינו כתובת תקינה.');
  assertLocal(host, 'TEST_DATABASE_URL');

  // The development database is the one named by DB_*; the tests must never be pointed at it.
  const url = new URL(env.TEST_DATABASE_URL);
  const sameHost = host === (env.DB_HOST || 'localhost')
    || (LOCAL_HOSTS.includes(host) && LOCAL_HOSTS.includes(env.DB_HOST || 'localhost'));
  const samePort = Number(url.port || 5432) === Number(env.DB_PORT || 5432);
  if (sameHost && samePort && databaseOf(env.TEST_DATABASE_URL) === (env.DB_NAME || 'tamburia')) {
    throw new Error('TEST_DATABASE_URL מצביע על מסד הפיתוח (DB_*). הבדיקות צריכות מסד נפרד.');
  }

  env.DATABASE_URL = env.TEST_DATABASE_URL;
  return { source: 'TEST_DATABASE_URL', host };
}

/** One line for the run's log. */
function describeTestDatabase(result) {
  return `מסד בדיקות נפרד (${result.source}, ${result.host})`;
}

module.exports = { prepareTestDatabase, describeTestDatabase, LOCAL_HOSTS };
