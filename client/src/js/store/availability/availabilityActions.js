/**
 * Availability actions: which products saved in the cart are no longer in the catalog.
 *
 * The cart, the wishlist and the recently viewed list keep a snapshot of the product from the
 * moment it was saved, so a product hidden since still looks buyable there. The thunk asks the
 * server once for all the ids of the cart and stores the ones that did not come back. The shop
 * only serves active products (server/controllers/product.controller), so "did not come back"
 * means hidden or deleted, which is the same thing for a customer.
 *
 * A network failure blocks nothing: the state stays as it was, and the order is stopped by the
 * server if it really holds a product that is not sold.
 */
import { getProducts } from '../../services/productService';

export const AVAILABILITY_LOADED = 'AVAILABILITY_LOADED';
export const AVAILABILITY_CLEARED = 'AVAILABILITY_CLEARED';

/** Stores the ids that are not in the catalog. */
export function availabilityLoaded(unavailableIds) {
  return { type: AVAILABILITY_LOADED, unavailableIds };
}

/** Forgets every unavailable id (the cart has nothing to check). */
export function availabilityCleared() {
  return { type: AVAILABILITY_CLEARED };
}

/**
 * Thunk: checks the ids in `key` (a comma-separated, sorted string from selectAvailabilityKey).
 * An empty key clears the result and asks nothing. Returns the function that aborts the request,
 * to be used as the cleanup of the effect that dispatched it.
 */
export function checkAvailability(key) {
  return (dispatch) => {
    if (!key) {
      dispatch(availabilityCleared());
      return undefined;
    }

    const controller = new AbortController();

    getProducts({ ids: key, signal: controller.signal })
      .then(({ products }) => {
        if (controller.signal.aborted) return;
        const inCatalog = new Set(products.map((product) => product.id));
        dispatch(availabilityLoaded(key.split(',').map(Number).filter((id) => !inCatalog.has(id))));
      })
      .catch(() => { /* ניתוק — לא חוסמים את הלקוח */ });

    return () => controller.abort();
  };
}
