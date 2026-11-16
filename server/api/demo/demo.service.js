/**
 * The portfolio demo's rules that need the database: which database the server may run on, the
 * cleanup of visitor orders and the cap on how many are kept (plan 006, Phases 2 and 6).
 *
 * The marker (table demo_database_marker) is created only by `npm run demo:bootstrap`, never by the
 * server. At startup the server only verifies it, before any write:
 *   - DEMO_MODE on: the table must exist with one row whose id equals DEMO_DATABASE_ID and whose
 *     state is 'ready';
 *   - DEMO_MODE off: the table must not exist (a demo database never serves the real store).
 *
 * A Render free instance sleeps, so no timer is relied on: cleanup is bounded work done when the
 * process wakes (startup), when an order is created and when the admin reads orders.
 */
const config = require('../../config/env');
const repository = require('./demo.repository');
const { IDENTITIES, IDENTITY_PHONES } = require('./demo.rules');
const { AppError } = require('../../utils/AppError');

/** The most visitor orders one cleanup statement deletes; the rest go in the next run. */
const CLEANUP_BATCH = 200;

/** At most one throttled cleanup per process in this many milliseconds. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let lastCleanupAt = 0;

/** Whether this process runs as the portfolio demo. */
function isDemoMode() {
  return config.demo.enabled;
}

/** What the storefront may know: whether this is a demo, and the identities it fills the checkout with. */
function getPublicInfo() {
  if (!isDemoMode()) return { demo: false };
  return { demo: true, identities: IDENTITIES };
}

/**
 * Decides whether the connected database may be served in the current mode, from the marker alone
 * and without writing anything. Returns { ok: true } or { ok: false, reason }; the reasons name no
 * value.
 */
async function checkDatabaseIdentity() {
  const hasMarker = await repository.markerTableExists();

  if (!config.demo.enabled) {
    return hasMarker
      ? { ok: false, reason: 'מסד הנתונים הזה שייך לאתר הדגמה. שרת רגיל אינו עולה עליו.' }
      : { ok: true };
  }

  if (!hasMarker) {
    return { ok: false, reason: 'מצב הדגמה דורש מסד הדגמה מסומן. המסד הזה אינו מסומן, ולכן השרת לא עולה.' };
  }
  const marker = await repository.readMarker();
  if (!marker) return { ok: false, reason: 'סימון מסד ההדגמה ריק. השרת לא עולה.' };
  if (marker.id !== config.demo.databaseId) {
    return { ok: false, reason: 'DEMO_DATABASE_ID אינו תואם לסימון שבמסד. השרת לא עולה.' };
  }
  if (marker.state !== 'ready') {
    return { ok: false, reason: 'אתחול מסד ההדגמה לא הסתיים. הריצו את demo:bootstrap עם --resume. השרת לא עולה.' };
  }
  return { ok: true };
}

/** Throws when the database may not be served in this mode. Called once at startup, before any write. */
async function assertDatabaseIdentity() {
  const result = await checkDatabaseIdentity();
  if (!result.ok) throw new Error(result.reason);
}

/**
 * Deletes expired visitor orders (a bounded batch) and returns how many. Does nothing outside demo
 * mode and does nothing unless the marker is present, matches and is ready (re-read before every
 * delete). `force` skips the throttle; without it at most one run per five minutes happens.
 */
async function cleanupExpired({ force = false } = {}) {
  if (!isDemoMode()) return 0;
  // Only a throttled run consumes the interval: a forced run (startup, a full cap) must not make the
  // first admin read after it wait five minutes.
  if (!force) {
    if (Date.now() - lastCleanupAt < CLEANUP_INTERVAL_MS) return 0;
    lastCleanupAt = Date.now();
  }

  const identity = await checkDatabaseIdentity();
  if (!identity.ok) return 0;

  return repository.deleteExpiredVisitorOrders({
    phones: IDENTITY_PHONES,
    ttlHours: config.demo.orderTtlHours,
    limit: CLEANUP_BATCH,
  });
}

/**
 * Refuses a new demo order (429) when the cap of visitor orders is reached, after trying a cleanup.
 * The check is approximate under concurrency, which is acceptable at this size.
 */
async function assertVisitorCapacity() {
  if (!isDemoMode()) return;

  await cleanupExpired();
  let total = await repository.countVisitorOrders(IDENTITY_PHONES);
  if (total >= config.demo.maxVisitorOrders) {
    await cleanupExpired({ force: true });
    total = await repository.countVisitorOrders(IDENTITY_PHONES);
  }
  if (total >= config.demo.maxVisitorOrders) {
    throw new AppError(
      429,
      'באתר ההדגמה כבר נשמרו הזמנות רבות. הזמנות הדגמה נמחקות אוטומטית אחרי כמה ימים, נסו שוב מאוחר יותר',
      { reason: 'demo_order_cap' }
    );
  }
}

/** Resets the cleanup throttle. Used by the tests only. */
function resetCleanupThrottle() {
  lastCleanupAt = 0;
}

module.exports = {
  isDemoMode, getPublicInfo, checkDatabaseIdentity, assertDatabaseIdentity, cleanupExpired,
  assertVisitorCapacity, resetCleanupThrottle,
};
