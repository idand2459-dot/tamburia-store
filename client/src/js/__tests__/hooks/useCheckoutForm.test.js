/**
 * Tests for useCheckoutForm, pinned at the fetch level: the exact order the hook sends, and what
 * each answer does to the screen state and the cart. They record today's behavior:
 *   - 201 shows the thank-you state, empties the cart and clears the form;
 *   - 409 shows the server message and re-prices the cart by id and variant, keeping it;
 *   - any other 4xx rejection shows the server message, keeps the cart and ends the attempt;
 *   - a network failure, a timeout, a 5xx or an OK answer that is not JSON is an unknown outcome:
 *     the attempt is kept (see the last describe blocks) so the same order can be sent again safely.
 *
 * The cart is the real Redux store the hook reads from and dispatches to, because the hook empties
 * and re-prices it there. (Before P4R the cart was a React state handed to the hook together with
 * totals; now the subtotal, fee and total are derived from the cart, so the request carries the
 * derived fee of 20 and total of 550 instead of the arbitrary 40 and 570 the old fixture passed in.)
 *
 * Run with `npm run test:client` from the root.
 */
import { useSelector, useStore, Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react';
import { useCheckoutForm } from '../../hooks/useCheckoutForm';
import { createAppStore } from '../../store';
import { selectCartItems, selectDeliveryMethod, selectPendingPriceChanges } from '../../store/cart/cartSelectors';
import { acknowledgePriceChanges } from '../../store/cart/cartActions';
import { availabilityLoaded } from '../../store/availability/availabilityActions';

const CART = [
  { id: 1, name: 'צבע לבן', price: 100, quantity: 2, selectedVariant: "5 ל'", selectedColor: 'לבן', selectedSize: null },
  { id: 1, name: 'צבע לבן', price: 300, quantity: 1, selectedVariant: "18 ל'" },
  { id: 2, name: 'מברשת', price: 30 },
];
const REJECTED = 'שליחת ההזמנה נכשלה. אפשר לנסות שוב.';
const UNCERTAIN = 'לא קיבלנו אישור מהשרת, וייתכן שההזמנה כבר התקבלה. אפשר לשלוח אותה שוב: לא תיווצר הזמנה כפולה, גם אחרי רענון הדף.';
const UNCERTAIN_UNSAVED = 'לא קיבלנו אישור מהשרת, וייתכן שההזמנה כבר התקבלה. אפשר לשלוח אותה שוב: לא תיווצר הזמנה כפולה. אל תרעננו ואל תסגרו את הדף עד שנקבל אישור, כי לא הצלחנו לשמור את ההזמנה במכשיר.';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ATTEMPT_KEY = 'tamburia-checkout-attempt';
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
let unmountLast;

/** The hook next to the cart it reads from and writes to. */
function useHarness() {
  const cart = useSelector(selectCartItems);
  const deliveryMethod = useSelector(selectDeliveryMethod);
  const form = useCheckoutForm();
  return { cart, deliveryMethod, form, store: useStore() };
}

/** Renders the harness and fills the form. */
function setup({ method = 'delivery', fill = {} } = {}) {
  const store = createAppStore({
    cart: { items: CART, deliveryMethod: method },
    wishlist: { items: [] },
    availability: { unavailableIds: [], unavailableVariants: [], unavailableOptions: [] },
  });
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  const { result, unmount } = renderHook(() => useHarness(), { wrapper });
  unmountLast = unmount;
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
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/orders') return orderReply(url, options);
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
      request_id: expect.stringMatching(UUID_V4),
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

  test('the new prices are recorded as changes to acknowledge, and nothing is sent until they are', async () => {
    orderReply = () => reply(409, { error: 'מחירים התעדכנו', details: { prices: PRICES } });
    const result = setup();
    await place(result);
    expect(selectPendingPriceChanges(result.current.store.getState()).map((c) => [c.id, c.selectedVariant, c.from, c.to]))
      .toEqual([[1, "5 ל'", 100, 110], [1, "18 ל'", 300, 320], [2, null, 30, 35]]);

    orderReply = () => reply(201, SAVED);
    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.cart).toHaveLength(3);
  });

  test('a second attempt, after the customer acknowledged, sends the corrected prices', async () => {
    orderReply = () => reply(409, { error: 'מחירים התעדכנו', details: { prices: PRICES } });
    const result = setup();
    await place(result);
    act(() => { result.current.store.dispatch(acknowledgePriceChanges()); });

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

describe('409 — a product is out of stock', () => {
  const STOCK = {
    error: 'המוצר "מברשת" אינו זמין כרגע. ניתן להסיר אותו מהעגלה או ליצור קשר עם החנות לבירור זמינות.',
    details: { reason: 'out_of_stock', unavailable: [{ id: 2, selectedVariant: null, name: 'מברשת' }] },
  };

  test('shows the server message, keeps the cart, and checks the cart again so the line is blocked', async () => {
    orderReply = (url) => reply(409, STOCK);
    const base = global.fetch;
    const result = setup();
    global.fetch = jest.fn((url, options) => (String(url).startsWith('/api/products?ids=')
      ? reply(200, [
        { id: 1, price: 100, in_stock: true, variants: [{ label: "5 ל'", price: 100 }, { label: "18 ל'", price: 300 }] },
      ])
      : base(url, options)));

    await place(result);
    await act(async () => {});

    expect(result.current.form.orderError).toBe(STOCK.error);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.store.getState().availability.unavailableIds).toEqual([2]);
    expect(global.fetch).toHaveBeenCalledWith('/api/products?ids=1%2C2', expect.anything());
  });

  test('nothing is re-priced by an out-of-stock answer', async () => {
    orderReply = () => reply(409, STOCK);
    const result = setup();

    await place(result);

    expect(selectPendingPriceChanges(result.current.store.getState())).toEqual([]);
  });
});

describe('the blockers the cart step shows also stop the order itself', () => {
  test('a pending price change stops the submit before any request', async () => {
    const result = setup();
    act(() => { result.current.store.dispatch({ type: 'CART_REPRICED', prices: [{ id: 2, price: 35 }] }); });

    await place(result);

    expect(orderCalls()).toHaveLength(0);
    expect(result.current.form.submittingOrder).toBe(false);
  });

  test('after the acknowledgment the same submit goes through with the new price', async () => {
    const result = setup();
    act(() => { result.current.store.dispatch({ type: 'CART_REPRICED', prices: [{ id: 2, price: 35 }] }); });
    act(() => { result.current.store.dispatch(acknowledgePriceChanges()); });

    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(JSON.parse(orderCalls()[0][1].body).items.map((i) => i.price)).toEqual([100, 300, 35]);
  });

  test('a price that changes again after the acknowledgment blocks the submit again', async () => {
    const result = setup();
    act(() => { result.current.store.dispatch({ type: 'CART_REPRICED', prices: [{ id: 2, price: 35 }] }); });
    act(() => { result.current.store.dispatch(acknowledgePriceChanges()); });
    act(() => { result.current.store.dispatch({ type: 'CART_REPRICED', prices: [{ id: 2, price: 40 }] }); });

    await place(result);

    expect(orderCalls()).toHaveLength(0);
  });

  test.each([
    ['a blocked product', () => availabilityLoaded([2], [])],
    ['a blocked variant of a line in the cart', () => availabilityLoaded([], ["1:18 ל'"])],
  ])('%s stops the submit before any request', async (_label, action) => {
    const result = setup();
    act(() => { result.current.store.dispatch(action()); });

    await place(result);

    expect(orderCalls()).toHaveLength(0);
  });

  test('a blocked variant of another variant does not stop the order', async () => {
    const result = setup();
    act(() => { result.current.store.dispatch(availabilityLoaded([], ["1:99 ל'"])); });

    await place(result);

    expect(orderCalls()).toHaveLength(1);
  });
});

describe('409 — a colour or size the product no longer offers', () => {
  const OPTION = {
    error: 'האפשרות שנבחרה עבור "צבע לבן" אינה זמינה עוד. ניתן להסיר את המוצר מהעגלה ולהוסיף אותו מחדש.',
    details: { reason: 'option_unavailable', unavailable: [{ id: 1, selectedColor: 'לבן', name: 'צבע לבן' }] },
  };

  test('shows the server message, ends the attempt, and checks the cart again so the line is blocked', async () => {
    orderReply = () => reply(409, OPTION);
    const base = global.fetch;
    const result = setup();
    global.fetch = jest.fn((url, options) => (String(url).startsWith('/api/products?ids=')
      ? reply(200, [
        { id: 1, price: 100, in_stock: true, colors: [{ name: 'כחול', hex: '#00f' }], variants: [{ label: "5 ל'", price: 100 }, { label: "18 ל'", price: 300 }] },
        { id: 2, price: 30, in_stock: true },
      ])
      : base(url, options)));

    await place(result);
    await act(async () => {});

    expect(result.current.form.orderError).toBe(OPTION.error);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.store.getState().availability.unavailableOptions).toEqual(['1|לבן|']);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.form.pendingOrder).toBeNull();
  });
});

describe('4xx rejections — the server proves that no order was created', () => {
  test.each([
    ['a 400 shows the server message', 400, { error: 'הטלפון לא תקין' }, 'הטלפון לא תקין'],
    ['a 404 without a message shows the fallback', 404, {}, REJECTED],
    ['a blank message shows the fallback', 400, { error: '  ' }, REJECTED],
  ])('%s, keeps the cart and the form, and ends the attempt', async (_label, status, body, expected) => {
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
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('a new attempt clears the earlier error before it sends, with a new request id', async () => {
    orderReply = () => reply(400, { error: 'הטלפון לא תקין' });
    const result = setup();
    await place(result);
    expect(result.current.form.orderError).toBe('הטלפון לא תקין');
    const firstId = JSON.parse(orderCalls()[0][1].body).request_id;

    let settle;
    orderReply = () => new Promise((resolve) => { settle = resolve; });
    let pending;
    act(() => { pending = result.current.form.handlePlaceOrder(); });
    expect(result.current.form.orderError).toBe('');

    await act(async () => { settle({ ok: true, status: 201, json: async () => SAVED }); await pending; });
    expect(JSON.parse(orderCalls()[1][1].body).request_id).not.toBe(firstId);
  });
});

/** The order body of the n-th request. */
const sentBody = (n) => JSON.parse(orderCalls()[n][1].body);

/**
 * 429 — the rate limit. It refuses a request before looking at it, so unlike another 4xx it does not
 * prove that no order exists: the attempt is kept, byte for byte, and the customer sends it again by
 * hand later. Nothing here may retry by itself or make a new request_id.
 */
describe('429 — the rate limit refused the request', () => {
  const LIMITED = { error: 'יותר מדי הזמנות בזמן קצר (עוד 840 שניות)' };
  const HINT = 'אפשר לשלוח את אותה הזמנה שוב בעוד כמה דקות: לא תיווצר הזמנה כפולה.';
  const MESSAGE = `${LIMITED.error} ${HINT}`;

  test('keeps the attempt: the same request id and the exact body that was sent, stored unchanged', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();

    await place(result);

    const storedText = localStorage.getItem(ATTEMPT_KEY);
    expect(storedText).not.toBeNull();
    const stored = JSON.parse(storedText);
    expect(stored.requestId).toBe(sentBody(0).request_id);
    expect(stored.body).toEqual(sentBody(0));
    expect(Object.keys(stored).sort()).toEqual(['body', 'requestId', 'submittedAt']);
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: true, conflict: false });
  });

  test('shows the server message and the hint, and leaves the cart, the form and the success state alone', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(MESSAGE);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.deliveryMethod).toBe('delivery');
    expect(result.current.form.customerName).toBe('דנה כהן');
    expect(result.current.form.orderNotes).toBe('להתקשר לפני');
  });

  test('a 429 whose body is not the server\'s still gives an understandable message', async () => {
    orderReply = () => reply(429, undefined); // for example an answer from a proxy
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(`${REJECTED} ${HINT}`);
    expect(result.current.form.pendingOrder).not.toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).not.toBeNull();
  });

  test('sends nothing by itself afterwards, however long it waits', async () => {
    jest.useFakeTimers();
    try {
      orderReply = () => reply(429, LIMITED);
      const result = setup();

      await place(result);
      await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });

      expect(orderCalls()).toHaveLength(1);
      expect(result.current.form.pendingOrder).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('a new order cannot be started over it, and the request id is not replaced', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();
    await place(result);
    const stored = localStorage.getItem(ATTEMPT_KEY);

    orderReply = () => reply(201, SAVED);
    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBe(stored);
    expect(result.current.form.orderSuccess).toBeNull();
  });

  test('a later manual retry sends the same request id and the same body, and the answer settles it', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();
    await place(result);

    orderReply = () => reply(201, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
    expect(sentBody(1).request_id).toBe(sentBody(0).request_id);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.cart).toEqual([]);
  });

  test('a retry that is limited again keeps the very same attempt, once more', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();
    await place(result);
    const stored = localStorage.getItem(ATTEMPT_KEY);

    await act(async () => { await result.current.form.retryPendingOrder(); });
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(3);
    expect(orderCalls().map((c) => JSON.parse(c[1].body).request_id)).toEqual(Array(3).fill(sentBody(0).request_id));
    expect(new Set(orderCalls().map((c) => c[1].body)).size).toBe(1);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBe(stored);
    expect(result.current.form.orderError).toBe(MESSAGE);
  });

  test('after an unknown outcome, a limited retry keeps the attempt, and the replay that follows does not duplicate the order', async () => {
    // 1: the first send is lost (the order may have been saved). 2: the retry is limited.
    // 3: the retry later is answered with the original order, a replay (200), not a second order.
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    expect(result.current.form.orderError).toBe(UNCERTAIN);
    const stored = localStorage.getItem(ATTEMPT_KEY);

    orderReply = () => reply(429, LIMITED);
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(result.current.form.orderError).toBe(MESSAGE);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBe(stored);
    expect(result.current.form.pendingOrder).not.toBeNull();

    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(3);
    expect(new Set(orderCalls().map((c) => c[1].body)).size).toBe(1);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('after a reload the limited attempt is recovered and sent again as it was', async () => {
    orderReply = () => reply(429, LIMITED);
    const first = setup();
    await place(first);
    const original = sentBody(0);
    unmountLast();

    const result = setup();
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: true });

    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(sentBody(1)).toEqual(original);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('other 4xx answers on a retry still end the attempt (only 408 and 429 keep it)', async () => {
    orderReply = () => reply(429, LIMITED);
    const result = setup();
    await place(result);

    orderReply = () => reply(400, { error: 'הטלפון לא תקין' });
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(result.current.form.orderError).toBe('הטלפון לא תקין');
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });
});

describe('an order that may or may not have been created', () => {
  test.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 with a message', () => reply(500, { error: 'שגיאת שרת' })],
    ['a 502 whose body is not JSON', () => reply(502, undefined)],
    ['an OK answer whose body is not JSON', () => reply(201, undefined)],
    ['a 408 from a proxy', () => reply(408, { error: 'timeout' })],
  ])('%s: the unknown outcome is shown, the cart and the form stay, and the attempt is kept', async (_label, failing) => {
    orderReply = failing;
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(UNCERTAIN);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.form.submittingOrder).toBe(false);
    expect(result.current.cart).toEqual(CART);
    expect(result.current.form.customerName).toBe('דנה כהן');
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: true, conflict: false });
    const stored = JSON.parse(localStorage.getItem(ATTEMPT_KEY));
    expect(stored.requestId).toBe(sentBody(0).request_id);
    expect(stored.body).toEqual(sentBody(0));
  });

  test('a timeout after 20 seconds is an unknown outcome too, and the request is cut', async () => {
    jest.useFakeTimers();
    try {
      orderReply = (url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
      const result = setup();

      let pending;
      act(() => { pending = result.current.form.handlePlaceOrder(); });
      await act(async () => { jest.advanceTimersByTime(19_999); });
      expect(result.current.form.submittingOrder).toBe(true);
      await act(async () => { jest.advanceTimersByTime(1); await pending; });

      expect(orderCalls()[0][1].signal.aborted).toBe(true);
      expect(result.current.form.submittingOrder).toBe(false);
      expect(result.current.form.orderError).toBe(UNCERTAIN);
      expect(result.current.form.pendingOrder).not.toBeNull();
      expect(localStorage.getItem(ATTEMPT_KEY)).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('a new order cannot be sent while one is unresolved, however the cart changed', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    act(() => { result.current.store.dispatch({ type: 'CART_ITEM_REMOVED', index: 2 }); });
    orderReply = () => reply(201, SAVED);

    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.pendingOrder).not.toBeNull();
  });

  test('sending the original again sends the same body and request id, and the answer settles it', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);

    orderReply = () => reply(200, SAVED); // the server answers a retry with the original order
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.cart).toEqual([]);
    expect(result.current.form.customerName).toBe('');
    expect(result.current.form.cartKeptAfterOrder).toBe(false);
  });

  test('a retry that fails the same way keeps the attempt, and one the server refuses ends it', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(result.current.form.pendingOrder).not.toBeNull();
    expect(result.current.form.orderError).toBe(UNCERTAIN);

    orderReply = () => reply(409, { error: 'המחיר עודכן', details: { prices: [{ id: 2, selectedVariant: null, price: 35 }] } });
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.form.orderError).toBe('המחיר עודכן');
    expect(result.current.cart.map((i) => i.price)).toEqual([100, 300, 35]);
    expect(orderCalls().map((c) => JSON.parse(c[1].body).request_id)).toEqual(
      Array(3).fill(sentBody(0).request_id),
    );
  });

  test('the original is sent as it was, and a cart edited meanwhile is kept', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    act(() => { result.current.store.dispatch({ type: 'CART_QUANTITY_CHANGED', index: 0, delta: 3 }); });
    act(() => { result.current.form.setCustomerName('שם אחר'); });

    orderReply = () => reply(201, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(sentBody(1)).toEqual(sentBody(0));
    expect(sentBody(1).customer_name).toBe('דנה כהן');
    expect(sentBody(1).items[0].quantity).toBe(2);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.cart[0].quantity).toBe(5);
    expect(result.current.form.customerName).toBe('שם אחר');
    expect(result.current.form.cartKeptAfterOrder).toBe(true);
    expect(result.current.form.pendingOrder).toBeNull();

    act(() => { result.current.form.clearOrderSuccess(); });
    expect(result.current.form.cartKeptAfterOrder).toBe(false);
  });

  test('cancelling drops the attempt, and the next order gets a new request id', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    const firstId = sentBody(0).request_id;

    act(() => { result.current.form.cancelPendingOrder(); });
    expect(result.current.form.pendingOrder).toBeNull();
    expect(result.current.form.orderError).toBe('');
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();

    orderReply = () => reply(201, SAVED);
    await place(result);

    expect(orderCalls()).toHaveLength(2);
    expect(sentBody(1).request_id).toMatch(UUID_V4);
    expect(sentBody(1).request_id).not.toBe(firstId);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test('a request id is never reused for a new order after a success', async () => {
    const result = setup();
    await place(result);
    act(() => { result.current.form.clearOrderSuccess(); });
    act(() => {
      result.current.store.dispatch({ type: 'CART_ITEM_ADDED', product: { id: 2, name: 'מברשת', price: 30 }, quantity: 1 });
      result.current.store.dispatch({ type: 'DELIVERY_METHOD_SET', method: 'pickup' });
      result.current.form.setCustomerName('דנה כהן');
      result.current.form.setCustomerPhone('0501234567');
    });

    await place(result);

    expect(orderCalls()).toHaveLength(2);
    expect(sentBody(1).request_id).not.toBe(sentBody(0).request_id);
  });

  test('after a reload the unresolved order is recovered, sent again as it was, and settled', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const first = setup();
    await place(first);
    const original = sentBody(0);
    unmountLast();

    // a new page: a new store (the cart comes back from the preloaded state here) and new fields
    const result = setup();
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: true });

    await place(result);
    expect(orderCalls()).toHaveLength(1);

    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(2);
    expect(sentBody(1)).toEqual(original);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('an old unresolved order is never dropped because time passed', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const first = setup();
    await place(first);
    unmountLast();
    const stored = JSON.parse(localStorage.getItem(ATTEMPT_KEY));
    const longAgo = Date.now() - 90 * 24 * 3600 * 1000;
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ ...stored, submittedAt: longAgo }));

    const result = setup();

    expect(result.current.form.pendingOrder).not.toBeNull();
    expect(result.current.form.pendingOrder.submittedAt).toBe(longAgo);
  });

  test('an unresolved order stored by another tab after this page loaded still blocks a new one', async () => {
    const result = setup();
    const other = setup();
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    await place(other);
    orderReply = () => reply(201, SAVED);

    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.pendingOrder).not.toBeNull();
  });

  test('a server that holds a different order under the id (422) keeps the attempt and offers only cancelling', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);

    orderReply = () => reply(422, { error: 'מזהה הבקשה כבר שימש להזמנה אחרת', details: { reason: 'request_id_reused' } });
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(result.current.form.orderError).toBe('מזהה הבקשה כבר שימש להזמנה אחרת');
    expect(result.current.form.pendingOrder).toMatchObject({ conflict: true });
    expect(localStorage.getItem(ATTEMPT_KEY)).not.toBeNull();
    expect(result.current.form.orderSuccess).toBeNull();

    await act(async () => { await result.current.form.retryPendingOrder(); });
    await place(result);
    expect(orderCalls()).toHaveLength(2);

    act(() => { result.current.form.cancelPendingOrder(); });
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('a second click before the first has rendered sends once', async () => {
    let settle;
    orderReply = () => new Promise((resolve) => { settle = resolve; });
    const result = setup();

    let both;
    act(() => {
      both = Promise.all([result.current.form.handlePlaceOrder(), result.current.form.handlePlaceOrder()]);
    });
    expect(orderCalls()).toHaveLength(1);

    await act(async () => { settle({ ok: true, status: 201, json: async () => SAVED }); await both; });
    expect(orderCalls()).toHaveLength(1);
  });

  test('retrying while the request is in flight sends nothing more', async () => {
    let settle;
    orderReply = () => new Promise((resolve) => { settle = resolve; });
    const result = setup();

    let pending;
    act(() => { pending = result.current.form.handlePlaceOrder(); });
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(orderCalls()).toHaveLength(1);

    await act(async () => { settle({ ok: true, status: 201, json: async () => SAVED }); await pending; });
  });

  test('a stored value that is not a valid attempt is ignored', async () => {
    const junk = JSON.stringify({ requestId: 'not-a-uuid', body: { items: [] }, submittedAt: 1 });
    localStorage.setItem(ATTEMPT_KEY, junk);

    const result = setup();
    expect(result.current.form.pendingOrder).toBeNull();

    await place(result);
    expect(orderCalls()).toHaveLength(1);
    expect(sentBody(0).request_id).toMatch(UUID_V4);
  });

  test('stored data that cannot be parsed is ignored', async () => {
    localStorage.setItem(ATTEMPT_KEY, '{broken');
    const result = setup();
    expect(result.current.form.pendingOrder).toBeNull();
    await place(result);
    expect(orderCalls()).toHaveLength(1);
  });

  test('the stored attempt holds only the request id, the body that was sent, and the time', async () => {
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);

    const stored = JSON.parse(localStorage.getItem(ATTEMPT_KEY));
    expect(Object.keys(stored).sort()).toEqual(['body', 'requestId', 'submittedAt']);
  });

  test('the order details are not written to the console', async () => {
    const spies = ['log', 'warn', 'error', 'info'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    const printed = spies.flatMap((s) => s.mock.calls).flat().map(String).join(' ');
    spies.forEach((s) => s.mockRestore());
    expect(printed).not.toMatch(/דנה כהן|0501234567|dana@example\.com|הרצל/);
  });
});

describe('when localStorage cannot be used', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  test('a write that fails: the attempt lives in memory, and the message does not promise a reload is safe', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(UNCERTAIN_UNSAVED);
    expect(result.current.form.orderError).not.toMatch(/גם אחרי רענון/);
    expect(result.current.form.pendingOrder).toMatchObject({ persisted: false });

    // within this page the same order can still be sent again, with the same id
    jest.restoreAllMocks();
    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(sentBody(1)).toEqual(sentBody(0));
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test('a write that is accepted but not kept is detected by reading it back', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();

    await place(result);

    expect(result.current.form.orderError).toBe(UNCERTAIN_UNSAVED);
    expect(result.current.form.pendingOrder).toMatchObject({ persisted: false });
  });

  test('a read that throws means no stored attempt, and ordering still works', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const result = setup();

    expect(result.current.form.pendingOrder).toBeNull();
    await place(result);
    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test('removing the attempt after a success survives a blocked removeItem', async () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const result = setup();

    await place(result);

    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
  });

  /** Every localStorage call throws, as in a browser that blocks site data. */
  function blockStorage() {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
  }

  test('blocked storage, unknown outcome: the page keeps the original id and body, and sends exactly them again', async () => {
    blockStorage();
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();

    await place(result);
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: false });

    orderReply = () => reply(200, SAVED); // the server answers a replay with the original order
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
  });

  test('blocked storage: a new order cannot be started over the unresolved one, however often it is tried', async () => {
    blockStorage();
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    const first = JSON.parse(orderCalls()[0][1].body).request_id;
    orderReply = () => reply(201, SAVED);

    await place(result);
    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.pendingOrder).not.toBeNull();
    expect(result.current.form.orderSuccess).toBeNull();
    expect(first).toMatch(UUID_V4);
  });

  test('blocked storage, rate limited: the attempt stays in memory with its id, and the notice says a reload would lose it', async () => {
    blockStorage();
    orderReply = () => reply(429, { error: 'יותר מדי הזמנות בזמן קצר (עוד 60 שניות)' });
    const result = setup();

    await place(result);

    expect(result.current.form.pendingOrder).toMatchObject({ persisted: false, conflict: false });
    expect(orderCalls()).toHaveLength(1);

    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test('blocked storage: nothing is ever sent by itself, however long the page waits', async () => {
    jest.useFakeTimers();
    try {
      blockStorage();
      orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
      const result = setup();
      await place(result);
      const calls = global.fetch.mock.calls.length;

      await act(async () => { jest.advanceTimersByTime(10 * 24 * 60 * 60 * 1000); });

      expect(global.fetch.mock.calls.length).toBe(calls);
      // 48 hours on, the details are gone from memory too, and the order cannot be sent again
      expect(result.current.form.pendingOrder).toMatchObject({ expired: true, persisted: false });
      await act(async () => { await result.current.form.retryPendingOrder(); });
      expect(global.fetch.mock.calls.length).toBe(calls);
    } finally {
      jest.useRealTimers();
    }
  });

  test('storage that fails at first and works later: the resend stores the very same attempt', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = setup();
    await place(result);
    expect(result.current.form.pendingOrder).toMatchObject({ persisted: false });
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();

    setItem.mockRestore();
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(result.current.form.pendingOrder).toMatchObject({ persisted: true });
    const storedAttempt = JSON.parse(localStorage.getItem(ATTEMPT_KEY));
    expect(storedAttempt.requestId).toBe(JSON.parse(orderCalls()[0][1].body).request_id);
    expect(storedAttempt.body).toEqual(JSON.parse(orderCalls()[0][1].body));
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
  });

  test('a reload after a failed write has nothing to recover: the page is blank, and that is the case the warning is for', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const first = setup();
    await place(first);
    expect(first.current.form.orderError).toBe(UNCERTAIN_UNSAVED);
    unmountLast();

    const reloaded = setup();

    expect(reloaded.current.form.pendingOrder).toBeNull();
    expect(orderCalls()).toHaveLength(1); // opening the page sends nothing
  });
});

describe('the 48-hour retention of an unresolved order', () => {
  const T0 = Date.UTC(2026, 10, 14, 9, 0, 0);
  const HOUR = 60 * 60 * 1000;
  const PERSONAL = ['דנה כהן', '0501234567', 'dana@example.com', 'הרצל 1, חיפה', 'להתקשר לפני', 'צבע לבן', 'מברשת'];
  const EXPIRED_RECORD = (requestId) => ({ requestId, submittedAt: T0, expired: true, itemCount: 4, total: 550 });
  const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); });
  const stored = () => JSON.parse(localStorage.getItem(ATTEMPT_KEY));
  const noPersonalData = () => PERSONAL.forEach((value) => expect(localStorage.getItem(ATTEMPT_KEY)).not.toContain(value));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    orderReply = () => Promise.reject(new TypeError('Failed to fetch'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Places an order whose outcome is unknown, so an attempt is stored at T0. */
  async function placeUnknown() {
    const result = setup();
    await place(result);
    expect(stored()).toMatchObject({ submittedAt: T0 });
    return result;
  }

  test('at 47 hours the same body and request id are sent again, and the original time is stored', async () => {
    const result = await placeUnknown();
    await advance(47 * HOUR);
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, submittedAt: T0 });
    expect(result.current.form.pendingOrder.expired).toBeUndefined();

    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].body).toBe(orderCalls()[0][1].body);
    expect(stored()).toMatchObject({ requestId: sentBody(0).request_id, submittedAt: T0 });
    expect(stored().body).toEqual(sentBody(0));
    expect(result.current.form.pendingOrder.expired).toBeUndefined();
  });

  test('a retry does not move the clock: 48 hours after the FIRST send the details go, whatever the retries', async () => {
    const result = await placeUnknown();
    await advance(47 * HOUR);
    await act(async () => { await result.current.form.retryPendingOrder(); }); // fails again, at 47 h
    expect(stored().submittedAt).toBe(T0);

    await advance(HOUR - 1);
    expect(result.current.form.pendingOrder.expired).toBeUndefined();
    await advance(1);

    expect(result.current.form.pendingOrder).toMatchObject({ expired: true, submittedAt: T0 });
    expect(stored()).toEqual(EXPIRED_RECORD(sentBody(0).request_id));
    expect(orderCalls()).toHaveLength(2);
  });

  test('a successful retry at 47 hours settles it: one order, the attempt gone', async () => {
    const result = await placeUnknown();
    await advance(47 * HOUR);
    orderReply = () => reply(200, SAVED); // the server answers a replay with the original order

    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(sentBody(1)).toEqual(sentBody(0));
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.cart).toEqual([]);
  });

  test('at exactly 48 hours, with the page open, the details are removed and nothing is sent', async () => {
    const result = await placeUnknown();
    const requestId = sentBody(0).request_id;

    await advance(48 * HOUR - 1);
    expect(stored().body).toEqual(sentBody(0));
    await advance(1);

    expect(result.current.form.pendingOrder).toEqual({
      submittedAt: T0, itemCount: 4, total: 550, persisted: true, conflict: false, expired: true,
    });
    expect(stored()).toEqual(EXPIRED_RECORD(requestId));
    noPersonalData();
    expect(orderCalls()).toHaveLength(1);
  });

  test('after 49 hours the retry sends nothing, and neither does placing a new order', async () => {
    const result = await placeUnknown();
    await advance(49 * HOUR);
    orderReply = () => reply(201, SAVED);

    await act(async () => { await result.current.form.retryPendingOrder(); });
    await place(result);

    expect(orderCalls()).toHaveLength(1);
    expect(result.current.form.pendingOrder.expired).toBe(true);
    expect(result.current.form.orderSuccess).toBeNull();
    expect(result.current.cart).toEqual(CART);
  });

  test('no request of any kind is made by the passage of time, and no new request id is made', async () => {
    const result = await placeUnknown();
    const calls = global.fetch.mock.calls.length;

    await advance(30 * 24 * HOUR);
    await advance(30 * 24 * HOUR);

    expect(global.fetch.mock.calls.length).toBe(calls);
    expect(orderCalls()).toHaveLength(1);
    expect(stored().requestId).toBe(sentBody(0).request_id);
    expect(result.current.form.pendingOrder.expired).toBe(true);
  });

  test('after a reload past 48 hours the page shows the expired order, with the details already gone', async () => {
    await placeUnknown();
    const requestId = sentBody(0).request_id;
    unmountLast();
    jest.setSystemTime(T0 + 49 * HOUR); // the browser was closed meanwhile: no timer ran

    const result = setup();

    expect(result.current.form.pendingOrder).toMatchObject({ expired: true, itemCount: 4, total: 550, submittedAt: T0 });
    expect(stored()).toEqual(EXPIRED_RECORD(requestId));
    noPersonalData();
    await act(async () => { await result.current.form.retryPendingOrder(); });
    await place(result);
    expect(orderCalls()).toHaveLength(1);
  });

  test('after a reload within 48 hours the order is recovered and sent again as it was', async () => {
    await placeUnknown();
    const original = sentBody(0);
    unmountLast();
    jest.setSystemTime(T0 + 47 * HOUR);

    const result = setup();
    expect(result.current.form.pendingOrder).toMatchObject({ itemCount: 4, total: 550, persisted: true });
    orderReply = () => reply(200, SAVED);
    await act(async () => { await result.current.form.retryPendingOrder(); });

    expect(sentBody(1)).toEqual(original);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('a page that is reloaded again keeps the same expired record', async () => {
    await placeUnknown();
    unmountLast();
    jest.setSystemTime(T0 + 50 * HOUR);
    setup();
    const first = localStorage.getItem(ATTEMPT_KEY);
    unmountLast();
    jest.setSystemTime(T0 + 90 * HOUR);

    const result = setup();

    expect(localStorage.getItem(ATTEMPT_KEY)).toBe(first);
    expect(result.current.form.pendingOrder).toMatchObject({ expired: true, submittedAt: T0 });
  });

  test('time runs out while a resend is in flight: the answer decides, and if it is unknown the details go', async () => {
    const result = await placeUnknown();
    await advance(48 * HOUR - 1000);
    orderReply = (url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });

    let pending;
    act(() => { pending = result.current.form.retryPendingOrder(); });
    expect(result.current.form.submittingOrder).toBe(true);
    await advance(1000); // 48 h: the retention timer fires while the request is out
    expect(stored().body).toEqual(sentBody(0)); // the request in flight is not cut off from its attempt
    await act(async () => { jest.advanceTimersByTime(20_000); await pending; }); // the client timeout: unknown outcome

    expect(result.current.form.pendingOrder.expired).toBe(true);
    expect(stored()).toEqual(EXPIRED_RECORD(sentBody(0).request_id));
    noPersonalData();
    expect(orderCalls()).toHaveLength(2);
  });

  test('time runs out while a resend is in flight and the server confirms it: the order is simply done', async () => {
    const result = await placeUnknown();
    await advance(48 * HOUR - 1000);
    let answer;
    orderReply = () => new Promise((resolve) => { answer = resolve; });

    let pending;
    act(() => { pending = result.current.form.retryPendingOrder(); });
    await advance(1000);
    await act(async () => { answer({ ok: true, status: 200, json: async () => SAVED }); await pending; });

    expect(result.current.form.orderSuccess).toEqual(SAVED);
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
  });

  test('cancelling an expired order removes the record, and the next order has a NEW request id', async () => {
    const result = await placeUnknown();
    const first = sentBody(0).request_id;
    await advance(49 * HOUR);

    act(() => { result.current.form.cancelPendingOrder(); });
    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(orderCalls()).toHaveLength(1);

    orderReply = () => reply(201, SAVED);
    await place(result);

    expect(orderCalls()).toHaveLength(2);
    expect(sentBody(1).request_id).toMatch(UUID_V4);
    expect(sentBody(1).request_id).not.toBe(first);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test('a 429 that is kept expires like any other kept attempt, and a 4xx still ends it at once', async () => {
    orderReply = () => reply(429, { error: 'יותר מדי הזמנות בזמן קצר (עוד 60 שניות)' });
    const limited = setup();
    await place(limited);
    expect(stored()).toMatchObject({ submittedAt: T0 });
    await advance(48 * HOUR);
    expect(limited.current.form.pendingOrder.expired).toBe(true);
    unmountLast();
    localStorage.clear();

    orderReply = () => reply(400, { error: 'הטלפון לא תקין' });
    const refused = setup();
    await place(refused);
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(refused.current.form.pendingOrder).toBeNull();
  });

  test('a conflict (422) keeps its cancel-only state and expires like the others', async () => {
    orderReply = () => reply(422, { error: 'מזהה בשימוש', details: { reason: 'request_id_reused' } });
    const result = setup();
    await place(result);
    expect(result.current.form.pendingOrder.conflict).toBe(true);

    await advance(48 * HOUR);

    expect(result.current.form.pendingOrder.expired).toBe(true);
    expect(stored()).toEqual(EXPIRED_RECORD(sentBody(0).request_id));
    noPersonalData();
  });

  test.each([
    ['corrupted JSON', '{not json', null],
    ['a record without a valid request id', JSON.stringify({ requestId: 'x', body: {}, submittedAt: T0 }), null],
  ])('%s on load: removed, no notice, and ordering works', async (_label, text) => {
    localStorage.setItem(ATTEMPT_KEY, text);

    const result = setup();

    expect(result.current.form.pendingOrder).toBeNull();
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    orderReply = () => reply(201, SAVED);
    await place(result);
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });

  test.each([
    ['a record without a time', (a) => { const { submittedAt, ...rest } = a; return rest; }],
    ['a record whose time is not a number', (a) => ({ ...a, submittedAt: 'yesterday' })],
    ['a record older than 48 hours, written before this change', (a) => ({ ...a, submittedAt: T0 - 5 * 24 * HOUR })],
  ])('%s on load: the details are removed and the order cannot be sent again', async (_label, damage) => {
    await placeUnknown();
    const original = JSON.parse(localStorage.getItem(ATTEMPT_KEY));
    unmountLast();
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(damage(original)));

    const result = setup();

    expect(result.current.form.pendingOrder).toMatchObject({ expired: true, itemCount: 4, total: 550 });
    noPersonalData();
    await act(async () => { await result.current.form.retryPendingOrder(); });
    expect(orderCalls()).toHaveLength(1);
  });

  /** The ids of the timers set for a delay of more than 20 minutes (the retention timer; the request timeout is 20 s). */
  function retentionTimers(setSpy) {
    return setSpy.mock.calls
      .map(([, delay], i) => (delay > 20 * 60 * 1000 ? setSpy.mock.results[i].value : undefined))
      .filter((id) => id !== undefined);
  }

  test('the retention timer is set once for the attempt, and cleared when the component unmounts', async () => {
    const setSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const result = setup();
    await place(result);
    const timers = retentionTimers(setSpy);
    expect(timers.length).toBeGreaterThan(0);
    const clearedBefore = clearSpy.mock.calls.length;

    unmountLast();

    const lastTimer = timers[timers.length - 1];
    expect(clearSpy.mock.calls.slice(clearedBefore).map(([id]) => id)).toContain(lastTimer);
  });

  test('a successful order clears the retention timer and leaves no record behind', async () => {
    const setSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    orderReply = () => reply(201, SAVED);
    const result = setup();

    await place(result);

    const cleared = clearSpy.mock.calls.map(([id]) => id);
    retentionTimers(setSpy).forEach((id) => expect(cleared).toContain(id));
    expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
    expect(result.current.form.orderSuccess).toEqual(SAVED);
  });
});
