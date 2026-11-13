/**
 * Tests for createAppStore and the cart persistence: the state is read from localStorage when the
 * store is built, the cart is written on startup (an unreadable stored value is overwritten with
 * an empty cart) and after every change of its lines, and nothing else is ever stored. These are
 * the same cases the old useCart hook was pinned with (hooks/useCart.persistence.test.js).
 *
 * Run with `npm run test:client` from the root.
 */
import { createAppStore } from './index';
import { addItem, removeItem, setDeliveryMethod, clearCart } from './cart/cartActions';
import { toggleWishlist } from './wishlist/wishlistActions';
import { availabilityLoaded } from './availability/availabilityActions';
import { CART_STORAGE_KEY as CART_KEY, WISHLIST_STORAGE_KEY as WISHLIST_KEY } from './persistence';

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
      cart: { items: [{ ...PAINT, quantity: 3, selectedColor: 'לבן' }], deliveryMethod: null },
      wishlist: { ids: [5, 3] },
      availability: { unavailableIds: [] },
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
      cart: { items: [], deliveryMethod: null },
      wishlist: { ids: [] },
      availability: { unavailableIds: [] },
    });
  });

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
    const given = { cart: { items: [], deliveryMethod: 'pickup' }, wishlist: { ids: [7] }, availability: { unavailableIds: [2] } };

    expect(createAppStore(given).getState()).toEqual(given);
  });
});

describe('writing the cart', () => {
  test('writes the cart once when the store is built: nothing stored becomes []', () => {
    createAppStore();

    expect(localStorage.getItem(CART_KEY)).toBe('[]');
  });

  test('overwrites an unreadable stored value with [] on startup', () => {
    localStorage.setItem(CART_KEY, '{not json');

    createAppStore();

    expect(localStorage.getItem(CART_KEY)).toBe('[]');
  });

  test('writes the stored lines back unchanged on startup', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ ...PAINT, quantity: 2 }]));

    createAppStore();

    expect(storedCart()).toEqual([{ ...PAINT, quantity: 2 }]);
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
