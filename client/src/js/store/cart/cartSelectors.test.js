/**
 * Tests for the cart selectors: the count, the sums in agorot, the delivery fee and the total.
 *
 * Run with `npm run test:client` from the root.
 */
import {
  selectCartItems, selectDeliveryMethod, selectCartCount, selectSubtotal, selectDeliveryFee, selectTotal,
} from './cartSelectors';

const stateOf = (items, deliveryMethod = null) => ({ cart: { items, deliveryMethod } });

test('selectCartItems and selectDeliveryMethod return what the state holds, by reference', () => {
  const state = stateOf([{ id: 1, price: 1 }], 'pickup');

  expect(selectCartItems(state)).toBe(state.cart.items);
  expect(selectDeliveryMethod(state)).toBe('pickup');
});

test('the count adds the quantities, and a line without a quantity counts as 1', () => {
  expect(selectCartCount(stateOf([{ id: 1, price: 1, quantity: 3 }, { id: 2, price: 1 }]))).toBe(4);
  expect(selectCartCount(stateOf([]))).toBe(0);
});

test('the subtotal sums the lines in agorot: 3 x 12.90 is 38.70, 0.1 + 0.2 is 0.3', () => {
  expect(selectSubtotal(stateOf([{ id: 1, price: 12.9, quantity: 3 }]))).toBe(38.7);
  expect(selectSubtotal(stateOf([{ id: 1, price: 0.1 }, { id: 2, price: 0.2 }]))).toBe(0.3);
  expect(selectSubtotal(stateOf([]))).toBe(0);
});

test.each([
  ['delivery', 20],
  ['pickup', 0],
  [null, 0],
])('the delivery fee for %s is %s', (method, fee) => {
  expect(selectDeliveryFee(stateOf([], method))).toBe(fee);
});

test('the total is the subtotal plus the fee, in agorot', () => {
  const items = [{ id: 1, price: 12.9, quantity: 3 }];

  expect(selectTotal(stateOf(items, 'delivery'))).toBe(58.7);
  expect(selectTotal(stateOf(items, 'pickup'))).toBe(38.7);
  expect(selectTotal(stateOf(items))).toBe(38.7);
});
