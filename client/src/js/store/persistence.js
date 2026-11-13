/**
 * Reading and writing the storefront state in localStorage.
 *
 * Same keys, same shapes and the same error handling as the hooks this replaced (useCart and
 * useWishlist, removed in P4R). The cart is written when the store is created (the old effect wrote it on
 * startup, which also overwrote an unreadable stored value with an empty cart) and after every
 * change of its lines. The delivery method and the availability are never stored. The cart
 * write is not guarded by try/catch, as before.
 *
 * The wishlist is the opposite on startup: it is only written after a change of its items, so an
 * unreadable stored list is not overwritten until the customer changes the wishlist. A blocked
 * localStorage is swallowed: the wishlist then simply does not save.
 */

export const CART_STORAGE_KEY = 'tamburia-cart';
export const WISHLIST_STORAGE_KEY = 'tamburia-wishlist';

/** The stored cart lines, or an empty list when nothing readable is stored. */
export function readCartItems() {
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; }
  catch { return []; }
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
 * Writes the cart now, and again whenever its lines change (a new `items` array).
 * Returns the function that stops listening.
 */
export function persistCart(store) {
  let lastItems = store.getState().cart.items;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lastItems));

  return store.subscribe(() => {
    const { items } = store.getState().cart;
    if (items === lastItems) return;
    lastItems = items;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  });
}

/** Writes the wishlist whenever its items change (a new `items` array). Returns the stop function. */
export function persistWishlist(store) {
  let lastItems = store.getState().wishlist.items;

  return store.subscribe(() => {
    const { items } = store.getState().wishlist;
    if (items === lastItems) return;
    lastItems = items;
    try { localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items)); }
    catch { /* localStorage חסום — המועדפים פשוט לא נשמרים */ }
  });
}
