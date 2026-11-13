/**
 * Tests for the wishlist reducer, selector and the toggleWishlist thunk, with the same cases the
 * old useWishlist hook was pinned with (hooks/useWishlist.test.js): the stored record has a fixed
 * shape, the ids follow the stored list, and a blocked or malformed localStorage never throws.
 *
 * Run with `npm run test:client` from the root.
 */
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import { rootReducer } from '../rootReducer';
import { wishlistReducer, initialWishlistState } from './wishlistReducer';
import { setWishlistIds, toggleWishlist } from './wishlistActions';
import { selectWishlistIds } from './wishlistSelectors';
import { readWishlistIds, WISHLIST_STORAGE_KEY as KEY } from '../persistence';

const PAINT = { id: 1, name: 'צבע לבן', price: 100, image_url: '/p.webp', in_stock: true, category: 'painting', extra: 'x' };
const BRUSH = { id: 2, name: 'מברשת', price: 30, image_url: '/b.webp', in_stock: false };

const stored = () => JSON.parse(localStorage.getItem(KEY));
const newStore = () => createStore(rootReducer, applyMiddleware(thunk));
const idsOf = (store) => selectWishlistIds(store.getState());

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('wishlistReducer', () => {
  test('starts with no ids; an unknown action returns the same state', () => {
    expect(wishlistReducer(undefined, { type: '@@INIT' })).toBe(initialWishlistState);
    expect(initialWishlistState).toEqual({ ids: [] });
  });

  test('WISHLIST_IDS_SET replaces the ids', () => {
    expect(wishlistReducer({ ids: [1] }, setWishlistIds([2, 3]))).toEqual({ ids: [2, 3] });
  });
});

describe('readWishlistIds', () => {
  test('returns the ids of the stored records, in stored order', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 5 }, { id: 3 }]));

    expect(readWishlistIds()).toEqual([5, 3]);
  });

  test.each([
    ['nothing stored', null],
    ['malformed JSON', '{not json'],
    ['a stored null', 'null'],
  ])('returns [] for %s', (_label, value) => {
    if (value !== null) localStorage.setItem(KEY, value);

    expect(readWishlistIds()).toEqual([]);
  });

  test('returns [] when reading localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(readWishlistIds()).toEqual([]);
  });
});

describe('toggleWishlist', () => {
  test('adds a product: its id joins the ids and a trimmed record is stored (no category, no extra fields)', () => {
    const store = newStore();

    store.dispatch(toggleWishlist(PAINT));

    expect(idsOf(store)).toEqual([1]);
    expect(stored()).toEqual([{ id: 1, name: 'צבע לבן', price: 100, image_url: '/p.webp', in_stock: true }]);
  });

  test('adds after the existing ones, and removes one that is already there', () => {
    const store = newStore();
    store.dispatch(toggleWishlist(PAINT));
    store.dispatch(toggleWishlist(BRUSH));
    expect(idsOf(store)).toEqual([1, 2]);

    store.dispatch(toggleWishlist(PAINT));

    expect(idsOf(store)).toEqual([2]);
    expect(stored().map((p) => p.id)).toEqual([2]);
  });

  test('reads the stored list at toggle time, so a record added elsewhere is kept', () => {
    const store = newStore();
    localStorage.setItem(KEY, JSON.stringify([{ id: 9, name: 'אחר', price: 1 }]));

    store.dispatch(toggleWishlist(PAINT));

    expect(idsOf(store)).toEqual([9, 1]);
    expect(stored().map((p) => p.id)).toEqual([9, 1]);
  });

  test('changes nothing when the stored value is malformed', () => {
    const store = newStore();
    localStorage.setItem(KEY, '{not json');

    store.dispatch(toggleWishlist(PAINT));

    expect(idsOf(store)).toEqual([]);
  });

  test('does not throw and changes nothing when writing is blocked', () => {
    const store = newStore();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });

    expect(() => store.dispatch(toggleWishlist(PAINT))).not.toThrow();

    expect(idsOf(store)).toEqual([]);
  });

  test('only the wishlist part of the state changes', () => {
    const store = newStore();
    const { cart, availability } = store.getState();

    store.dispatch(toggleWishlist(PAINT));

    expect(store.getState().cart).toBe(cart);
    expect(store.getState().availability).toBe(availability);
  });
});
