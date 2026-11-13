/**
 * Tests for createAppStore and the cart persistence: the state is read from localStorage when the
 * store is built, the cart is written on startup (an unreadable stored value is overwritten with
 * an empty cart) and after every change of its lines, and nothing else is ever stored. These are
 * the same cases the old useCart hook was pinned with (hooks/useCart.persistence.test.js).
 *
 * Run with `npm run test:client` from the root.
 */
import { createAppStore } from '../../store/index';
import { selectPendingPriceChanges } from '../../store/cart/cartSelectors';
import {
  addItem, removeItem, setDeliveryMethod, clearCart, repriceCart, acknowledgePriceChanges,
} from '../../store/cart/cartActions';
import { toggleWishlist } from '../../store/wishlist/wishlistActions';
import { availabilityLoaded } from '../../store/availability/availabilityActions';
import {
  CART_STORAGE_KEY as CART_KEY, WISHLIST_STORAGE_KEY as WISHLIST_KEY, PRICE_CHANGES_STORAGE_KEY as CHANGES_KEY,
} from '../../store/persistence';

const PAINT = { id: 1, name: 'צבע לבן', price: 100 };

const storedCart = () => JSON.parse(localStorage.getItem(CART_KEY));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the initial state', () => {
  test('is built from what localStorage holds', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ ...PAINT, quantity: 3, selectedColor: 'לבן' }]));
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([{ id: 5 }, { id: 3 }]));

    const store = createAppStore();

    expect(store.getState()).toEqual({
      cart: { items: [{ ...PAINT, quantity: 3, selectedColor: 'לבן' }], deliveryMethod: null, priceChanges: [] },
      wishlist: { items: [{ id: 5 }, { id: 3 }] },
      availability: { unavailableIds: [], unavailableVariants: [] },
    });
  });

  test.each([
    ['nothing stored', null],
    ['malformed JSON', '{not json'],
    ['a stored null', 'null'],
  ])('is empty for %s', (_label, value) => {
    if (value !== null) {
      localStorage.setItem(CART_KEY, value);
      localStorage.setItem(WISHLIST_KEY, value);
    }

    expect(createAppStore().getState()).toEqual({
      cart: { items: [], deliveryMethod: null, priceChanges: [] },
      wishlist: { items: [] },
      availability: { unavailableIds: [], unavailableVariants: [] },
    });
  });

  test.each([
    ['an object instead of a list', '{"id":1,"name":"x","price":1}'],
    ['a string', '"abc"'],
    ['a number', '7'],
  ])('the cart is empty for %s', (_label, value) => {
    localStorage.setItem(CART_KEY, value);

    expect(createAppStore().getState().cart.items).toEqual([]);
  });

  test('drops the cart entries that cannot be lines and keeps the valid ones, in order', () => {
    const good = [{ ...PAINT, quantity: 2 }, { id: 2, name: 'מברשת', price: '30.50' }, { id: 4, name: 'ללא כמות', price: 0 }];
    localStorage.setItem(CART_KEY, JSON.stringify([
      good[0], null, 'x', 7, [], { name: 'no id', price: 1 }, { id: 0, name: 'x', price: 1 }, { id: -3, name: 'x', price: 1 },
      { id: 1.5, name: 'x', price: 1 }, { id: '5', name: 'x', price: 1 }, good[1], { id: 6, price: 1 },
      { id: 7, name: 'x' }, { id: 8, name: 'x', price: 'abc' }, { id: 9, name: 'x', price: -1 }, { id: 10, name: 'x', price: null },
      { id: 11, name: 'x', price: 1, quantity: 0 }, { id: 12, name: 'x', price: 1, quantity: -2 },
      { id: 13, name: 'x', price: 1, quantity: 1.5 }, { id: 14, name: 'x', price: 1, quantity: '2' }, good[2],
    ]));

    expect(createAppStore().getState().cart.items).toEqual(good);
  });

  test('keeps the other fields of a valid line exactly as saved (variant, colour, size, image)', () => {
    const line = {
      ...PAINT, quantity: 2, selectedVariant: "5 ל'", selectedColor: 'לבן', selectedSize: null, image_url: '/p.webp', extra: { a: 1 },
    };
    localStorage.setItem(CART_KEY, JSON.stringify([line]));

    expect(createAppStore().getState().cart.items).toEqual([line]);
  });

  test('the price changes that were waiting for acknowledgment are restored, and bad entries dropped', () => {
    const change = { id: 1, selectedVariant: null, name: 'צבע', from: 100, to: 110 };
    localStorage.setItem(CHANGES_KEY, JSON.stringify([change, null, { id: 'x', from: 1, to: 2 }, { id: 2, from: 'a', to: 2 }]));

    expect(createAppStore().getState().cart.priceChanges).toEqual([change]);
  });

  test('a valid record is kept as saved, with a string variant or a null one', () => {
    const records = [
      { id: 1, selectedVariant: "5 ל'", name: 'צבע', from: 100, to: 110 },
      { id: 2, selectedVariant: null, name: 'מברשת', from: '30.50', to: 35 },
    ];
    localStorage.setItem(CHANGES_KEY, JSON.stringify(records));

    expect(createAppStore().getState().cart.priceChanges).toEqual(records);
  });

  test.each([
    ['a name that is an object', { name: { a: 1 } }],
    ['a name that is a number', { name: 5 }],
    ['a name that is missing', { name: undefined }],
    ['a variant that is an object', { selectedVariant: { label: 'x' } }],
    ['a variant that is a number', { selectedVariant: 5 }],
    ['a variant that is missing', { selectedVariant: undefined }],
    ['an id that is a string', { id: '1' }],
    ['an id that is not whole', { id: 1.5 }],
    ['a from that is not a price', { from: 'abc' }],
    ['a from that is negative', { from: -1 }],
    ['a to that is null', { to: null }],
    ['a to that is an object', { to: {} }],
  ])('a record with %s is dropped, and a valid one next to it is kept', (_label, broken) => {
    const valid = { id: 2, selectedVariant: null, name: 'מברשת', from: 30, to: 35 };
    const record = { id: 1, selectedVariant: null, name: 'צבע', from: 100, to: 110, ...broken };
    localStorage.setItem(CHANGES_KEY, JSON.stringify([record, valid]));

    expect(createAppStore().getState().cart.priceChanges).toEqual([valid]);
  });

  test('a tampered record cannot reach the screen: the cart renders with no notice and no crash', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ ...PAINT, quantity: 1 }]));
    localStorage.setItem(CHANGES_KEY, JSON.stringify([{ id: 1, selectedVariant: null, name: { a: 1 }, from: 1, to: 2 }]));

    const state = createAppStore().getState();

    expect(state.cart.items).toHaveLength(1);
    expect(selectPendingPriceChanges(state)).toEqual([]);
  });

  test.each([['nothing stored', null], ['malformed JSON', '{not json'], ['not a list', '{"id":1}']])(
    'there are no pending price changes for %s',
    (_label, value) => {
      if (value !== null) localStorage.setItem(CHANGES_KEY, value);

      expect(createAppStore().getState().cart.priceChanges).toEqual([]);
    },
  );

  test('is empty when reading localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

    expect(createAppStore().getState().cart.items).toEqual([]);
  });

  test('the delivery method always starts unset, whatever else is in localStorage', () => {
    localStorage.setItem('tamburia-delivery', 'delivery');

    expect(createAppStore().getState().cart.deliveryMethod).toBeNull();
  });

  test('a given state is used instead of localStorage', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([PAINT]));
    const given = {
      cart: { items: [], deliveryMethod: 'pickup', priceChanges: [] },
      wishlist: { items: [{ id: 7 }] },
      availability: { unavailableIds: [2], unavailableVariants: [] },
    };

    expect(createAppStore(given).getState()).toEqual(given);
  });
});

describe('writing the cart', () => {
  // P7.3: building the store reads and validates, and never writes. The old tests here pinned the
  // opposite (the old useCart effect wrote on startup, which also erased an unreadable value).
  test('writes nothing when the store is built: an empty localStorage stays empty', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    createAppStore();

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(CART_KEY)).toBeNull();
    expect(localStorage.getItem(CHANGES_KEY)).toBeNull();
  });

  test('an unreadable stored cart is left as it is on startup (the cart starts empty)', () => {
    localStorage.setItem(CART_KEY, '{not json');

    const store = createAppStore();

    expect(store.getState().cart.items).toEqual([]);
    expect(localStorage.getItem(CART_KEY)).toBe('{not json');
  });

  test('stored lines are left byte for byte as saved on startup, invalid entries included', () => {
    const raw = JSON.stringify([{ ...PAINT, quantity: 2 }, null, { id: 'bad' }]);
    localStorage.setItem(CART_KEY, raw);

    const store = createAppStore();

    expect(store.getState().cart.items).toEqual([{ ...PAINT, quantity: 2 }]);
    expect(localStorage.getItem(CART_KEY)).toBe(raw);
  });

  test('the first change writes the validated cart, replacing what was unreadable or invalid', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ ...PAINT, quantity: 2 }, null, { id: 'bad' }]));
    const store = createAppStore();

    store.dispatch(addItem({ id: 9, name: 'חדש', price: 5 }));

    expect(storedCart()).toEqual([{ ...PAINT, quantity: 2 }, { id: 9, name: 'חדש', price: 5, quantity: 1 }]);
  });

  test('a first change over an unreadable value replaces it', () => {
    localStorage.setItem(CART_KEY, '{not json');
    const store = createAppStore();

    store.dispatch(addItem(PAINT));

    expect(storedCart()).toEqual([{ ...PAINT, quantity: 1 }]);
  });

  test('a blocked localStorage never throws: the cart keeps working for this visit', () => {
    const store = createAppStore();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });

    expect(() => store.dispatch(addItem(PAINT))).not.toThrow();
    expect(() => store.dispatch(repriceCart([{ id: 1, price: 120 }]))).not.toThrow();

    expect(store.getState().cart.items[0].price).toBe(120);
  });

  test('pending price changes are written when they change, and survive a reload', () => {
    const store = createAppStore();
    store.dispatch(addItem(PAINT));

    store.dispatch(repriceCart([{ id: 1, price: 120 }]));
    const stored = JSON.parse(localStorage.getItem(CHANGES_KEY));
    expect(stored).toEqual([{ id: 1, selectedVariant: null, name: 'צבע לבן', from: 100, to: 120 }]);

    const reloaded = createAppStore();
    expect(reloaded.getState().cart.items[0].price).toBe(120);
    expect(reloaded.getState().cart.priceChanges).toEqual(stored);

    reloaded.dispatch(acknowledgePriceChanges());
    expect(JSON.parse(localStorage.getItem(CHANGES_KEY))).toEqual([]);
    expect(createAppStore().getState().cart.priceChanges).toEqual([]);
  });

  test('writes after every change of the lines', () => {
    const store = createAppStore();

    store.dispatch(addItem(PAINT));
    expect(storedCart()).toEqual([{ ...PAINT, quantity: 1 }]);

    store.dispatch(removeItem(0));
    expect(storedCart()).toEqual([]);
  });

  test('never stores the delivery method, and a clear writes an empty cart', () => {
    const store = createAppStore();
    store.dispatch(addItem(PAINT));

    store.dispatch(setDeliveryMethod('delivery'));
    expect(storedCart()).toEqual([{ ...PAINT, quantity: 1 }]);
    expect(localStorage.getItem('tamburia-delivery')).toBeNull();

    store.dispatch(clearCart());
    expect(storedCart()).toEqual([]);
  });

  test('does not write when only another part of the state changes', () => {
    const store = createAppStore();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    store.dispatch(setDeliveryMethod('pickup'));
    store.dispatch(availabilityLoaded([1]));
    store.dispatch(toggleWishlist({ id: 3, name: 'x', price: 1 }));

    const cartWrites = setItem.mock.calls.filter(([key]) => key === CART_KEY);
    expect(cartWrites).toEqual([]);
  });
});
