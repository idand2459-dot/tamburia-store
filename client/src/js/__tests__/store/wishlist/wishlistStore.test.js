/**
 * Tests for the wishlist reducer, the selectors and the wishlist persistence: the state holds the
 * saved records, every change is copied to localStorage under the same key and in the same shape
 * as before (plus `category`), reading never writes, and a blocked or malformed localStorage never
 * throws.
 *
 * Run with `npm run test:client` from the root.
 */
import { createAppStore, rootReducer } from '../../../store';
import { wishlistReducer, initialWishlistState } from '../../../store/wishlist/wishlistReducer';
import { toggleWishlist } from '../../../store/wishlist/wishlistActions';
import { selectWishlistItems, selectWishlistIds } from '../../../store/wishlist/wishlistSelectors';
import { readWishlistItems, WISHLIST_STORAGE_KEY as KEY } from '../../../store/persistence';
import { addItem } from '../../../store/cart/cartActions';

const PAINT = { id: 1, name: 'צבע לבן', price: 100, image_url: '/p.webp', in_stock: true, category: 'painting', extra: 'x' };
const BRUSH = { id: 2, name: 'מברשת', price: 30, image_url: '/b.webp', in_stock: false };

const stored = () => JSON.parse(localStorage.getItem(KEY));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('wishlistReducer', () => {
  test('starts with no items; an unknown action returns the same state', () => {
    expect(wishlistReducer(undefined, { type: '@@INIT' })).toBe(initialWishlistState);
    expect(initialWishlistState).toEqual({ items: [] });
  });

  test('toggling adds a canonical record: the known fields only, category included', () => {
    const next = wishlistReducer(initialWishlistState, toggleWishlist(PAINT));

    expect(next.items).toEqual([
      { id: 1, name: 'צבע לבן', price: 100, image_url: '/p.webp', in_stock: true, category: 'painting' },
    ]);
    expect(next.items[0]).not.toHaveProperty('extra');
  });

  test('toggling a saved product removes it; the others keep their order', () => {
    let state = wishlistReducer(initialWishlistState, toggleWishlist(PAINT));
    state = wishlistReducer(state, toggleWishlist(BRUSH));
    expect(state.items.map((p) => p.id)).toEqual([1, 2]);

    state = wishlistReducer(state, toggleWishlist(PAINT));

    expect(state.items.map((p) => p.id)).toEqual([2]);
  });

  test('adding the same product twice never duplicates it (the second toggle removes it)', () => {
    const once = wishlistReducer(initialWishlistState, toggleWishlist(PAINT));
    const twice = wishlistReducer(once, toggleWishlist({ ...PAINT, name: 'changed' }));

    expect(once.items).toHaveLength(1);
    expect(twice.items).toEqual([]);
  });

  test('is pure: the previous state is not changed', () => {
    const before = { items: [{ id: 1, name: 'a' }] };
    const snapshot = JSON.stringify(before);

    wishlistReducer(before, toggleWishlist(BRUSH));
    wishlistReducer(before, toggleWishlist({ id: 1 }));

    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('selectors', () => {
  test('selectWishlistIds follows the items, in saved order', () => {
    const store = createAppStore();
    store.dispatch(toggleWishlist(PAINT));
    store.dispatch(toggleWishlist(BRUSH));

    expect(selectWishlistIds(store.getState())).toEqual([1, 2]);
    expect(selectWishlistItems(store.getState()).map((p) => p.name)).toEqual(['צבע לבן', 'מברשת']);
  });

  test('selectWishlistIds returns the same array while the items are unchanged', () => {
    const store = createAppStore();
    store.dispatch(toggleWishlist(PAINT));
    const first = selectWishlistIds(store.getState());

    store.dispatch(addItem({ id: 9, name: 'x', price: 1 }));

    expect(selectWishlistIds(store.getState())).toBe(first);

    store.dispatch(toggleWishlist(BRUSH));

    expect(selectWishlistIds(store.getState())).not.toBe(first);
  });
});

describe('readWishlistItems', () => {
  test('returns the stored records as they are, in stored order', () => {
    const records = [{ id: 5, name: 'a', price: 1, image_url: '/a', in_stock: true }, { id: 3 }];
    localStorage.setItem(KEY, JSON.stringify(records));

    expect(readWishlistItems()).toEqual(records);
  });

  test('reads records saved before category existed, and keeps them without one', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 1, name: 'old', price: 1, image_url: '', in_stock: true }]));

    const store = createAppStore();

    expect(selectWishlistItems(store.getState())[0]).not.toHaveProperty('category');
  });

  test.each([
    ['nothing stored', null],
    ['malformed JSON', '{not json'],
    ['a stored null', 'null'],
    ['an object instead of a list', '{"id":1}'],
    ['a string', '"abc"'],
  ])('returns [] for %s', (_label, value) => {
    if (value !== null) localStorage.setItem(KEY, value);

    expect(readWishlistItems()).toEqual([]);
  });

  test('drops entries without a numeric id, and repeated ids (the first one wins)', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: 1, name: 'first' }, null, 'x', { name: 'no id' }, { id: '2' }, { id: 1, name: 'second' }, { id: 3 },
    ]));

    expect(readWishlistItems()).toEqual([{ id: 1, name: 'first' }, { id: 3 }]);
  });

  test('returns [] when reading localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(readWishlistItems()).toEqual([]);
  });
});

describe('persistence', () => {
  test('building the store never writes the wishlist, not even over unreadable data', () => {
    localStorage.setItem(KEY, '{not json');
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    createAppStore();

    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe('{not json');
  });

  test('every change is written under the same key, as a list of canonical records', () => {
    const store = createAppStore();

    store.dispatch(toggleWishlist(PAINT));
    expect(stored()).toEqual([{ id: 1, name: 'צבע לבן', price: 100, image_url: '/p.webp', in_stock: true, category: 'painting' }]);

    store.dispatch(toggleWishlist(BRUSH));
    expect(stored().map((p) => p.id)).toEqual([1, 2]);

    store.dispatch(toggleWishlist(PAINT));
    expect(stored().map((p) => p.id)).toEqual([2]);
  });

  test('a saved list survives a reload: a new store reads what the old one wrote', () => {
    const first = createAppStore();
    first.dispatch(toggleWishlist(PAINT));
    first.dispatch(toggleWishlist(BRUSH));

    const reloaded = createAppStore();

    expect(selectWishlistItems(reloaded.getState())).toEqual(selectWishlistItems(first.getState()));
    expect(selectWishlistIds(reloaded.getState())).toEqual([1, 2]);
  });

  test('existing saved records keep working: they load, and a change keeps them', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 9, name: 'שמור', price: 7, image_url: '/s.webp', in_stock: true }]));
    const store = createAppStore();

    store.dispatch(toggleWishlist(PAINT));

    expect(stored().map((p) => p.id)).toEqual([9, 1]);
    expect(stored()[0]).toEqual({ id: 9, name: 'שמור', price: 7, image_url: '/s.webp', in_stock: true });
  });

  test('unreadable stored data starts as empty and is replaced by the first change', () => {
    localStorage.setItem(KEY, '{not json');
    const store = createAppStore();
    expect(selectWishlistIds(store.getState())).toEqual([]);

    store.dispatch(toggleWishlist(PAINT));

    expect(stored().map((p) => p.id)).toEqual([1]);
  });

  test('does not throw when writing is blocked, and the state still changes', () => {
    const store = createAppStore();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });

    expect(() => store.dispatch(toggleWishlist(PAINT))).not.toThrow();

    expect(selectWishlistIds(store.getState())).toEqual([1]);
  });

  test('a cart change does not write the wishlist', () => {
    const store = createAppStore();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    store.dispatch(addItem({ id: 9, name: 'x', price: 1 }));

    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toEqual([]);
  });

  test('a wishlist change leaves the cart and the availability untouched', () => {
    const store = createAppStore();
    const { cart, availability } = store.getState();

    store.dispatch(toggleWishlist(PAINT));

    expect(store.getState().cart).toBe(cart);
    expect(store.getState().availability).toBe(availability);
  });

  test('rootReducer alone (without persistence) builds the same shape', () => {
    expect(rootReducer(undefined, { type: '@@INIT' }).wishlist).toEqual({ items: [] });
  });
});
