/**
 * Pins the delivery fee as the cart exposes it: 20 for a delivery, nothing for a pickup or when
 * no method is chosen yet, and the total adds it to the subtotal. Added with the move of the
 * constant to utils/delivery.js (P3); it checks the behavior through the cart, not the constant.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, act } from '@testing-library/react';
import { useCart } from './useCart';

beforeEach(() => {
  localStorage.clear();
});

function setup() {
  const { result } = renderHook(() => useCart());
  act(() => { result.current.addToCart({ id: 1, name: 'צבע', price: 12.9 }, 3); });
  return result;
}

test('with no delivery method the fee is zero and the total is the subtotal', () => {
  const result = setup();

  expect(result.current.deliveryFee).toBe(0);
  expect(result.current.subtotal).toBe(38.7);
  expect(result.current.total).toBe(38.7);
});

test('a delivery adds a fee of 20 to the total', () => {
  const result = setup();

  act(() => { result.current.setDeliveryMethod('delivery'); });

  expect(result.current.deliveryFee).toBe(20);
  expect(result.current.total).toBe(58.7);
});

test('a pickup has no fee', () => {
  const result = setup();

  act(() => { result.current.setDeliveryMethod('pickup'); });

  expect(result.current.deliveryFee).toBe(0);
  expect(result.current.total).toBe(38.7);
});
