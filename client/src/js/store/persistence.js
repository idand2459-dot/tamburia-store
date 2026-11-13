/**
 * Reading and writing the storefront state in localStorage.
 *
 * Same keys, same shapes and the same error handling as the hooks this replaced (useCart and
 * useWishlist, removed in P4R). The cart is written when the store is created (the old effect wrote it on
 * startup, which also overwrote an unreadable stored value with an empty cart) and after every
 * change of its lines. The delivery method and the availability are never stored. The cart
 * write is not guarded by try/catch, as before.
 */

export const CART_STORAGE_KEY = 'tamburia-cart';
export const WISHLIST_STORAGE_KEY = 'tamburia-wishlist';

/** The stored cart lines, or an empty list when nothing readable is stored. */
export function readCartItems() {
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; }
  catch { return []; }
}

/** The ids of the stored wishlist records, or an empty list when nothing readable is stored. */
export function readWishlistIds() {
  try { return JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY))?.map((p) => p.id) || []; }
  catch { return []; }
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
