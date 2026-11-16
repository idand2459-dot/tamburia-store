/**
 * Browser-level end-to-end suite (P9): the real storefront and admin (client/build), the real
 * Express API and a real PostgreSQL, driven by Chrome through puppeteer-core.
 *
 *   npm run test:e2e
 *
 * Safety, in order, and each step before the next:
 *   1. the whole database guard (test/lib/testDatabase.js, through startTestServer): production,
 *      TEST_DATABASE_URL, a local host, not the development database, a name with "test", and
 *      the server's own identity. A refusal ends the run before anything else happens;
 *   2. mail is off (MAIL_ENABLED=false is forced by startTestServer): no customer email leaves;
 *      there is no payment or other external service in this application;
 *   3. the server listens on 127.0.0.1 on a port the operating system picks, and serves the build;
 *   4. fixtures carry the E2E prefix, are removed by id, and a prefix sweep removes leftovers of
 *      an interrupted run before and after.
 *
 * What cannot run is reported as blocked (never as passed): no Chrome, no client build, no
 * ADMIN_PASSWORD. The exit code is 0 only when nothing failed and nothing was blocked.
 */
process.env.MAIL_ENABLED = 'false';
process.env.DB_LOG_QUERIES = 'false';

const fs = require('fs');
const path = require('path');
const { startTestServer } = require('../lib/testServer');
const { check, block, scenario, summary, abortRun } = require('./lib/harness');
const fx = require('./lib/fixtures');
const { findChrome, launch } = require('./lib/browser');
const { login } = require('../helpers');

const SPECS = (process.env.E2E_SPECS || 'customer,admin,failures').split(',');
const BUILD_INDEX = path.join(__dirname, '..', '..', 'client', 'build', 'index.html');

async function main() {
  let server;
  try {
    server = await startTestServer();
  } catch (err) {
    console.error('✗ הבדיקה לא רצה:', err.message);
    process.exit(1);
  }

  let browser = null;
  let db = null;
  let closing = false;

  /** Closes the browser, removes the fixtures and stops the server; safe to call once. */
  async function shutdown() {
    closing = true;
    if (browser) await browser.close().catch(() => {});
    browser = null;
    if (db) {
      const left = await fx.cleanup(db).catch((err) => ({ error: err.message }));
      if (left.error) check('ניקוי נתוני הבדיקה', false, left.error);
      else check(`ניקוי: נמחקו ${left.removedOrders} הזמנות ו-${left.removedProducts} מוצרים, ולא נשארו שרידים`, left.orders === 0 && left.products === 0, left);
    }
    await server.close().catch(() => {});
  }

  const interrupted = async () => {
    await shutdown();
    process.exit(130);
  };
  process.once('SIGINT', interrupted);
  process.once('SIGTERM', interrupted);

  let exitCode = 1;
  try {
    db = require('../../server/config/db');
    const requirements = [];
    const chrome = findChrome();
    if (!chrome) requirements.push('אין Chrome/Edge מותקן (אפשר להגדיר CHROME_PATH)');
    if (!fs.existsSync(BUILD_INDEX)) requirements.push('אין client/build — הריצו npm run build:client');
    if (!process.env.ADMIN_PASSWORD) requirements.push('חסר ADMIN_PASSWORD (מתוך .env.example)');

    if (requirements.length) {
      for (const reason of requirements) block('כל חבילת ה-E2E', reason);
    } else {
      await fx.sweepLeftovers(db);
      const cookie = await login(server.baseUrl);
      const api = fx.createApi(server.baseUrl, cookie);
      const catalog = await fx.createCatalog(api);
      browser = await launch(chrome);
      browser.on('disconnected', () => { if (browser && !closing) abortRun('Chrome נותק באמצע הריצה: שאר התרחישים לא רצו'); });

      const ctx = { baseUrl: server.baseUrl, browser, db, api, catalog, cookie };
      for (const name of SPECS) {
        await require(`./specs/${name}`).run(ctx, scenario);
      }
    }
  } catch (err) {
    check('הרצת החבילה', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  } finally {
    await shutdown();
    exitCode = summary();
  }
  process.exit(exitCode);
}

main();
