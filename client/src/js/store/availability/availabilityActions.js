/**
 * Availability actions: which cart lines cannot be bought, and the freshness check of the cart.
 *
 * The cart, the wishlist and the recently viewed list keep a snapshot of the product from the
 * moment it was saved, so a product hidden, sold out or re-priced since still looks buyable
 * there. The thunk asks the server once for all the ids of the cart and compares each cart line
 * with the product that came back:
 *   - the product is missing (hidden or deleted), out of stock, or has no price: the product
 *     is unavailable and every one of its lines is blocked;
 *   - the line's variant no longer exists, or has no price: only that line is blocked;
 *   - the line's colour or size is no longer an option of the product: only that line is blocked
 *     (a null colour or size is fine, as the server allows it for calculator bundles);
 *   - the price differs: the line is re-priced, and the change is recorded for the customer to
 *     acknowledge (see CART_REPRICED in cartReducer).
 * The shop only serves active products (server/api/product), so "did not come back" means
 * hidden or deleted, which is the same thing for a customer.
 *
 * A network failure blocks nothing: the state stays as it was, and the order is stopped by the
 * server if it really holds a product that is not sold or a price that changed.
 */
import { getProducts } from '../../services/productService';
import { repriceCart } from '../cart/cartActions';
import { toAgorot } from '../../utils/pricing';
import { variantKey, optionKey } from './availabilitySelectors';

export const AVAILABILITY_LOADED = 'AVAILABILITY_LOADED';
export const AVAILABILITY_CLEARED = 'AVAILABILITY_CLEARED';

/**
 * Stores the blocked products (ids), the blocked single variants ("<id>:<label>") and the blocked
 * colour/size choices (see optionKey).
 */
export function availabilityLoaded(unavailableIds, unavailableVariants = [], unavailableOptions = []) {
  return { type: AVAILABILITY_LOADED, unavailableIds, unavailableVariants, unavailableOptions };
}

/** Whether the line's colour and size (when it has them) are options the product defines. */
function optionsStillOffered(product, line) {
  if (line.selectedColor) {
    const names = (Array.isArray(product.colors) ? product.colors : [])
      .map((color) => (typeof color === 'string' ? color : color?.name));
    if (!names.includes(line.selectedColor)) return false;
  }
  if (line.selectedSize) {
    if (!(Array.isArray(product.sizes) ? product.sizes : []).includes(line.selectedSize)) return false;
  }
  return true;
}

/** Forgets everything that was blocked (the cart has nothing to check). */
export function availabilityCleared() {
  return { type: AVAILABILITY_CLEARED };
}

/** A positive price, or null (0 is "no price"). */
function positivePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * What the catalog says about the cart lines: the blocked products, the blocked variants and the
 * prices that differ. `products` is what the server returned for the cart's ids.
 */
export function compareCartWithCatalog(lines, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const ids = new Set();
  const variants = new Set();
  const options = new Set();
  const prices = [];

  for (const line of lines) {
    const product = byId.get(line.id);
    if (!product || product.in_stock === false) {
      ids.add(line.id);
      continue;
    }

    if (!optionsStillOffered(product, line)) {
      options.add(optionKey(line));
      continue;
    }

    let price;
    if (line.selectedVariant) {
      const variant = (Array.isArray(product.variants) ? product.variants : [])
        .find((v) => String(v?.label) === line.selectedVariant);
      price = variant ? positivePrice(variant.price) : null;
      if (price === null) {
        variants.add(variantKey(line.id, line.selectedVariant));
        continue;
      }
    } else {
      price = positivePrice(product.price);
      if (price === null) {
        ids.add(line.id);
        continue;
      }
    }

    if (toAgorot(price) !== toAgorot(line.price)) {
      prices.push({ id: line.id, selectedVariant: line.selectedVariant || null, price });
    }
  }

  return {
    ids: [...ids].sort((a, b) => a - b), variants: [...variants].sort(), options: [...options].sort(), prices,
  };
}

/**
 * Thunk: checks the ids in `key` (a comma-separated, sorted string from selectAvailabilityKey).
 * An empty key clears the result and asks nothing. Returns the function that aborts the request,
 * to be used as the cleanup of the effect that dispatched it.
 */
export function checkAvailability(key) {
  return (dispatch, getState) => {
    if (!key) {
      dispatch(availabilityCleared());
      return undefined;
    }
    const controller = new AbortController();
    getProducts({ ids: key, signal: controller.signal })
      .then(({ products }) => {
        if (controller.signal.aborted) return;
        // The lines as they are now, not as they were when the request left.
        const { ids, variants, options, prices } = compareCartWithCatalog(getState().cart.items, products);
        // An id that was asked about and did not come back is gone from the catalog, with or
        // without a cart line still holding it.
        const answered = new Set(products.map((product) => product.id));
        const missing = key.split(',').map(Number).filter((id) => !answered.has(id));
        const unavailable = [...new Set([...ids, ...missing])].sort((x, y) => x - y);
        dispatch(availabilityLoaded(unavailable, variants, options));
        if (prices.length > 0) dispatch(repriceCart(prices));
      })
      .catch(() => { /* ניתוק — לא חוסמים את הלקוח */ });
    return () => controller.abort();
  };
}
