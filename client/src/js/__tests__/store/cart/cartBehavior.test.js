/**
 * The cart behavior pinned in P1 (hooks/useCart.test.js and hooks/useCart.delivery.test.js),
 * moved with the cart to the Redux store (P4R). The test names and every assertion are the
 * ones that were written against the useCart hook; only the setup changed: the cart is a store
 * and `cart()` reads it, `addToCart` and the others dispatch the same operations.
 *
 * The quantity argument of the add operation: the product card in the grid adds one item without a
 * quantity, and the product page passes what the quantity picker chose. A default that breaks the
 * first caller is exactly what is easy to miss, so both cases are written explicitly.
 *
 * Run with `npm run test:client` from the root. localStorage is reset before each test, because
 * the store loads its initial state from it and saves the cart on every change.
 */
import { createAppStore } from '../../../store/index';
import { addItem, addBundle, setDeliveryMethod } from '../../../store/cart/cartActions';
import {
  selectCartItems, selectCartCount, selectSubtotal, selectDeliveryFee, selectTotal,
} from '../../../store/cart/cartSelectors';

const PRODUCT = {
  id: 1, name: 'מברשת צביעה', price: 10,
  selectedColor: null, selectedSize: null,
};

/** A cart over a store, with the operations and values the screens use. */
function newCart(items = []) {
  const store = createAppStore({
    cart: { items, deliveryMethod: null, priceChanges: [] },
    wishlist: { items: [] },
    availability: { unavailableIds: [], unavailableVariants: [] },
  });
  const state = () => store.getState();
  return {
    addToCart: (product, quantity) => store.dispatch(addItem(product, quantity)),
    addBundleToCart: (bundle) => store.dispatch(addBundle(bundle)),
    setDeliveryMethod: (method) => store.dispatch(setDeliveryMethod(method)),
    get cart() { return selectCartItems(state()); },
    get cartCount() { return selectCartCount(state()); },
    get subtotal() { return selectSubtotal(state()); },
    get deliveryFee() { return selectDeliveryFee(state()); },
    get total() { return selectTotal(state()); },
  };
}

beforeEach(() => localStorage.clear());

test('קורא בלי כמות מוסיף פריט אחד, ולחיצה שנייה מגדילה לשניים', () => {
  const cart = newCart();

  cart.addToCart(PRODUCT);
  expect(cart.cart).toHaveLength(1);
  expect(cart.cart[0].quantity).toBe(1);

  cart.addToCart(PRODUCT);
  expect(cart.cart).toHaveLength(1);
  expect(cart.cart[0].quantity).toBe(2);
  expect(cart.cartCount).toBe(2);
});

test('כמות מפורשת נכנסת כמו שהיא, ומצטברת על פריט קיים', () => {
  const cart = newCart();

  cart.addToCart(PRODUCT, 3);
  expect(cart.cart[0].quantity).toBe(3);

  cart.addToCart(PRODUCT, 2);
  expect(cart.cart).toHaveLength(1);
  expect(cart.cart[0].quantity).toBe(5);

  cart.addToCart({ ...PRODUCT, id: 2 }, 4);
  expect(cart.cart).toHaveLength(2);
  expect(cart.cartCount).toBe(9);
  expect(cart.subtotal).toBe(90);
});

test('צבע אחר הוא שורה אחרת בעגלה, עם כמות משלה', () => {
  const cart = newCart();

  cart.addToCart({ ...PRODUCT, selectedColor: 'לבן' }, 3);
  cart.addToCart({ ...PRODUCT, selectedColor: 'שחור' }, 2);

  expect(cart.cart.map((item) => item.quantity)).toEqual([3, 2]);
});

/*
 * BF-01 (backlog item, REFACTOR_PLAN.md §7), fixed in P7.3 for addToCart only.
 *
 * The two ways of adding to the cart match "the same line" differently. addToCart now treats the
 * variant as part of the line: two sizes of one product are two lines, each at its own price.
 * addBundleToCart (the calculators) still matches by id alone, whatever the colour, size or
 * variant: that is the old useCart behavior, kept on purpose and recorded here for a later review.
 */
test('addToCart keeps another variant as its own line (BF-01 fixed), while a bundle still matches by id only', () => {
  const cart = newCart();
  const small = { ...PRODUCT, price: 10, selectedVariant: '1 ליטר' };
  const large = { ...PRODUCT, price: 40, selectedVariant: '5 ליטר' };

  // addToCart: another variant is another line, with its own quantity and price.
  cart.addToCart(small, 1);
  cart.addToCart(large, 2);
  expect(cart.cart).toHaveLength(2);
  expect(cart.cart.map((line) => line.quantity)).toEqual([1, 2]);
  expect(cart.cart.map((line) => line.selectedVariant)).toEqual(['1 ליטר', '5 ליטר']);
  expect(cart.cart.map((line) => line.price)).toEqual([10, 40]);
  expect(cart.subtotal).toBe(90);

  // The same variant again merges into its line.
  cart.addToCart(large, 1);
  expect(cart.cart).toHaveLength(2);
  expect(cart.cart[1].quantity).toBe(3);

  // addBundleToCart: an existing id is matched whatever its colour, size or variant.
  const bundle = newCart([{ ...PRODUCT, selectedColor: 'לבן', quantity: 1 }]);
  bundle.addBundleToCart([{ ...PRODUCT, selectedColor: 'שחור', quantity: 2 }]);
  expect(bundle.cart).toHaveLength(1);
  expect(bundle.cart[0].quantity).toBe(3);
  expect(bundle.cart[0].selectedColor).toBe('לבן');

  // addBundleToCart: a product that is not in the cart is added with its colour cleared.
  bundle.addBundleToCart([{ ...PRODUCT, id: 2, selectedColor: 'אדום', quantity: 1 }]);
  expect(bundle.cart).toHaveLength(2);
  expect(bundle.cart[1].id).toBe(2);
  expect(bundle.cart[1].selectedColor).toBeNull();
});

describe('the delivery fee as the cart exposes it (was hooks/useCart.delivery.test.js)', () => {
  /** A cart of 3 x 12.90. */
  function setup() {
    const cart = newCart();
    cart.addToCart({ id: 1, name: 'צבע', price: 12.9 }, 3);
    return cart;
  }

  test('with no delivery method the fee is zero and the total is the subtotal', () => {
    const cart = setup();

    expect(cart.deliveryFee).toBe(0);
    expect(cart.subtotal).toBe(38.7);
    expect(cart.total).toBe(38.7);
  });

  test('a delivery adds a fee of 20 to the total', () => {
    const cart = setup();

    cart.setDeliveryMethod('delivery');

    expect(cart.deliveryFee).toBe(20);
    expect(cart.total).toBe(58.7);
  });

  test('a pickup has no fee', () => {
    const cart = setup();

    cart.setDeliveryMethod('pickup');

    expect(cart.deliveryFee).toBe(0);
    expect(cart.total).toBe(38.7);
  });
});
