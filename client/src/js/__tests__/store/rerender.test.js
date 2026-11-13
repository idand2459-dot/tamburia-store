/**
 * Re-render guard for the store: a component that selects one value is not rendered again when
 * another domain changes, nor when an action changes nothing. With the old Context every consumer
 * rendered on any change.
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { createAppStore } from '../../store/index';
import { selectCartCount, selectDeliveryMethod } from '../../store/cart/cartSelectors';
import { selectWishlistIds } from '../../store/wishlist/wishlistSelectors';
import { selectUnavailableIdSet } from '../../store/availability/availabilitySelectors';
import { addItem, setDeliveryMethod, clearCart } from '../../store/cart/cartActions';
import { setWishlistIds } from '../../store/wishlist/wishlistActions';
import { availabilityLoaded } from '../../store/availability/availabilityActions';

const renders = { count: 0, wishlist: 0, delivery: 0, unavailable: 0 };

function CartCount() {
  renders.count += 1;
  return <span data-testid="count">{useSelector(selectCartCount)}</span>;
}
function WishlistCount() {
  renders.wishlist += 1;
  return <span data-testid="wishlist">{useSelector(selectWishlistIds).length}</span>;
}
function Delivery() {
  renders.delivery += 1;
  return <span data-testid="delivery">{String(useSelector(selectDeliveryMethod))}</span>;
}
function Unavailable() {
  renders.unavailable += 1;
  return <span data-testid="unavailable">{useSelector(selectUnavailableIdSet).size}</span>;
}

function setup() {
  localStorage.clear();
  Object.keys(renders).forEach((key) => { renders[key] = 0; });
  const store = createAppStore();
  render(
    <Provider store={store}>
      <CartCount />
      <WishlistCount />
      <Delivery />
      <Unavailable />
    </Provider>
  );
  return store;
}

test('each component renders once at the start', () => {
  setup();

  expect(renders).toEqual({ count: 1, wishlist: 1, delivery: 1, unavailable: 1 });
});

test('a cart change renders only the components that select from the cart value they use', () => {
  const store = setup();

  act(() => { store.dispatch(addItem({ id: 1, price: 5 })); });

  expect(screen.getByTestId('count')).toHaveTextContent('1');
  expect(renders.count).toBe(2);
  expect(renders.wishlist).toBe(1);
  expect(renders.unavailable).toBe(1);
  expect(renders.delivery).toBe(1);
});

test('a wishlist change renders only the wishlist component', () => {
  const store = setup();

  act(() => { store.dispatch(setWishlistIds([1, 2])); });

  expect(screen.getByTestId('wishlist')).toHaveTextContent('2');
  expect(renders).toEqual({ count: 1, wishlist: 2, delivery: 1, unavailable: 1 });
});

test('choosing the delivery method does not render the cart count or the other domains', () => {
  const store = setup();

  act(() => { store.dispatch(setDeliveryMethod('pickup')); });

  expect(screen.getByTestId('delivery')).toHaveTextContent('pickup');
  expect(renders).toEqual({ count: 1, wishlist: 1, delivery: 2, unavailable: 1 });
});

test('an availability change renders only the component that selects it, with the same Set for the same ids', () => {
  const store = setup();

  act(() => { store.dispatch(availabilityLoaded([3])); });
  expect(screen.getByTestId('unavailable')).toHaveTextContent('1');
  expect(renders).toEqual({ count: 1, wishlist: 1, delivery: 1, unavailable: 2 });

  act(() => { store.dispatch(availabilityLoaded([3])); });
  expect(renders.unavailable).toBe(2);
});

test('actions that change nothing render nothing', () => {
  const store = setup();

  act(() => {
    store.dispatch(clearCart());
    store.dispatch(setDeliveryMethod(null));
    store.dispatch({ type: 'SOMETHING_ELSE' });
  });

  expect(renders).toEqual({ count: 1, wishlist: 1, delivery: 1, unavailable: 1 });
});
