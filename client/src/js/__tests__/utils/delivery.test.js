/**
 * Unit tests for utils/delivery.js: the fee and the delivery-area check, called directly.
 * The fee through the cart is pinned in hooks/useCart.delivery.test.js.
 *
 * Run with `npm run test:client` from the root.
 */
import { DELIVERY_FEE, ALLOWED_CITIES, checkAllowedCity } from '../../utils/delivery';

test('the delivery fee is 20', () => {
  expect(DELIVERY_FEE).toBe(20);
});

test.each([
  ['פתח תקווה'],
  ['פתח-תקווה'],
  ['גני תקווה'],
  ['גני-תקווה'],
  ['קריית אונו'],
  ['קרית אונו'],
  ['קריית-אונו'],
  ['קרית-אונו'],
])('%s is inside the area, alone or inside a longer address', (city) => {
  expect(ALLOWED_CITIES).toContain(city);
  expect(checkAllowedCity(city)).toBe(true);
  expect(checkAllowedCity(`הרצל 1, ${city}, ישראל`)).toBe(true);
});

test.each([
  ['תל אביב'],
  ['הרצל 1, חיפה'],
  ['פתח'],
  ['תקווה'],
])('%s is outside the area', (address) => {
  expect(checkAllowedCity(address)).toBe(false);
});

test('an empty or missing address is not rejected (the form asks for it separately)', () => {
  expect(checkAllowedCity('')).toBe(true);
  expect(checkAllowedCity(undefined)).toBe(true);
  expect(checkAllowedCity(null)).toBe(true);
});

test('the match is case-insensitive and ignores nothing else: spacing must match', () => {
  expect(checkAllowedCity('Rehovot, פתח תקווה')).toBe(true);
  expect(checkAllowedCity('פתח  תקווה')).toBe(false);
});
