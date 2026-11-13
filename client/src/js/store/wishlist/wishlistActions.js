/**
 * Wishlist actions.
 *
 * The state holds only the ids, which is what the cards and the navbar need to draw a full or an
 * empty heart. The full records stay in localStorage, which is the source of truth; toggleWishlist
 * reads it again on every toggle so that no second copy can drift from it.
 */
import { WISHLIST_STORAGE_KEY } from '../persistence';

export const WISHLIST_IDS_SET = 'WISHLIST_IDS_SET';

/** Replaces the wishlist ids. */
export function setWishlistIds(ids) {
  return { type: WISHLIST_IDS_SET, ids };
}

/**
 * Thunk: adds the product to the stored wishlist, or removes it when it is already there, and
 * stores the new ids in the state. A blocked or unreadable localStorage is swallowed: the
 * wishlist then simply does not save.
 */
export function toggleWishlist(product) {
  return (dispatch) => {
    try {
      const current = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)) || [];
      const exists = current.find((p) => p.id === product.id);
      const updated = exists
        ? current.filter((p) => p.id !== product.id)
        : [...current, {
          id: product.id, name: product.name, price: product.price,
          image_url: product.image_url, in_stock: product.in_stock,
        }];
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(updated));
      dispatch(setWishlistIds(updated.map((p) => p.id)));
    } catch { /* localStorage חסום — המועדפים פשוט לא נשמרים */ }
  };
}
