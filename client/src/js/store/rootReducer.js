/**
 * The root reducer: one reducer per domain of the storefront's shared state.
 *
 * State shape:
 *   cart:         { items: [...], deliveryMethod: null | 'pickup' | 'delivery' }
 *   wishlist:     { ids: [...] }
 *   availability: { unavailableIds: [...] }
 */
import { combineReducers } from 'redux';
import { cartReducer } from './cart/cartReducer';
import { wishlistReducer } from './wishlist/wishlistReducer';
import { availabilityReducer } from './availability/availabilityReducer';

export const rootReducer = combineReducers({
  cart: cartReducer,
  wishlist: wishlistReducer,
  availability: availabilityReducer,
});
