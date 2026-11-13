/**
 * Tests for useCheckoutForm, pinned at the fetch level: the exact order the hook sends, and what
 * each answer does to the screen state and the cart. They record today's behavior:
 *   - 201 shows the thank-you state, empties the cart and clears the form;
 *   - 409 shows the server message and re-prices the cart by id and variant, keeping it;
 *   - any other rejection shows the server message and keeps the cart untouched;
 *   - a network failure, or an OK answer that is not JSON, shows the connection message.
 *
 * The cart is the real Redux store the hook reads from and dispatches to, because the hook empties
 * and re-prices it there. (Before P4R the cart was a React state handed to the hook together with
 * totals; now the subtotal, fee and total are derived from the cart, so the request carries the
 * derived fee of 20 and total of 550 instead of the arbitrary 40 and 570 the old fixture passed in.)
 *
 * Run with `npm run test:client` from the root.
 */
import { useSelector, Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react';
import { useCheckoutForm } from './useCheckoutForm';
import { createAppStore } from '../store';
import { selectCartItems, selectDeliveryMethod } from '../store/cart/cartSelectors';

const CART = [
  { id: 1, name: 'צבע לבן', price: 100, quantity: 2, selectedVariant: "5 ל'", selectedColor: 'לבן', selectedSize: null },
  { id: 1, name: 'צבע לבן', price: 300, quantity: 1, selectedVariant: "18 ל'" },
  { id: 2, name: 'מברשת', price: 30 },
];
const REJECTED = 'שליחת ההזמנה נכשלה. אפשר לנסות שוב.';
const CONNECTION = 'לא הצלחנו לשלוח את ההזמנה. בדקו את החיבור ונסו שוב.';
const SAVED = { id: 321, status: 'new', total: 550 };

/** A fetch response; a body of `undefined` is one that is not JSON. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

let orderReply;

/** The hook next to the cart it reads from and writes to. */
function useHarness() {
  const cart = useSelector(selectCartItems);
  const deliveryMethod = useSelector(selectDeliveryMethod);
  const form = useCheckoutForm();
  return { cart, deliveryMethod, form };
}

/** Renders the harness and fills the form. */
function setup({ method = 'delivery', fill = {} } = {}) {
  const store = createAppStore({
    cart: { items: CART, deliveryMethod: method },
    wishlist: { ids: [] },
    availability: { unavailableIds: [] },
  });
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  const { result } = renderHook(() => useHarness(), { wrapper });
  act(() => {
    result.current.form.setCustomerName(fill.name ?? 'דנה כהן');
    result.current.form.setCustomerPhone(fill.phone ?? '0501234567');
    result.current.form.setCustomerEmail(fill.email ?? 'dana@example.com');
    result.current.form.setDeliveryAddress(fill.address ?? 'הרצל 1, חיפה');
    result.current.form.setOrderNotes(fill.notes ?? 'להתקשר לפני');
  });
  return result;
}

const orderCalls = () => global.fetch.mock.calls.filter(([url]) => url === '/api/orders');
const place = (result) => act(async () => { await result.current.form.handlePlaceOrder(); });

beforeEach(() => {
  localStorage.clear();
  orderReply = () => reply(201, SAVED);
  global.fetch = jest.fn((url) => {
    if (url === '/api/orders') return orderReply();
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  delete global.fetch;
});

describe('what is sent', () => {
  test('POSTs the customer, the lines with their variant, color and size, and the totals', async () => {
    const result = setup();

    await place(result);

    const calls = orderCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].method).toBe('POST');
    expect(calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0][1].body)).toEqual({
      customer_name: 'דנה כהן',
      customer_phone: '0501234567',
      customer_email: 'dana@example.com',
      delivery_method: 'delivery',
      delivery_address: 'הרצל 1, חיפה',
      notes: 'להתקשר לפני',
      items: [
        { id: 1, name: 'צבע לבן', price: 100, quantity: 2, selectedVariant: "5 ל'", selectedColor: 'לבן', selectedSize: null },
        { id: 1, name: 'צבע לבן', price: 300, quantity: 1, selectedVariant: "18 ל'", selectedColor: null, selectedSize: null },
        { id: 2, name: 'מברשת', price: 30, quantity: 1, selectedVariant: null, selectedColor: null, selectedSize: null },
      ],
      subtotal: 530,
      delivery_fee: 20,
      total: 550,
    });
  });

  test('a pickup order sends no address even when one was typed', async () => {
    const result = setup({ method: 'pickup' });

    await place(result);

    const body = JSON.parse(orderCalls()[0][1].body);
    expect(body.delivery_method).toBe('pickup');
    expect(body.delivery_address).toBeNull();
  });

  test.each([
    ['no name', { name: '' }],
    ['no phone', { phone: '' }],
    ['a delivery without an address', { address: '' }],
  ])('%s: nothing is sent and the screen state does not change', async (_label, fill) => {
    const result = setup({ fill });

    await place(result);

    expect(orderCalls()).toHaveLength(0);
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.form.orderError).toBe('');
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.cart).toEqual(CART);
  });
});

describe('201 — the order was saved', () => {
  test('shows the saved order, empties the cart, clears the delivery method and the form', async () => {
    const result = setup();

    await place(result);

    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.orderError).toBe('');
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual([]);
    expect(result.current.deliveryMethod).toBeNull();
    expect(result.current.form.customerName).toBe('');
    expect(result.current.form.customerPhone).toBe('');
    expect(result.current.form.customerEmail).toBe('');
    expect(result.current.form.deliveryAddress).toBe('');
    expect(result.current.form.orderNotes).toBe('');
  });

  test('the submitting flag is on while the request is in flight', async () => {
    let settle;
    orderReply = () => new Promise((resolve) => { settle = resolve; });
    const result = setup();

    let pending;
    act(() => { pending = result.current.form.handlePlaceOrder(); });
    expect(result.current.form.submittingOrder).toBe(true);

    await act(async () => { settle({ ok: true, status: 201, json: async () => SAVED }); await pending; });
    expect(result.current.form.submittingOrder).toBe(false);
  });

  test('clearOrderSuccess clears the thank-you state and any error', async () => {
    const result = setup();
    await place(result);
    expect(result.current.form.orderSuccess).toEqual(SAVED);

    act(() => { result.current.form.clearOrderSuccess(); });

    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.orderError).toBe('');
  });
});

describe('409 — a price changed while the item sat in the cart', () => {
  const PRICES = [
    { id: 1, selectedVariant: "5 ל'", price: 110 },
    { id: 1, selectedVariant: "18 ל'", price: 320 },
    { id: 2, selectedVariant: null, price: 35 },
    { id: 99, price: 5 },
  ];

  test('shows the server message, keeps the cart and the form, and re-prices each line by id and variant', async () => {
    orderReply = () => reply(409, { error: 'מחירים התעדכנו', details: { prices: PRICES } });
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe('מחירים התעדכנו');
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart.map((i) => i.price)).toEqual([110, 320, 35]);
    expect(result.current.cart.map((i) => i.quantity)).toEqual([2, 1, undefined]);
    expect(result.current.cart.map((i) => i.selectedVariant)).toEqual(["5 ל'", "18 ל'", undefined]);
    expect(result.current.deliveryMethod).toBe('delivery');
    expect(result.current.form.customerName).toBe('דנה כהן');
  });

  test('a line with no matching price keeps its price, and a price for another variant does not apply', async () => {
    orderReply = () => reply(409, {
      error: 'מחירים התעדכנו',
      details: { prices: [{ id: 1, selectedVariant: "18 ל'", price: 320 }, { id: 2, selectedVariant: 'x', price: 1 }] },
    });
    const result = setup();

    await place(result);

    expect(result.current.cart.map((i) => i.price)).toEqual([100, 320, 30]);
  });

  test('a second attempt sends the corrected prices', async () => {
    orderReply = () => reply(409, { error: 'מחירים התעדכנו', details: { prices: PRICES } });
    const result = setup();
    await place(result);

    orderReply = () => reply(201, SAVED);
    await place(result);

    expect(orderCalls()).toHaveLength(2);
    expect(JSON.parse(orderCalls()[1][1].body).items.map((i) => i.price)).toEqual([110, 320, 35]);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.cart).toEqual([]);
  });

  test.each([
    ['details without prices', { error: 'התנגשות', details: {} }],
    ['prices that are not an array', { error: 'התנגשות', details: { prices: 'x' } }],
    ['no details', { error: 'התנגשות' }],
  ])('a 409 with %s shows the message and leaves the cart as it was', async (_label, body) => {
    orderReply = () => reply(409, body);
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe('התנגשות');
    expect(result.current.cart).toEqual(CART);
  });
});

describe('other rejections', () => {
  test.each([
    ['a 400 shows the server message', 400, { error: 'הטלפון לא תקין' }, 'הטלפון לא תקין'],
    ['a 500 shows the server message', 500, { error: 'שגיאת שרת' }, 'שגיאת שרת'],
    ['a rejection without a message shows the fallback', 500, {}, REJECTED],
    ['a blank message shows the fallback', 400, { error: '  ' }, REJECTED],
    ['a rejection whose body is not JSON shows the fallback', 502, undefined, REJECTED],
  ])('%s, keeps the cart and the form, and stops submitting', async (_label, status, body, expected) => {
    orderReply = () => reply(status, body);
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(expected);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.deliveryMethod).toBe('delivery');
    expect(result.current.form.customerName).toBe('דנה כהן');
    expect(result.current.form.deliveryAddress).toBe('הרצל 1, חיפה');
  });

  test('a new attempt clears the earlier error before it sends', async () => {
    orderReply = () => reply(400, { error: 'הטלפון לא תקין' });
    const result = setup();
    await place(result);
    expect(result.current.form.orderError).toBe('הטלפון לא תקין');

    let settle;
    orderReply = () => new Promise((resolve) => { settle = resolve; });
    let pending;
    act(() => { pending = result.current.form.handlePlaceOrder(); });
    expect(result.current.form.orderError).toBe('');

    await act(async () => { settle({ ok: true, status: 201, json: async () => SAVED }); await pending; });
  });
});

describe('connection failures', () => {
  test('a network failure shows the connection message, keeps the cart and stops submitting', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(CONNECTION);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.form.customerName).toBe('דנה כהן');
  });

  test('an OK answer whose body is not JSON is treated like a connection failure and keeps the cart', async () => {
    orderReply = () => reply(201, undefined);
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(CONNECTION);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual(CART);
  });
});
