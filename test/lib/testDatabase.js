/**
 * שומר שהבדיקות לא ייגעו בשום מסד פרט למסד מקומי.
 *
 * הבדיקות יוצרות ומוחקות רשומות, ו-npm run a11y מתחבר כאדמין: אסור להן
 * להגיע למסד בענן, גם אם DATABASE_URL של הענן נשאר בסביבה בטעות.
 *
 *   1. NODE_ENV=production — מסרב.
 *   2. TEST_DATABASE_URL (מסד מקומי נפרד, שנוצר עם createdb) — משמש כ-DATABASE_URL
 *      של הריצה, וגובר על כל DATABASE_URL שכבר בסביבה.
 *   3. בלעדיו — המסד שמוגדר ב-DB_* או ב-DATABASE_URL, ורק אם המארח שלו מקומי.
 *      זה המצב של היום: אזהרה בלבד, כי הבדיקות כותבות רשומות זמניות למסד הפיתוח.
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

  if (env.TEST_DATABASE_URL) {
    const host = hostOf(env.TEST_DATABASE_URL);
    if (host === null) throw new Error('TEST_DATABASE_URL אינו כתובת תקינה.');
    assertLocal(host, 'TEST_DATABASE_URL');
    env.DATABASE_URL = env.TEST_DATABASE_URL;
    return { source: 'TEST_DATABASE_URL', host, separate: true };
  }

  if (env.DATABASE_URL) {
    const host = hostOf(env.DATABASE_URL);
    if (host === null) throw new Error('DATABASE_URL אינו כתובת תקינה.');
    assertLocal(host, 'DATABASE_URL');
    return { source: 'DATABASE_URL', host, separate: false };
  }

  const host = env.DB_HOST || 'localhost';
  assertLocal(host, 'DB_HOST');
  return { source: 'DB_*', host, separate: false };
}

/** One line for the run's log; a run without a separate database says so. */
function describeTestDatabase(result) {
  if (result.separate) return `מסד בדיקות נפרד (${result.source}, ${result.host})`;
  return `⚠ אין TEST_DATABASE_URL: הבדיקות כותבות רשומות זמניות למסד הפיתוח (${result.source}, ${result.host})`;
}

module.exports = { prepareTestDatabase, describeTestDatabase, LOCAL_HOSTS };
