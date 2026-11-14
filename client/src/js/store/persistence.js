/**
 * Reading and writing the storefront state in localStorage.
 *
 * The keys and the shapes are the ones the hooks this replaced used (useCart and useWishlist,
 * removed in P4R). Nothing is written when the store is created: stored data is validated on the
 * way in, and what is stored stays exactly as it was (even when it is unreadable) until the
 * customer changes the cart, the pending price changes or the wishlist. The first change writes
 * the validated state. A blocked localStorage is swallowed: the page then simply does not save.
 *
 * The delivery method and the availability are never stored.
 *
 * The one exception to "nothing is written until the customer changes something" is the checkout
 * attempt (see below), which is written when an order is submitted, removed when it is resolved,
 * and stripped of the customer's details 48 hours after it was submitted.
 */

import { REQUEST_ID_PATTERN } from '../utils/requestId';

export const CART_STORAGE_KEY = 'tamburia-cart';
export const PRICE_CHANGES_STORAGE_KEY = 'tamburia-cart-price-changes';
export const WISHLIST_STORAGE_KEY = 'tamburia-wishlist';
export const CHECKOUT_ATTEMPT_STORAGE_KEY = 'tamburia-checkout-attempt';

/** Whether the value is a price: a finite number, or a numeric string, that is not negative. */
function isPrice(value) {
  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

/** Whether a stored entry can be a cart line: a product id, a name, a price, and a whole quantity. */
function isCartLine(item) {
  return Boolean(item) && typeof item === 'object'
    && Number.isInteger(item.id) && item.id > 0
    && typeof item.name === 'string'
    && isPrice(item.price)
    && (item.quantity === undefined || (Number.isInteger(item.quantity) && item.quantity >= 1));
}

/** The stored array, or [] when nothing readable is stored. */
function readArray(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/**
 * The stored cart lines that are valid; an unreadable value, a value that is not a list, and
 * entries that cannot be a cart line (null, a bad id, a bad quantity, no price) are dropped.
 * A line without a quantity is kept: it counts as one.
 */
export function readCartItems() {
  return readArray(CART_STORAGE_KEY).filter(isCartLine);
}

/**
 * The price changes the customer has not acknowledged yet, as stored; see cartReducer. A record
 * is kept only if every field the cart screens draw has the right type (the name is rendered, so
 * an object there would crash the page): id a whole number, name a string, variant a string or
 * null (the reducer always writes one of the two), and both prices valid.
 */
export function readPriceChanges() {
  return readArray(PRICE_CHANGES_STORAGE_KEY).filter((change) => Boolean(change) && typeof change === 'object'
    && Number.isInteger(change.id) && typeof change.name === 'string'
    && (change.selectedVariant === null || typeof change.selectedVariant === 'string')
    && isPrice(change.from) && isPrice(change.to));
}

/**
 * The stored wishlist records, or an empty list when nothing readable is stored. Anything that is
 * not an array, an entry without a numeric id, and a repeated id (the first one wins) is dropped.
 * Reading never writes: a stored value that cannot be read stays until the first change replaces it.
 */
export function readWishlistItems() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)); }
  catch { return []; }
  if (!Array.isArray(stored)) return [];

  const seen = new Set();
  return stored.filter((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'number' || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Writes a value; a blocked or full localStorage is swallowed. Returns whether the value was
 * stored, checked by reading it back, so a caller that must not promise more than it can keep
 * (the checkout attempt) can tell.
 */
function write(key, value) {
  try {
    const text = JSON.stringify(value);
    localStorage.setItem(key, text);
    return localStorage.getItem(key) === text;
  } catch {
    /* localStorage חסום — הנתון פשוט לא נשמר */
    return false;
  }
}

/**
 * Writes the cart lines, and the price changes awaiting acknowledgment, whenever their arrays
 * change (a new `items` or `priceChanges` array). The pending changes are stored too, so
 * that reloading the page, or opening /checkout directly, cannot skip the acknowledgment.
 * Returns the function that stops listening.
 */
export function persistCart(store) {
  let lastItems = store.getState().cart.items;
  let lastChanges = store.getState().cart.priceChanges;

  return store.subscribe(() => {
    const { items, priceChanges } = store.getState().cart;
    if (items !== lastItems) {
      lastItems = items;
      write(CART_STORAGE_KEY, items);
    }
    if (priceChanges !== lastChanges) {
      lastChanges = priceChanges;
      write(PRICE_CHANGES_STORAGE_KEY, priceChanges || []);
    }
  });
}

/** Writes the wishlist whenever its items change (a new `items` array). Returns the stop function. */
export function persistWishlist(store) {
  let lastItems = store.getState().wishlist.items;

  return store.subscribe(() => {
    const { items } = store.getState().wishlist;
    if (items === lastItems) return;
    lastItems = items;
    write(WISHLIST_STORAGE_KEY, items);
  });
}

/**
 * The checkout attempt: an order that was sent and whose outcome the customer has not seen
 * confirmed. It has two shapes.
 *
 * Active, for the first 48 hours (CHECKOUT_ATTEMPT_RETENTION_MS) after it was submitted:
 * { requestId, body, submittedAt }. `body` is the exact request body that was sent (it already
 * carries request_id), so sending it again is a true retry that the server can match. It holds the
 * customer's order details (name, phone, email, address, notes) and nothing else: no payment data
 * exists in this app. `submittedAt` is set once, when the attempt is first stored, and a retry
 * stores the very same value: sending again never extends the retention.
 *
 * Expired, from 48 hours on: { requestId, submittedAt, expired: true, itemCount, total }. The body
 * and with it every personal detail is gone; what is left is only what the notice shows (when it
 * was sent, how many items, how much). It cannot be sent again, because there is nothing to send
 * and a new body under the old request_id would be a different order. The server may or may not
 * hold the order, so this record means "outcome unknown: ask the store", never "failed".
 *
 * The active shape becomes the expired one when it is read (page load, a send, or the page's own
 * timer, see useCheckoutForm), so no clock has to run while the browser is closed. A record whose
 * timestamp is missing, not a number, or in the future beyond a small clock skew cannot be dated,
 * so it is treated as expired. A record that cannot be read at all is removed. Either way the
 * attempt leaves the device when it is removed (cancelled, or the order was confirmed or refused).
 */
export const CHECKOUT_ATTEMPT_RETENTION_MS = 48 * 60 * 60 * 1000;

/** How far ahead of the clock a timestamp may be before it is not trusted (a clock set back). */
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;

/** Whether the attempt submitted at `submittedAt` has reached the end of its retention (or cannot be dated). */
export function isCheckoutAttemptDue(submittedAt, now = Date.now()) {
  if (typeof submittedAt !== 'number' || !Number.isFinite(submittedAt) || submittedAt <= 0) return true;
  if (submittedAt > now + MAX_FUTURE_SKEW_MS) return true;
  return now - submittedAt >= CHECKOUT_ATTEMPT_RETENTION_MS;
}

/** The time if it can be trusted as a past moment, else null (missing, not a number, or in the future). */
function datedOrNull(submittedAt, now) {
  const ok = typeof submittedAt === 'number' && Number.isFinite(submittedAt) && submittedAt > 0
    && submittedAt <= now + MAX_FUTURE_SKEW_MS;
  return ok ? submittedAt : null;
}

/** Whether the body is the one an attempt of this request id holds: an object with items and the same id. */
function isAttemptBody(body, requestId) {
  return Boolean(body) && typeof body === 'object'
    && body.request_id === requestId
    && Array.isArray(body.items) && body.items.length > 0;
}

/**
 * The expired record for an attempt: the request id and the three non-personal facts the notice
 * shows. `body` may be missing or damaged; then the count is 0 and the total null, and the notice
 * leaves them out.
 */
function reducedAttempt(requestId, submittedAt, body, now = Date.now()) {
  const items = body && Array.isArray(body.items) ? body.items : [];
  return {
    requestId,
    submittedAt: datedOrNull(submittedAt, now),
    expired: true,
    itemCount: items.reduce((sum, item) => sum + (Number.isInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 1), 0),
    total: body && typeof body.total === 'number' && Number.isFinite(body.total) ? body.total : null,
  };
}

/** Removes the stored attempt. */
export function clearCheckoutAttempt() {
  try { localStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY); }
  catch { /* localStorage חסום — אין מה למחוק */ }
}

/**
 * Replaces the stored attempt with its expired record. If that cannot be written the key is removed
 * instead, so the personal details do not stay because of a failed write. Returns whether the
 * expired record is what is stored now.
 */
function storeReduced(reduced) {
  if (write(CHECKOUT_ATTEMPT_STORAGE_KEY, reduced)) return true;
  clearCheckoutAttempt();
  return false;
}

/**
 * Ends the retention of an attempt that is in memory: stores its expired record in place of the
 * body and returns { record, stored }. Used by the checkout when the time ran out while the page
 * was open.
 */
export function expireCheckoutAttempt({ requestId, body, submittedAt }) {
  const record = reducedAttempt(requestId, submittedAt, body);
  return { record, stored: storeReduced(record) };
}

/**
 * The stored checkout attempt, or null when there is none or nothing in it can be used. Active
 * within the retention, the expired record at or after it. Reading an attempt that has run out of
 * time (or one that cannot be dated, or whose body is damaged but whose request id is valid) replaces
 * it in storage by the expired record before returning, so the personal details are removed at the
 * moment they are found. An unreadable value, or one without a valid request id, is removed.
 */
export function readCheckoutAttempt(now = Date.now()) {
  let text;
  try { text = localStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY); }
  catch { return null; }
  if (text === null || text === undefined) return null;

  let stored;
  try { stored = JSON.parse(text); }
  catch { clearCheckoutAttempt(); return null; }

  if (!stored || typeof stored !== 'object' || Array.isArray(stored)
    || typeof stored.requestId !== 'string' || !REQUEST_ID_PATTERN.test(stored.requestId)) {
    clearCheckoutAttempt();
    return null;
  }

  const { requestId, body, submittedAt } = stored;

  if (stored.expired === true) {
    // An expired record is kept exactly in its own shape; anything else it carries is dropped.
    const reduced = {
      requestId,
      submittedAt: datedOrNull(submittedAt, now),
      expired: true,
      itemCount: Number.isInteger(stored.itemCount) && stored.itemCount >= 0 ? stored.itemCount : 0,
      total: typeof stored.total === 'number' && Number.isFinite(stored.total) ? stored.total : null,
    };
    if (JSON.stringify(reduced) !== text) storeReduced(reduced);
    return reduced;
  }

  if (isAttemptBody(body, requestId) && !isCheckoutAttemptDue(submittedAt, now)) {
    return { requestId, body, submittedAt };
  }

  const reduced = reducedAttempt(requestId, submittedAt, isAttemptBody(body, requestId) ? body : null, now);
  storeReduced(reduced);
  return reduced;
}

/** Stores the attempt; false means it could not be stored (so it will not survive a reload). */
export function writeCheckoutAttempt({ requestId, body, submittedAt }) {
  return write(CHECKOUT_ATTEMPT_STORAGE_KEY, { requestId, body, submittedAt });
}
