/**
 * Table tests for the cart reducer: every action, the merge rules copied from the old useCart
 * hook (BF-01 kept: the variant is not part of a line), and the "same state when nothing changes"
 * rule.
 *
 * Run with `npm run test:client` from the root.
 */
import { cartReducer, initialCartState } from '../../../store/cart/cartReducer';
import {
  addItem, addBundle, removeItem, changeQuantity, clearCart, repriceCart, setDeliveryMethod,
  acknowledgePriceChanges,
} from '../../../store/cart/cartActions';

const PAINT = { id: 1, name: 'צבע לבן', price: 100 };
const BRUSH = { id: 2, name: 'מברשת', price: 30 };
const stateOf = (items, deliveryMethod = null) => ({ items, deliveryMethod });

describe('the initial state', () => {
  test('is an empty cart with no delivery method', () => {
    expect(cartReducer(undefined, { type: '@@INIT' })).toEqual({ items: [], deliveryMethod: null, priceChanges: [] });
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

  test('BF-01 fixed (P7.3): another variant of the same product is another line, at its own price', () => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedVariant: "5 ל'", price: 100 }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedVariant: "18 ל'", price: 300 }, 2));

    expect(next.items).toEqual([
      { ...PAINT, quantity: 1, selectedVariant: "5 ל'", price: 100 },
      { ...PAINT, quantity: 2, selectedVariant: "18 ל'", price: 300 },
    ]);
  });

  test('the same variant is still the same line, and its quantity grows', () => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedVariant: "5 ל'" }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedVariant: "5 ל'" }, 2));

    expect(next.items).toEqual([{ ...PAINT, quantity: 3, selectedVariant: "5 ל'" }]);
  });

  test('a line saved before variants were recorded (none) is the same line as one with null', () => {
    const state = stateOf([{ ...PAINT, quantity: 1 }]);

    const next = cartReducer(state, addItem({ ...PAINT, selectedVariant: null }, 1));

    expect(next.items).toEqual([{ ...PAINT, quantity: 2 }]);
  });

  test('a line with a variant and a line without one are different lines', () => {
    const state = stateOf([{ ...PAINT, quantity: 1, selectedVariant: "5 ל'" }]);

    expect(cartReducer(state, addItem({ ...PAINT }, 1)).items).toHaveLength(2);
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
    expect(cartReducer(stateOf([PAINT], 'delivery'), clearCart())).toEqual({ items: [], deliveryMethod: null, priceChanges: [] });
  });

  test('clears the delivery method of an empty cart too', () => {
    expect(cartReducer(stateOf([], 'pickup'), clearCart())).toEqual({ items: [], deliveryMethod: null, priceChanges: [] });
  });

  test('forgets the price changes that were waiting for acknowledgment', () => {
    const state = { ...stateOf([PAINT]), priceChanges: [{ id: 1, selectedVariant: null, name: 'x', from: 1, to: 2 }] };

    expect(cartReducer(state, clearCart()).priceChanges).toEqual([]);
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
    const next = cartReducer({ ...state, deliveryMethod: 'delivery' }, repriceCart([{ id: 2, price: 31 }]));

    expect(next.deliveryMethod).toBe('delivery');
    expect(next.items.map((line) => line.id)).toEqual([1, 1, 2, 3]);
  });

  test('prices that change nothing return the same state, and record nothing', () => {
    const same = cartReducer(state, repriceCart([{ id: 2, selectedVariant: null, price: 30 }, { id: 1, selectedVariant: "5 ל'", price: 100.0 }]));

    expect(same).toBe(state);
    expect(cartReducer(state, repriceCart([]))).toBe(state);
  });

  test('records each real change for acknowledgment: old price, new price, name and variant', () => {
    const named = { ...stateOf([{ id: 1, name: 'צבע', price: 100, selectedVariant: "5 ל'" }, { id: 2, name: 'מברשת', price: 30 }]) };

    const next = cartReducer(named, repriceCart([{ id: 1, selectedVariant: "5 ל'", price: 110 }]));

    expect(next.priceChanges).toEqual([{ id: 1, selectedVariant: "5 ל'", name: 'צבע', from: 100, to: 110 }]);
    expect(next.items[1]).toBe(named.items[1]);
  });

  test('a second change before acknowledgment keeps the first old price and takes the newest', () => {
    const named = stateOf([{ id: 1, name: 'צבע', price: 100 }]);
    const once = cartReducer(named, repriceCart([{ id: 1, price: 110 }]));

    const twice = cartReducer(once, repriceCart([{ id: 1, price: 125 }]));

    expect(twice.priceChanges).toEqual([{ id: 1, selectedVariant: null, name: 'צבע', from: 100, to: 125 }]);
  });

  test('a price that goes back to the one the customer saw leaves nothing to acknowledge', () => {
    const named = stateOf([{ id: 1, name: 'צבע', price: 100 }]);
    const once = cartReducer(named, repriceCart([{ id: 1, price: 110 }]));

    const back = cartReducer(once, repriceCart([{ id: 1, price: 100 }]));

    expect(back.priceChanges).toEqual([]);
    expect(back.items[0].price).toBe(100);
  });

  test('two lines of one product and variant (different colour) make one entry', () => {
    const named = stateOf([
      { id: 1, name: 'צבע', price: 100, selectedColor: 'לבן' },
      { id: 1, name: 'צבע', price: 100, selectedColor: 'שחור' },
    ]);

    const next = cartReducer(named, repriceCart([{ id: 1, price: 90 }]));

    expect(next.items.map((line) => line.price)).toEqual([90, 90]);
    expect(next.priceChanges).toHaveLength(1);
  });
});

describe('pending price changes follow their lines', () => {
  const change = (id, selectedVariant, extra = {}) => ({ id, selectedVariant, name: `n${id}`, from: 100, to: 110, ...extra });
  const line = (id, selectedVariant, extra = {}) => ({ id, name: `n${id}`, price: 110, quantity: 1, ...(selectedVariant ? { selectedVariant } : {}), ...extra });
  const withChanges = (items, priceChanges) => ({ ...stateOf(items), priceChanges });

  test('removing the only line of a product and variant drops its change, and keeps the others', () => {
    const state = withChanges([line(1, "5 ל'"), line(1, "18 ל'"), line(2, null)], [change(1, "5 ל'"), change(1, "18 ל'"), change(2, null)]);

    const next = cartReducer(state, removeItem(0));

    expect(next.items.map((l) => l.id)).toEqual([1, 2]);
    expect(next.priceChanges).toEqual([change(1, "18 ל'"), change(2, null)]);
  });

  test('another variant of the same product keeps its change when this one is removed', () => {
    const state = withChanges([line(1, "5 ל'"), line(1, "18 ל'")], [change(1, "18 ל'")]);

    expect(cartReducer(state, removeItem(0)).priceChanges).toEqual([change(1, "18 ל'")]);
  });

  test('a change stays while another line (another colour) still has the same product and variant', () => {
    const state = withChanges(
      [line(1, null, { selectedColor: 'לבן' }), line(1, null, { selectedColor: 'שחור' })],
      [change(1, null)],
    );

    const next = cartReducer(state, removeItem(0));

    expect(next.items).toHaveLength(1);
    expect(next.priceChanges).toEqual([change(1, null)]);
  });

  test('reducing a quantity to zero removes the line and its change, the same way', () => {
    const state = withChanges([line(1, null), line(2, null)], [change(1, null), change(2, null)]);

    const next = cartReducer(state, changeQuantity(0, -1));

    expect(next.items.map((l) => l.id)).toEqual([2]);
    expect(next.priceChanges).toEqual([change(2, null)]);
  });

  test('a quantity that stays above zero touches no change, and returns the same array', () => {
    const state = withChanges([line(1, null, { quantity: 3 })], [change(1, null)]);

    const next = cartReducer(state, changeQuantity(0, -1));

    expect(next.items[0].quantity).toBe(2);
    expect(next.priceChanges).toBe(state.priceChanges);
  });

  test('removing a line that has no change returns the same array (nothing to write)', () => {
    const state = withChanges([line(1, null), line(2, null)], [change(1, null)]);

    expect(cartReducer(state, removeItem(1)).priceChanges).toBe(state.priceChanges);
  });

  test('the acknowledgment still applies to a line that stays: its change is not dropped by removing another line', () => {
    const state = withChanges([line(1, null), line(2, null)], [change(1, null), change(2, null)]);

    const next = cartReducer(state, removeItem(1));

    expect(next.priceChanges).toEqual([change(1, null)]);
    expect(cartReducer(next, acknowledgePriceChanges()).priceChanges).toEqual([]);
  });

  test('adding the product back later does not bring the old change back', () => {
    const state = withChanges([line(1, null)], [change(1, null)]);
    const removed = cartReducer(state, removeItem(0));

    const added = cartReducer(removed, addItem({ id: 1, name: 'n1', price: 110 }));

    expect(added.priceChanges).toEqual([]);
  });

  test('a state saved before priceChanges existed is not given an empty list by a removal', () => {
    const old = stateOf([line(1, null), line(2, null)]);

    expect(cartReducer(old, removeItem(0))).toEqual({ items: [line(2, null)], deliveryMethod: null });
  });
});

describe('acknowledgePriceChanges', () => {
  const pending = { ...stateOf([{ id: 1, name: 'צבע', price: 110 }]), priceChanges: [{ id: 1, selectedVariant: null, name: 'צבע', from: 100, to: 110 }] };

  test('clears the pending changes and nothing else', () => {
    const next = cartReducer(pending, acknowledgePriceChanges());

    expect(next.priceChanges).toEqual([]);
    expect(next.items).toBe(pending.items);
  });

  test('with nothing pending it returns the same state', () => {
    const none = stateOf([PAINT]);

    expect(cartReducer(none, acknowledgePriceChanges())).toBe(none);
  });

  test('a price that changes again after the acknowledgment is a new change to acknowledge', () => {
    const acknowledged = cartReducer(pending, acknowledgePriceChanges());

    const again = cartReducer(acknowledged, repriceCart([{ id: 1, price: 120 }]));

    expect(again.priceChanges).toEqual([{ id: 1, selectedVariant: null, name: 'צבע', from: 110, to: 120 }]);
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
