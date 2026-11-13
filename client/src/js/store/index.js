/**
 * The storefront's Redux store.
 *
 * createAppStore builds a store from what localStorage holds right now, the way the old hooks
 * read it when the app mounted; App.js calls it once per mount. Pass a state to start from
 * another one (tests do). createStore is the classic API; recent Redux versions mark it as
 * deprecated in favor of Redux Toolkit, which this project does not use. It works the same.
 *
 * State shape:
 *   cart:         { items: [...], deliveryMethod: null | 'pickup' | 'delivery', priceChanges: [...] }
 *   wishlist:     { items: [{ id, name, price, image_url, in_stock, category }] }
 *   availability: { unavailableIds: [...], unavailableVariants: [...] }
 */
import { createStore, applyMiddleware, combineReducers } from 'redux';
import { thunk } from 'redux-thunk';
import { cartReducer } from './cart/cartReducer';
import { wishlistReducer } from './wishlist/wishlistReducer';
import { availabilityReducer } from './availability/availabilityReducer';
import { readCartItems, readPriceChanges, readWishlistItems, persistCart, persistWishlist } from './persistence';

/** One reducer per domain of the shared state. */
export const rootReducer = combineReducers({
  cart: cartReducer,
  wishlist: wishlistReducer,
  availability: availabilityReducer,
});

/** Builds the store and starts saving the cart and the wishlist to localStorage (from the first change on). */
export function createAppStore(preloadedState) {
  const initialState = preloadedState || {
    cart: { items: readCartItems(), deliveryMethod: null, priceChanges: readPriceChanges() },
    wishlist: { items: readWishlistItems() },
    availability: { unavailableIds: [], unavailableVariants: [] },
  };

  const store = createStore(rootReducer, initialState, applyMiddleware(thunk));
  persistCart(store);
  persistWishlist(store);
  return store;
}
