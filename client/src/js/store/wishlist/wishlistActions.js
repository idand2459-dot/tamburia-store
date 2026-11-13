/**
 * Wishlist actions.
 *
 * The state holds the saved products themselves (one small record each), so every screen reads
 * the same list. toggleWishlist is a plain action: the reducer adds the product or removes it, and
 * the persistence layer (store/persistence.js) copies the result to localStorage.
 */

export const WISHLIST_TOGGLED = 'WISHLIST_TOGGLED';

/** Adds the product to the wishlist, or removes it when it is already there. */
export function toggleWishlist(product) {
  return { type: WISHLIST_TOGGLED, product };
}
