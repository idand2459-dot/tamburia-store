/**
 * Table tests for the cart reducer: every action, the merge rules copied from the old useCart
 * hook (BF-01 kept: the variant is not part of a line), and the "same state when nothing changes"
 * rule.
 *
 * Run with `npm run test:client` from the root.
 */
import { cartReducer, initialCartState } from './cartReducer';
import {
  addItem, addBundle, removeItem, changeQuantity, clearCart, repriceCart, setDeliveryMethod,
} from './cartActions';

const PAINT = { id: 1, name: 'צבע לבן', price: 100 };
const BRUSH = { id: 2, name: 'מברשת', price: 30 };
const stateOf = (items, deliveryMethod = null) => ({ items, deliveryMethod });

describe('the initial state', () => {
  test('is an empty cart with no delivery method', () => {
    expect(cartReducer(undefined, { type: '@@INIT' })).toEqual({ items: [], deliveryMethod: null });
    expect(cartReducer(undefined, { type: '@@INIT' })).toBe(initialCartState);
  });

  test('an unknown action returns the same state', () => {
    const state = stateOf([PAINT]);

    expect(cartReducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });
});

describe('addItem', () => {
  test('appends a new line with quantity 1 by default', () => {
    expect(cartReducer(initialCartState, addItem(PAINT)).items).toEqual([{ ...PAINT, quantity: 1 }]);
  });

  test('appends a new line with the given quantity', () => {
    expect(cartReducer(initialCartState, addItem(PAINT, 3)).items).toEqual([{ ...PAINT, quantity: 3 }]);
  });

  test('raises the quantity of the same product, color and size', () => {
    const state = stateOf([{ ...PAINT, quantity: 2, selectedColor: 'לבן', selectedSize: "5 ל'" }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedColor: 'לבן', selectedSize: "5 ל'" }, 2));

    expect(next.items).toEqual([{ ...PAINT, quantity: 4, selectedColor: 'לבן', selectedSize: "5 ל'" }]);
  });

  test('counts a stored line without a quantity as 1', () => {
    expect(cartReducer(stateOf([PAINT]), addItem(PAINT, 2)).items[0].quantity).toBe(3);
  });

  test.each([
    ['another color', { selectedColor: 'שחור' }],
    ['another size', { selectedSize: "18 ל'" }],
  ])('%s is a separate line', (_label, change) => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedColor: 'לבן', selectedSize: "5 ל'" }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedColor: 'לבן', selectedSize: "5 ל'", ...change }));

    expect(next.items).toHaveLength(2);
  });

  test('BF-01, kept as it is: another variant of the same product is the same line', () => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedVariant: "5 ל'", price: 100 }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedVariant: "18 ל'", price: 300 }));

    expect(next.items).toEqual([{ ...PAINT, quantity: 2, selectedVariant: "5 ל'", price: 100 }]);
  });

  test('does not change the previous state or the delivery method', () => {
    const state = stateOf([PAINT], 'pickup');
    const snapshot = JSON.parse(JSON.stringify(state));

    const next = cartReducer(state, addItem(BRUSH));

    expect(state).toEqual(snapshot);
    expect(next.deliveryMethod).toBe('pickup');
  });
});

describe('addBundle', () => {
  test('adds new lines with selectedColor null and the given quantity', () => {
    const next = cartReducer(initialCartState, addBundle([{ ...PAINT, quantity: 2 }, { ...BRUSH, quantity: 1 }]));

    expect(next.items).toEqual([
      { ...PAINT, quantity: 2, selectedColor: null },
      { ...BRUSH, quantity: 1, selectedColor: null },
    ]);
  });

  test('adds to the line with the same id, whatever its color or size', () => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedColor: 'לבן', selectedSize: "5 ל'" }]);

    const next = cartReducer(state, addBundle([{ ...PAINT, quantity: 2 }]));

    expect(next.items).toEqual([{ ...PAINT, quantity: 3, selectedColor: 'לבן', selectedSize: "5 ל'" }]);
  });

  test('every line with that id gets the quantity when the cart holds the same id twice', () => {
    const state = stateOf([
      { ...PAINT, quantity: 1, selectedColor: 'לבן' },
      { ...PAINT, quantity: 1, selectedColor: 'שחור' },
    ]);

    const next = cartReducer(state, addBundle([{ ...PAINT, quantity: 1 }]));

    expect(next.items.map((line) => line.quantity)).toEqual([2, 2]);
  });
});

describe('removeItem', () => {
  test('removes the line at the index and keeps the others in order', () => {
    const state = stateOf([PAINT, BRUSH, { id: 3, price: 1 }]);

    expect(cartReducer(state, removeItem(1)).items.map((line) => line.id)).toEqual([1, 3]);
  });

  test.each([[-1], [3], [7]])('an index that does not exist (%s) returns the same state', (index) => {
    const state = stateOf([PAINT, BRUSH, { id: 3, price: 1 }]);

    expect(cartReducer(state, removeItem(index))).toBe(state);
  });
});

describe('changeQuantity', () => {
  test('adds the delta, and counts a line without a quantity as 1', () => {
    const state = stateOf([{ ...PAINT, quantity: 2 }, BRUSH]);

    const next = cartReducer(cartReducer(state, changeQuantity(0, 1)), changeQuantity(1, 2));

    expect(next.items).toEqual([{ ...PAINT, quantity: 3 }, { ...BRUSH, quantity: 3 }]);
  });

  test.each([
    ['to zero', -2],
    ['below zero', -5],
  ])('removes the line when the quantity goes %s', (_label, delta) => {
    const state = stateOf([{ ...PAINT, quantity: 2 }, BRUSH]);

    expect(cartReducer(state, changeQuantity(0, delta)).items).toEqual([BRUSH]);
  });

  test('a line without a quantity goes at -1', () => {
    expect(cartReducer(stateOf([BRUSH]), changeQuantity(0, -1)).items).toEqual([]);
  });

  test('an index that does not exist returns the same state', () => {
    const state = stateOf([PAINT]);

    expect(cartReducer(state, changeQuantity(4, 1))).toBe(state);
  });
});

describe('clearCart', () => {
  test('empties the lines and forgets the delivery method', () => {
    expect(cartReducer(stateOf([PAINT], 'delivery'), clearCart())).toEqual({ items: [], deliveryMethod: null });
  });

  test('clears the delivery method of an empty cart too', () => {
    expect(cartReducer(stateOf([], 'pickup'), clearCart())).toEqual({ items: [], deliveryMethod: null });
  });

  test('returns the same state when there is nothing to clear', () => {
    const state = stateOf([]);

    expect(cartReducer(state, clearCart())).toBe(state);
  });
});

describe('repriceCart', () => {
  const state = stateOf([
    { id: 1, price: 100, quantity: 2, selectedVariant: "5 ל'" },
    { id: 1, price: 300, quantity: 1, selectedVariant: "18 ל'" },
    { id: 2, price: 30 },
    { id: 3, price: 5 },
  ]);

  test('sets the price of each line from the price with the same id and variant', () => {
    const next = cartReducer(state, repriceCart([
      { id: 1, selectedVariant: "5 ל'", price: 110 },
      { id: 1, selectedVariant: "18 ל'", price: 320 },
      { id: 2, selectedVariant: null, price: 35 },
      { id: 99, price: 1 },
    ]));

    expect(next.items.map((line) => line.price)).toEqual([110, 320, 35, 5]);
    expect(next.items.map((line) => line.quantity)).toEqual([2, 1, undefined, undefined]);
  });

  test('a price for another variant does not apply, and a missing variant matches only a line with none', () => {
    const next = cartReducer(state, repriceCart([
      { id: 1, selectedVariant: "18 ל'", price: 320 },
      { id: 2, selectedVariant: 'x', price: 1 },
      { id: 3, price: 6 },
    ]));

    expect(next.items.map((line) => line.price)).toEqual([100, 320, 30, 6]);
  });

  test('keeps the delivery method and the order of the lines', () => {
    const next = cartReducer({ ...state, deliveryMethod: 'delivery' }, repriceCart([]));

    expect(next.deliveryMethod).toBe('delivery');
    expect(next.items.map((line) => line.id)).toEqual([1, 1, 2, 3]);
  });
});

describe('setDeliveryMethod', () => {
  test.each([['pickup'], ['delivery'], [null]])('sets %s', (method) => {
    const state = stateOf([PAINT], method === null ? 'pickup' : null);

    expect(cartReducer(state, setDeliveryMethod(method)).deliveryMethod).toBe(method);
  });

  test('the same method returns the same state', () => {
    const state = stateOf([PAINT], 'pickup');

    expect(cartReducer(state, setDeliveryMethod('pickup'))).toBe(state);
  });
});
