/**
 * Tests for the availability reducer, selectors and the checkAvailability thunk, with the same
 * cases the old useAvailability hook was pinned with (hooks/useAvailability.test.js): one request
 * for the sorted, de-duplicated ids (the first 100), the answer's missing ids are unavailable, a
 * failure keeps the state, and the returned function aborts the request.
 *
 * Run with `npm run test:client` from the root.
 */
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import { rootReducer } from '../../../store';
import { availabilityReducer, initialAvailabilityState } from '../../../store/availability/availabilityReducer';
import {
  availabilityLoaded, availabilityCleared, checkAvailability, compareCartWithCatalog,
} from '../../../store/availability/availabilityActions';
import {
  selectAvailabilityKey, selectUnavailableIds, selectUnavailableIdSet, selectUnavailableLines,
  isLineUnavailable, variantKey,
} from '../../../store/availability/availabilitySelectors';
import { selectPendingPriceChanges } from '../../../store/cart/cartSelectors';
import { removeItem } from '../../../store/cart/cartActions';

/** A fetch response. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let inCatalog;
let answer;

const askedUrls = () => global.fetch.mock.calls.map(([url]) => url);
const newStore = (items = []) => createStore(
  rootReducer,
  { cart: { items, deliveryMethod: null, priceChanges: [] }, wishlist: { items: [] }, availability: { unavailableIds: [], unavailableVariants: [] } },
  applyMiddleware(thunk)
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  inCatalog = [];
  // Every product in the catalog is in stock at a price of 10, unless a test says otherwise.
  answer = (url) => {
    const asked = decodeURIComponent(url.split('ids=')[1]).split(',').map(Number);
    const products = asked.filter((id) => inCatalog.includes(id)).map((id) => ({ id, price: 10, in_stock: true }));
    return reply(200, { products, pagination: { total: products.length } });
  };
  global.fetch = jest.fn((url) => answer(url));
});

afterEach(() => {
  delete global.fetch;
});

describe('availabilityReducer', () => {
  test('starts with no unavailable ids; an unknown action returns the same state', () => {
    expect(availabilityReducer(undefined, { type: '@@INIT' })).toBe(initialAvailabilityState);
    expect(initialAvailabilityState).toEqual({ unavailableIds: [], unavailableVariants: [] });
  });

  test('AVAILABILITY_LOADED stores the ids, and the same ids return the same state', () => {
    const state = availabilityReducer(initialAvailabilityState, availabilityLoaded([1, 5]));

    expect(state).toEqual({ unavailableIds: [1, 5], unavailableVariants: [] });
    expect(availabilityReducer(state, availabilityLoaded([1, 5]))).toBe(state);
  });

  test('AVAILABILITY_LOADED stores the blocked variants too, and the same ones return the same state', () => {
    const state = availabilityReducer(initialAvailabilityState, availabilityLoaded([], ['2:5 ל\'']));

    expect(state).toEqual({ unavailableIds: [], unavailableVariants: ['2:5 ל\''] });
    expect(availabilityReducer(state, availabilityLoaded([], ['2:5 ל\'']))).toBe(state);
    expect(availabilityReducer(state, availabilityLoaded([], []))).not.toBe(state);
  });

  test('AVAILABILITY_CLEARED empties the ids and the variants, and an already empty state is returned as is', () => {
    expect(availabilityReducer({ unavailableIds: [1], unavailableVariants: ['1:x'] }, availabilityCleared()))
      .toEqual({ unavailableIds: [], unavailableVariants: [] });
    expect(availabilityReducer(initialAvailabilityState, availabilityCleared())).toBe(initialAvailabilityState);
  });
});

describe('selectors', () => {
  const stateOf = (ids, unavailableIds = []) => ({
    cart: { items: ids.map((id) => ({ id })), deliveryMethod: null },
    availability: { unavailableIds, unavailableVariants: [] },
  });

  test('selectAvailabilityKey is the sorted, de-duplicated ids as one comma-separated string', () => {
    expect(selectAvailabilityKey(stateOf([5, 3, 3, 1]))).toBe('1,3,5');
  });

  test.each([
    ['an empty cart', []],
    ['only falsy ids', [0, null, undefined]],
  ])('selectAvailabilityKey is "" for %s', (_label, ids) => {
    expect(selectAvailabilityKey(stateOf(ids))).toBe('');
  });

  test('selectAvailabilityKey takes the first 100 ids of the cart as given, then sorts them', () => {
    const ids = Array.from({ length: 120 }, (_, i) => 120 - i);

    const key = selectAvailabilityKey(stateOf(ids)).split(',').map(Number);

    expect(key).toHaveLength(100);
    expect(key[0]).toBe(21);
    expect(key[99]).toBe(120);
  });

  test('the key is equal for the same ids in another order, so the effect does not run again', () => {
    expect(selectAvailabilityKey(stateOf([1, 2]))).toBe(selectAvailabilityKey(stateOf([2, 1])));
  });

  test('selectUnavailableIds returns the array of the state, by reference', () => {
    const state = stateOf([], [4, 6]);

    expect(selectUnavailableIds(state)).toBe(state.availability.unavailableIds);
  });

  test('selectUnavailableIdSet gives the same Set for the same array, a new one for a new array', () => {
    const state = stateOf([], [4, 6]);

    const first = selectUnavailableIdSet(state);
    expect(first).toBeInstanceOf(Set);
    expect([...first]).toEqual([4, 6]);
    expect(selectUnavailableIdSet(state)).toBe(first);
    expect(selectUnavailableIdSet(stateOf([], [4, 6]))).not.toBe(first);
  });

  test('selectUnavailableLines gives the same object for the same arrays, a new one for new arrays', () => {
    const state = stateOf([], [4, 6]);

    const first = selectUnavailableLines(state);
    expect([...first.ids]).toEqual([4, 6]);
    expect(first.variants.size).toBe(0);
    expect(selectUnavailableLines(state)).toBe(first);
    expect(selectUnavailableLines({ ...state, availability: { ...state.availability, unavailableVariants: ['4:x'] } })).not.toBe(first);
  });

  test('a state without unavailableVariants (an older shape) still works and keeps the same object', () => {
    const state = { cart: { items: [] }, availability: { unavailableIds: [9] } };

    expect(selectUnavailableLines(state)).toBe(selectUnavailableLines(state));
    expect(selectUnavailableLines(state).variants.size).toBe(0);
  });

  test('a blocked product blocks all of its lines; a blocked variant blocks only the line with that variant', () => {
    const lines = { ids: new Set([1]), variants: new Set([variantKey(2, "18 ל'")]) };

    expect(isLineUnavailable(lines, { id: 1, selectedVariant: "5 ל'" })).toBe(true);
    expect(isLineUnavailable(lines, { id: 1 })).toBe(true);
    expect(isLineUnavailable(lines, { id: 2, selectedVariant: "18 ל'" })).toBe(true);
    expect(isLineUnavailable(lines, { id: 2, selectedVariant: "5 ל'" })).toBe(false);
    expect(isLineUnavailable(lines, { id: 2 })).toBe(false);
    expect(isLineUnavailable(lines, { id: 3, selectedVariant: "18 ל'" })).toBe(false);
  });
});

describe('compareCartWithCatalog', () => {
  const line = (extra) => ({ id: 1, name: 'x', price: 10, quantity: 1, ...extra });
  const product = (extra) => ({ id: 1, price: 10, in_stock: true, ...extra });

  test('a product that matches in price and stock changes nothing', () => {
    expect(compareCartWithCatalog([line()], [product()])).toEqual({ ids: [], variants: [], prices: [] });
  });

  test('a product that did not come back, is out of stock, or has no price blocks the whole product', () => {
    expect(compareCartWithCatalog([line()], []).ids).toEqual([1]);
    expect(compareCartWithCatalog([line()], [product({ in_stock: false })]).ids).toEqual([1]);
    expect(compareCartWithCatalog([line()], [product({ price: 0 })]).ids).toEqual([1]);
    expect(compareCartWithCatalog([line()], [product({ price: null })]).ids).toEqual([1]);
  });

  test('an in_stock of null counts as in stock, as on the server', () => {
    expect(compareCartWithCatalog([line()], [product({ in_stock: null })]).ids).toEqual([]);
  });

  test('a different price is reported with the id and variant of the line', () => {
    expect(compareCartWithCatalog([line()], [product({ price: 12.5 })]).prices)
      .toEqual([{ id: 1, selectedVariant: null, price: 12.5 }]);
  });

  test('12.9 and 12.90 are the same price', () => {
    expect(compareCartWithCatalog([line({ price: 12.9 })], [product({ price: '12.90' })]).prices).toEqual([]);
  });

  const variants = [{ label: "5 ל'", price: 100 }, { label: "18 ל'", price: 300 }];

  test('a variant line takes the price of its variant', () => {
    const result = compareCartWithCatalog(
      [line({ price: 100, selectedVariant: "5 ל'" }), line({ price: 300, selectedVariant: "18 ל'" })],
      [product({ price: 100, variants: variants.map((v) => (v.label === "18 ל'" ? { ...v, price: 320 } : v)) })],
    );

    expect(result.prices).toEqual([{ id: 1, selectedVariant: "18 ל'", price: 320 }]);
    expect(result.variants).toEqual([]);
    expect(result.ids).toEqual([]);
  });

  test('a variant that no longer exists blocks only that line, not the product or its other variants', () => {
    const result = compareCartWithCatalog(
      [line({ price: 100, selectedVariant: "5 ל'" }), line({ price: 300, selectedVariant: "18 ל'" })],
      [product({ price: 100, variants: [variants[0]] })],
    );

    expect(result.variants).toEqual([variantKey(1, "18 ל'")]);
    expect(result.ids).toEqual([]);
    expect(result.prices).toEqual([]);
  });

  test('a variant without a price is blocked like a missing one', () => {
    const result = compareCartWithCatalog(
      [line({ price: 100, selectedVariant: "5 ל'" })],
      [product({ variants: [{ label: "5 ל'", price: 0 }] })],
    );

    expect(result.variants).toEqual([variantKey(1, "5 ל'")]);
  });

  test('the ids come back sorted, and one product is listed once for several lines', () => {
    const result = compareCartWithCatalog([line({ id: 7 }), line({ id: 3 }), line({ id: 7, selectedColor: 'x' })], []);

    expect(result.ids).toEqual([3, 7]);
  });
});

describe('checkAvailability', () => {
  test('asks once for the key and stores the ids missing from the answer', async () => {
    inCatalog = [3];
    const store = newStore();

    store.dispatch(checkAvailability('1,3,5'));
    await flush();

    expect(askedUrls()).toEqual(['/api/products?ids=1%2C3%2C5']);
    expect(global.fetch.mock.calls[0][1]).toEqual({ signal: expect.any(AbortSignal) });
    expect(store.getState().availability.unavailableIds).toEqual([1, 5]);
  });

  test('stores nothing when every id is in the catalog', async () => {
    inCatalog = [1, 2];
    const store = newStore();

    store.dispatch(checkAvailability('1,2'));
    await flush();

    expect(store.getState().availability.unavailableIds).toEqual([]);
  });

  test('an empty key asks nothing and clears the result', async () => {
    const store = createStore(
      rootReducer,
      { cart: { items: [], deliveryMethod: null }, wishlist: { items: [] }, availability: { unavailableIds: [1] } },
      applyMiddleware(thunk)
    );

    const abort = store.dispatch(checkAvailability(''));
    await flush();

    expect(abort).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(store.getState().availability.unavailableIds).toEqual([]);
  });

  test('returns a function that aborts the request, and an answer that arrives after it is ignored', async () => {
    let resolve;
    answer = () => new Promise((r) => { resolve = r; });
    const store = newStore();

    const abort = store.dispatch(checkAvailability('1'));
    const { signal } = global.fetch.mock.calls[0][1];
    abort();
    resolve(await reply(200, { products: [], pagination: { total: 0 } }));
    await flush();

    expect(signal.aborted).toBe(true);
    expect(store.getState().availability.unavailableIds).toEqual([]);
  });

  test.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a server error', () => reply(500, { error: 'שגיאת שרת' })],
  ])('%s keeps the previous result and does not throw', async (_label, failing) => {
    const store = newStore();
    store.dispatch(checkAvailability('1'));
    await flush();
    expect(store.getState().availability.unavailableIds).toEqual([1]);

    answer = failing;
    store.dispatch(checkAvailability('1,2'));
    await flush();

    expect(store.getState().availability.unavailableIds).toEqual([1]);
  });

  test('re-prices a line whose catalog price changed, and records the change for acknowledgment', async () => {
    inCatalog = [1];
    const store = newStore([{ id: 1, name: 'צבע', price: 8, quantity: 2 }]);

    store.dispatch(checkAvailability('1'));
    await flush();

    expect(store.getState().cart.items[0]).toEqual({ id: 1, name: 'צבע', price: 10, quantity: 2 });
    expect(selectPendingPriceChanges(store.getState())).toEqual([{ id: 1, selectedVariant: null, name: 'צבע', from: 8, to: 10 }]);
    expect(store.getState().availability.unavailableIds).toEqual([]);
  });

  test('matching prices change nothing, and checking again does not touch the state (no loop)', async () => {
    inCatalog = [1];
    const store = newStore([{ id: 1, name: 'צבע', price: 10, quantity: 1 }]);
    const before = store.getState();

    store.dispatch(checkAvailability('1'));
    await flush();
    store.dispatch(checkAvailability('1'));
    await flush();

    expect(store.getState().cart).toBe(before.cart);
    expect(store.getState().availability).toBe(before.availability);
  });

  test('a price that changed and was acknowledged, and changes again, is recorded again', async () => {
    inCatalog = [1];
    const store = newStore([{ id: 1, name: 'צבע', price: 8, quantity: 1 }]);
    store.dispatch(checkAvailability('1'));
    await flush();
    store.dispatch({ type: 'PRICE_CHANGES_ACKNOWLEDGED' });
    expect(selectPendingPriceChanges(store.getState())).toEqual([]);

    answer = (url) => reply(200, [{ id: 1, price: 13, in_stock: true }]);
    store.dispatch(checkAvailability('1'));
    await flush();

    expect(selectPendingPriceChanges(store.getState())).toEqual([{ id: 1, selectedVariant: null, name: 'צבע', from: 10, to: 13 }]);
  });

  test('an out-of-stock product is blocked as a whole and its price is left alone', async () => {
    answer = () => reply(200, [{ id: 1, price: 99, in_stock: false }]);
    const store = newStore([{ id: 1, name: 'צבע', price: 8 }]);

    store.dispatch(checkAvailability('1'));
    await flush();

    expect(store.getState().availability.unavailableIds).toEqual([1]);
    expect(store.getState().cart.items[0].price).toBe(8);
  });

  test('a removed variant blocks only its line; the other variant of the product stays buyable', async () => {
    answer = () => reply(200, [{ id: 1, price: 100, in_stock: true, variants: [{ label: "5 ל'", price: 100 }] }]);
    const store = newStore([
      { id: 1, name: 'צבע', price: 100, selectedVariant: "5 ל'" },
      { id: 1, name: 'צבע', price: 300, selectedVariant: "18 ל'" },
    ]);

    store.dispatch(checkAvailability('1'));
    await flush();

    const lines = selectUnavailableLines(store.getState());
    const [five, eighteen] = store.getState().cart.items;
    expect(isLineUnavailable(lines, five)).toBe(false);
    expect(isLineUnavailable(lines, eighteen)).toBe(true);
    expect(store.getState().availability.unavailableIds).toEqual([]);
  });

  test('compares with the cart as it is when the answer arrives, not as it was when the request left', async () => {
    inCatalog = [1];
    const store = newStore([{ id: 1, name: 'צבע', price: 8 }]);

    store.dispatch(checkAvailability('1'));
    store.dispatch(removeItem(0));
    await flush();

    expect(store.getState().cart.items).toEqual([]);
    expect(selectPendingPriceChanges(store.getState())).toEqual([]);
  });

  test('only the availability part of the state changes', async () => {
    const store = newStore([{ id: 1, price: 1 }]);
    const { cart, wishlist } = store.getState();

    store.dispatch(checkAvailability('1'));
    await flush();

    expect(store.getState().cart).toBe(cart);
    expect(store.getState().wishlist).toBe(wishlist);
  });
});
