/**
 * Cart selectors: the lines, the delivery method, and the values derived from them.
 *
 * The counts and sums are not stored in the state; they are computed from the lines on every
 * read, with the same arithmetic as before (money is summed in agorot by utils/pricing.js, the
 * fee comes from utils/delivery.js).
 */
import { sumPrices, lineTotal } from '../../utils/pricing';
import { DELIVERY_FEE } from '../../utils/delivery';

export const selectCartItems = (state) => state.cart.items;

export const selectDeliveryMethod = (state) => state.cart.deliveryMethod;

// The same inputs always give the same array, so a component that selects it is not rendered again.
const NO_CHANGES = [];
let lastItems = null;
let lastChanges = null;
let lastPending = NO_CHANGES;

/**
 * The price changes awaiting the customer's acknowledgment, for lines that are still in the cart.
 * While this is not empty the customer cannot continue to the details or send the order.
 */
export const selectPendingPriceChanges = (state) => {
  const { items, priceChanges } = state.cart;
  if (items !== lastItems || priceChanges !== lastChanges) {
    lastItems = items;
    lastChanges = priceChanges;
    const pending = (priceChanges || []).filter((change) => items.some(
      (item) => item.id === change.id && (item.selectedVariant || null) === (change.selectedVariant || null),
    ));
    lastPending = pending.length > 0 ? pending : NO_CHANGES;
  }
  return lastPending;
};

/** How many units are in the cart; a line without a quantity counts as one. */
export const selectCartCount = (state) => state.cart.items.reduce((sum, i) => sum + (i.quantity || 1), 0);

// באגורות: 3 × 12.90 הוא 38.70 ולא 38.699999999999996
export const selectSubtotal = (state) => sumPrices(
  state.cart.items.map((i) => lineTotal(i.price, i.quantity || 1))
);

export const selectDeliveryFee = (state) => (state.cart.deliveryMethod === 'delivery' ? DELIVERY_FEE : 0);

export const selectTotal = (state) => sumPrices([selectSubtotal(state), selectDeliveryFee(state)]);
