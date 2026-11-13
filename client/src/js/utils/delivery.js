/**
 * Delivery rules of the storefront: the delivery fee and the delivery area.
 *
 * One client-side source for what used to sit in hooks/useCart.js (DELIVERY_FEE, now read by
 * store/cart/cartSelectors.js) and
 * features/cart/CheckoutFormView.js (ALLOWED_CITIES, checkAllowedCity), moved unchanged (P3).
 * The server still decides: it rejects an order whose fee or prices differ from its own.
 */

/** דמי המשלוח בשקלים. */
export const DELIVERY_FEE = 20;

export const ALLOWED_CITIES = ['פתח תקווה', 'פתח-תקווה', 'גני תקווה', 'גני-תקווה', 'קריית אונו', 'קרית אונו', 'קריית-אונו', 'קרית-אונו'];

/** בודק אם הכתובת נמצאת באזור החלוקה. */
export function checkAllowedCity(address) {
  if (!address) return true;
  const lower = address.toLowerCase();
  return ALLOWED_CITIES.some(city => lower.includes(city.toLowerCase()));
}
