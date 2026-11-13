/**
 * Wishlist reducer: the ids of the products the customer saved.
 */
import { WISHLIST_IDS_SET } from './wishlistActions';

export const initialWishlistState = { ids: [] };

/** Returns the next wishlist state for an action. */
export function wishlistReducer(state = initialWishlistState, action) {
  switch (action.type) {
    case WISHLIST_IDS_SET:
      return { ...state, ids: action.ids };

    default:
      return state;
  }
}
