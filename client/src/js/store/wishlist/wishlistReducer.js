/**
 * Wishlist reducer: the products the customer saved, in the order they were saved.
 *
 * A saved product is kept as a small snapshot (the fields the wishlist screen draws), not as the
 * whole product: a stored copy of a full product would go stale and grow without need.
 */
import { WISHLIST_TOGGLED } from './wishlistActions';

export const initialWishlistState = { items: [] };

/** The canonical saved record of a product. */
function toRecord(product) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    image_url: product.image_url,
    in_stock: product.in_stock,
    category: product.category,
  };
}

/** Returns the next wishlist state for an action. */
export function wishlistReducer(state = initialWishlistState, action) {
  switch (action.type) {
    case WISHLIST_TOGGLED: {
      const { product } = action;
      const items = state.items.some((item) => item.id === product.id)
        ? state.items.filter((item) => item.id !== product.id)
        : [...state.items, toRecord(product)];
      return { ...state, items };
    }

    default:
      return state;
  }
}
