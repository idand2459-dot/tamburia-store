/**
 * Cart actions: the action types and the plain action creators.
 *
 * Each creator returns a plain object; the cart reducer decides what it does to the state. The
 * rules (what counts as the same line, how a bundle merges) live in cartReducer.js.
 */

export const CART_ITEM_ADDED = 'CART_ITEM_ADDED';
export const CART_BUNDLE_ADDED = 'CART_BUNDLE_ADDED';
export const CART_ITEM_REMOVED = 'CART_ITEM_REMOVED';
export const CART_QUANTITY_CHANGED = 'CART_QUANTITY_CHANGED';
export const CART_CLEARED = 'CART_CLEARED';
export const CART_REPRICED = 'CART_REPRICED';
export const DELIVERY_METHOD_SET = 'DELIVERY_METHOD_SET';
export const PRICE_CHANGES_ACKNOWLEDGED = 'PRICE_CHANGES_ACKNOWLEDGED';

/** Adds a product to the cart, or raises the quantity of the same line. */
export function addItem(product, quantity = 1) {
  return { type: CART_ITEM_ADDED, product, quantity };
}

/** Adds everything the paint calculator worked out, in one action. */
export function addBundle(items) {
  return { type: CART_BUNDLE_ADDED, items };
}

/** Removes the cart line at this index. */
export function removeItem(index) {
  return { type: CART_ITEM_REMOVED, index };
}

/** Changes the quantity of the cart line at this index; the line goes when it reaches zero. */
export function changeQuantity(index, delta) {
  return { type: CART_QUANTITY_CHANGED, index, delta };
}

/** Empties the cart and forgets the delivery method (an empty cart has no delivery choice). */
export function clearCart() {
  return { type: CART_CLEARED };
}

/**
 * Applies the current prices to the cart lines: the ones the server sent back with a 409 on
 * placing an order, or the ones the catalog has now (the freshness check). Every line whose price
 * really changes is also recorded as a price change the customer has to acknowledge.
 * Each price is { id, selectedVariant, price }.
 */
export function repriceCart(prices) {
  return { type: CART_REPRICED, prices };
}

/** The customer confirmed the price changes that are shown; clears exactly those. */
export function acknowledgePriceChanges() {
  return { type: PRICE_CHANGES_ACKNOWLEDGED };
}

/** Sets how the customer receives the order: 'pickup', 'delivery', or null for no choice yet. */
export function setDeliveryMethod(method) {
  return { type: DELIVERY_METHOD_SET, method };
}
