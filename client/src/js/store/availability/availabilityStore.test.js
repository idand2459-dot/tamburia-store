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
import { rootReducer } from '../rootReducer';
import { availabilityReducer, initialAvailabilityState } from './availabilityReducer';
import { availabilityLoaded, availabilityCleared, checkAvailability } from './availabilityActions';
import {
  selectAvailabilityKey, selectUnavailableIds, selectUnavailableIdSet,
} from './availabilitySelectors';

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
  { cart: { items, deliveryMethod: null }, wishlist: { ids: [] }, availability: { unavailableIds: [] } },
  applyMiddleware(thunk)
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  inCatalog = [];
  answer = (url) => {
    const asked = decodeURIComponent(url.split('ids=')[1]).split(',').map(Number);
    const products = asked.filter((id) => inCatalog.includes(id)).map((id) => ({ id }));
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
    expect(initialAvailabilityState).toEqual({ unavailableIds: [] });
  });

  test('AVAILABILITY_LOADED stores the ids, and the same ids return the same state', () => {
    const state = availabilityReducer(initialAvailabilityState, availabilityLoaded([1, 5]));

    expect(state).toEqual({ unavailableIds: [1, 5] });
    expect(availabilityReducer(state, availabilityLoaded([1, 5]))).toBe(state);
  });

  test('AVAILABILITY_CLEARED empties the ids, and an already empty list returns the same state', () => {
    expect(availabilityReducer({ unavailableIds: [1] }, availabilityCleared())).toEqual({ unavailableIds: [] });
    expect(availabilityReducer(initialAvailabilityState, availabilityCleared())).toBe(initialAvailabilityState);
  });
});

describe('selectors', () => {
  const stateOf = (ids, unavailableIds = []) => ({
    cart: { items: ids.map((id) => ({ id })), deliveryMethod: null },
    availability: { unavailableIds },
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
      { cart: { items: [], deliveryMethod: null }, wishlist: { ids: [] }, availability: { unavailableIds: [1] } },
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

  test('only the availability part of the state changes', async () => {
    const store = newStore([{ id: 1, price: 1 }]);
    const { cart, wishlist } = store.getState();

    store.dispatch(checkAvailability('1'));
    await flush();

    expect(store.getState().cart).toBe(cart);
    expect(store.getState().wishlist).toBe(wishlist);
  });
});
