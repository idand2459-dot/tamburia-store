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

/** How many units are in the cart; a line without a quantity counts as one. */
export const selectCartCount = (state) => state.cart.items.reduce((sum, i) => sum + (i.quantity || 1), 0);

// באגורות: 3 × 12.90 הוא 38.70 ולא 38.699999999999996
export const selectSubtotal = (state) => sumPrices(
  state.cart.items.map((i) => lineTotal(i.price, i.quantity || 1))
);

export const selectDeliveryFee = (state) => (state.cart.deliveryMethod === 'delivery' ? DELIVERY_FEE : 0);

export const selectTotal = (state) => sumPrices([selectSubtotal(state), selectDeliveryFee(state)]);
