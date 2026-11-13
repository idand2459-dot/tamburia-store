/**
 * The storefront's Redux store.
 *
 * createAppStore builds a store from what localStorage holds right now, the way the old hooks
 * read it when the app mounted; App.js calls it once per mount. Pass a state to start from
 * another one (tests do). createStore is the classic API; recent Redux versions mark it as
 * deprecated in favor of Redux Toolkit, which this project does not use. It works the same.
 *
 * State shape:
 *   cart:         { items: [...], deliveryMethod: null | 'pickup' | 'delivery' }
 *   wishlist:     { ids: [...] }
 *   availability: { unavailableIds: [...] }
 */
import { createStore, applyMiddleware, combineReducers } from 'redux';
import { thunk } from 'redux-thunk';
import { cartReducer } from './cart/cartReducer';
import { wishlistReducer } from './wishlist/wishlistReducer';
import { availabilityReducer } from './availability/availabilityReducer';
import { readCartItems, readWishlistIds, persistCart } from './persistence';

/** One reducer per domain of the shared state. */
export const rootReducer = combineReducers({
  cart: cartReducer,
  wishlist: wishlistReducer,
  availability: availabilityReducer,
});

/** Builds the store and starts saving the cart to localStorage. */
export function createAppStore(preloadedState) {
  const initialState = preloadedState || {
    cart: { items: readCartItems(), deliveryMethod: null },
    wishlist: { ids: readWishlistIds() },
    availability: { unavailableIds: [] },
  };

  const store = createStore(rootReducer, initialState, applyMiddleware(thunk));
  persistCart(store);
  return store;
}
