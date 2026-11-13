/**
 * The wishlist screens over one real store: a product card, the product page, the navbar counter
 * and the wishlist window all read the same list, so a change made in any of them shows in all of
 * them at once, and the cart never moves.
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { createAppStore } from '../../../store';
import { toggleWishlist } from '../../../store/wishlist/wishlistActions';
import { selectWishlistIds } from '../../../store/wishlist/wishlistSelectors';
import { WISHLIST_STORAGE_KEY as KEY } from '../../../store/persistence';
import Navbar from '../../../components/Navbar';
import ProductList from '../../../components/ProductList';
import ProductDetails from '../../../features/catalog/product-page/ProductDetails';
import Wishlist from '../../../features/cart/Wishlist';

const PAGE_PRODUCT = { id: 1, name: 'מברשת רחבה', price: 10, category: 'painting', in_stock: true, image_url: '' };
const CARD_PRODUCT = { id: 2, name: 'רולר קצר', price: 20, category: 'tools', in_stock: true, image_url: '' };

/** The product list wired the way the category page wires it. */
function CardGrid() {
  const dispatch = useDispatch();
  return (
    <ProductList
      products={[CARD_PRODUCT]}
      wishlistIds={useSelector(selectWishlistIds)}
      onToggleWishlist={(product) => dispatch(toggleWishlist(product))}
      onAddToCart={() => {}}
    />
  );
}

/** Answers every request: the availability check gets the ids it asked about, the rest get []. */
function fakeFetch(url) {
  const ids = new URL(url, 'http://localhost').searchParams.get('ids');
  const body = ids ? ids.split(',').map((id) => ({ id: Number(id), active: true })) : [];
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

/** Renders the four places over one store, with the wishlist window open. */
async function renderScreens(store = createAppStore()) {
  // Inside act, so the fetches the screens start on mount (related products, reviews, availability)
  // settle before the test goes on.
  await act(async () => { render(
    <MemoryRouter>
      <Provider store={store}>
        <Navbar menuOpen={false} setMenuOpen={() => {}} />
        <ProductDetails product={PAGE_PRODUCT} onAddToCart={() => {}} />
        <CardGrid />
        <Wishlist onClose={() => {}} />
      </Provider>
    </MemoryRouter>,
  ); });
  return store;
}

const counter = () => document.querySelector('.navbar-wishlist-count');
const stored = () => JSON.parse(localStorage.getItem(KEY));
/** Clicks inside act and lets the availability request that follows a list change settle. */
const click = (element) => act(async () => { fireEvent.click(element); });
const windowRows = () => [...document.querySelectorAll('.wishlist-row')];
/** The heart of a product on the page or on a card; the remove buttons in the window share the label, so they are left out. */
const heart = (name, saved) => {
  const label = `${saved ? 'הסר מהמועדפים' : 'הוסף למועדפים'}: ${name}`;
  const found = screen.queryAllByRole('button', { name: label }).filter((button) => !button.closest('.wishlist-row'));
  if (found.length !== 1) throw new Error(`expected one heart "${label}", found ${found.length}`);
  return found[0];
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(fakeFetch);
});

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

test('starts empty everywhere', async () => {
  await renderScreens();

  expect(counter()).toBeNull();
  expect(windowRows()).toHaveLength(0);
  expect(heart(PAGE_PRODUCT.name, false)).toHaveAttribute('aria-pressed', 'false');
  expect(heart(CARD_PRODUCT.name, false)).toHaveAttribute('aria-pressed', 'false');
});

test('the heart on a product card updates the counter, the window and storage', async () => {
  await renderScreens();

  await click(heart(CARD_PRODUCT.name, false));

  expect(heart(CARD_PRODUCT.name, true)).toHaveAttribute('aria-pressed', 'true');
  expect(counter()).toHaveTextContent('1');
  expect(windowRows()).toHaveLength(1);
  expect(within(windowRows()[0]).getByText(CARD_PRODUCT.name)).toBeInTheDocument();
  expect(stored().map((p) => p.id)).toEqual([2]);
});

test('the heart on the product page updates the counter, the window and storage', async () => {
  await renderScreens();

  await click(heart(PAGE_PRODUCT.name, false));

  expect(heart(PAGE_PRODUCT.name, true)).toHaveAttribute('aria-pressed', 'true');
  expect(counter()).toHaveTextContent('1');
  expect(windowRows()).toHaveLength(1);
  expect(within(windowRows()[0]).getByText(PAGE_PRODUCT.name)).toBeInTheDocument();
  expect(stored()).toEqual([expect.objectContaining({ id: 1, name: PAGE_PRODUCT.name, category: 'painting' })]);
});

test('removing from the window clears the heart on the card, the heart on the page and the counter', async () => {
  const store = createAppStore();
  store.dispatch(toggleWishlist(PAGE_PRODUCT));
  store.dispatch(toggleWishlist(CARD_PRODUCT));
  await renderScreens(store);
  expect(counter()).toHaveTextContent('2');
  expect(windowRows()).toHaveLength(2);

  await click(within(windowRows()[0]).getByRole('button'));

  expect(heart(PAGE_PRODUCT.name, false)).toHaveAttribute('aria-pressed', 'false');
  expect(heart(CARD_PRODUCT.name, true)).toBeInTheDocument();
  expect(counter()).toHaveTextContent('1');
  expect(windowRows()).toHaveLength(1);
  expect(stored().map((p) => p.id)).toEqual([2]);
});

test('toggling the same heart twice adds and then removes: no duplicate, empty again', async () => {
  await renderScreens();

  await click(heart(CARD_PRODUCT.name, false));
  expect(windowRows()).toHaveLength(1);
  await click(heart(CARD_PRODUCT.name, true));

  expect(counter()).toBeNull();
  expect(windowRows()).toHaveLength(0);
  expect(stored()).toEqual([]);
});

test('a change dispatched from outside shows in every place without any of them being touched', async () => {
  const store = await renderScreens();

  await act(async () => { store.dispatch(toggleWishlist(PAGE_PRODUCT)); });

  expect(counter()).toHaveTextContent('1');
  expect(heart(PAGE_PRODUCT.name, true)).toBeInTheDocument();
  expect(windowRows()).toHaveLength(1);
});

test('a list saved in an earlier visit shows everywhere after a reload', async () => {
  localStorage.setItem(KEY, JSON.stringify([
    { id: 1, name: PAGE_PRODUCT.name, price: 10, image_url: '', in_stock: true },
    { id: 2, name: CARD_PRODUCT.name, price: 20, image_url: '', in_stock: true },
  ]));

  await renderScreens();

  expect(counter()).toHaveTextContent('2');
  expect(heart(PAGE_PRODUCT.name, true)).toBeInTheDocument();
  expect(heart(CARD_PRODUCT.name, true)).toBeInTheDocument();
  expect(windowRows()).toHaveLength(2);
});

test('malformed saved data renders as an empty list and the first heart recovers it', async () => {
  localStorage.setItem(KEY, '{not json');

  await renderScreens();
  expect(counter()).toBeNull();
  expect(windowRows()).toHaveLength(0);

  await click(heart(CARD_PRODUCT.name, false));

  expect(counter()).toHaveTextContent('1');
  expect(stored().map((p) => p.id)).toEqual([2]);
});

test('a blocked localStorage does not break the screens: the hearts still work for this visit', async () => {
  // Only the wishlist key is blocked: the cart write at startup is unguarded by design (unchanged).
  const realSetItem = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
    if (key === KEY) throw new Error('blocked');
    return realSetItem.call(this, key, value);
  });
  await renderScreens();

  await click(heart(CARD_PRODUCT.name, false));

  expect(counter()).toHaveTextContent('1');
  expect(windowRows()).toHaveLength(1);
});

test('the wishlist never touches the cart', async () => {
  const store = createAppStore();
  const { cart } = store.getState();
  await renderScreens(store);

  await click(heart(CARD_PRODUCT.name, false));
  await click(heart(PAGE_PRODUCT.name, false));
  await click(within(windowRows()[0]).getByRole('button'));

  expect(store.getState().cart).toBe(cart);
  expect(localStorage.getItem('tamburia-cart')).toBe('[]');
});
