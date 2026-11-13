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
 */

export const CART_STORAGE_KEY = 'tamburia-cart';
export const PRICE_CHANGES_STORAGE_KEY = 'tamburia-cart-price-changes';
export const WISHLIST_STORAGE_KEY = 'tamburia-wishlist';

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

/** Writes a value; a blocked or full localStorage is swallowed. */
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* localStorage חסום — הנתון פשוט לא נשמר */ }
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
