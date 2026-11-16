/**
 * Wishlist selectors.
 */

export const selectWishlistItems = (state) => state.wishlist.items;

// The same items array always gives the same ids array, so a component that selects the ids is
// not rendered again when the state changes elsewhere.
let lastItems = null;
let lastIds = [];

/** The ids of the saved products, in saved order. */
export const selectWishlistIds = (state) => {
  const { items } = state.wishlist;
  if (items !== lastItems) {
    lastItems = items;
    lastIds = items.map((item) => item.id);
  }
  return lastIds;
};
