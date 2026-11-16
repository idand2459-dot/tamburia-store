/**
 * Pins the storefront cart as the customer sees it, through the whole App: the cart drawer
 * (/cart), its quantity, remove and empty buttons, the delivery choice, the flag on a product
 * that is no longer in the catalog, the checkout fields surviving a close and reopen of the
 * drawer, and the menu drawer. They were written against the Context-based state and stay
 * unchanged when the cart, wishlist and availability move to the Redux store (P4R).
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// require.context exists only under webpack; CategoryPage.test.js stubs this module the same way.
jest.mock('../features/catalog/CategoryBanner', () => () => null);

const PAINT = { id: 1, name: 'צבע לבן', price: 100, quantity: 2, category: 'painting' };
const BRUSH = { id: 2, name: 'מברשת', price: 30, category: 'tools' };

/** A fetch response. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let catalogIds;
// What the catalog says about each product, besides its id: the price the seeded carts were saved
// with and in stock, unless a test overrides them (a new price, out of stock, other variants).
const CATALOG_PRICE = { 1: 100, 2: 30 };
let catalogOverrides;

/** Renders the whole app at a path. The catalog answers the availability request from catalogIds. */
async function renderAt(path = '/cart') {
  global.fetch = jest.fn((url) => {
    if (typeof url === 'string' && url.startsWith('/api/products?ids=')) {
      const asked = new URLSearchParams(url.split('?')[1]).get('ids').split(',').map(Number);
      const products = asked.filter((id) => catalogIds.includes(id)).map((id) => ({
        id, price: CATALOG_PRICE[id], in_stock: true, ...(catalogOverrides[id] || {}),
      }));
      return reply(200, { products, pagination: { total: products.length } });
    }
    if (typeof url === 'string' && url.startsWith('/api/')) return reply(200, []);
    throw new Error(`unexpected request: ${url}`);
  });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  await act(async () => {}); // let the first requests settle inside act
  return view;
}

const storedCart = () => JSON.parse(localStorage.getItem('tamburia-cart'));
const seedCart = (items) => localStorage.setItem('tamburia-cart', JSON.stringify(items));
const CART_DIALOG = { name: /העגלה שלי|פרטי הזמנה|אישור הזמנה/ };
const drawer = () => screen.getByRole('dialog', CART_DIALOG);
const summary = () => within(document.querySelector('.cart-summary'));
/** Clicks and lets the availability request that a cart change triggers settle inside act. */
const clickAndSettle = async (element) => {
  fireEvent.click(element);
  await act(async () => {});
};
const chooseDelivery = (name) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));

beforeEach(() => {
  localStorage.clear();
  catalogIds = [1, 2];
  catalogOverrides = {};
  // Not implemented in jsdom: the layout scrolls on navigation and the home page observes its sections.
  window.scrollTo = jest.fn();
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  delete global.fetch;
});

describe('the cart drawer', () => {
  test('shows the saved lines with their quantity and line total', async () => {
    seedCart([PAINT, BRUSH]);
    await renderAt();

    const rows = await within(drawer()).findAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('צבע לבן')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2')).toBeInTheDocument();
    expect(within(rows[1]).getByText('מברשת')).toBeInTheDocument();
  });

  test('the plus and minus buttons change the quantity and the stored cart', async () => {
    seedCart([PAINT]);
    await renderAt();
    await screen.findByText('צבע לבן');

    await clickAndSettle(screen.getByRole('button', { name: 'הוסף כמות' }));
    expect(within(drawer()).getByText('3')).toBeInTheDocument();
    expect(storedCart()[0].quantity).toBe(3);

    await clickAndSettle(screen.getByRole('button', { name: 'הפחת כמות' }));
    await clickAndSettle(screen.getByRole('button', { name: 'הפחת כמות' }));
    expect(within(drawer()).getByText('1')).toBeInTheDocument();
    expect(storedCart()[0].quantity).toBe(1);
  });

  test('decreasing the last unit removes the line', async () => {
    seedCart([{ ...BRUSH, quantity: 1 }, PAINT]);
    await renderAt();
    await screen.findByText('מברשת');

    await clickAndSettle(screen.getAllByRole('button', { name: 'הפחת כמות' })[0]);

    expect(screen.queryByText('מברשת')).not.toBeInTheDocument();
    expect(storedCart().map((i) => i.id)).toEqual([1]);
  });

  test('the remove button removes only that line', async () => {
    seedCart([PAINT, BRUSH]);
    await renderAt();
    await screen.findByText('מברשת');

    await clickAndSettle(screen.getByRole('button', { name: 'הסר: צבע לבן' }));

    expect(screen.queryByText('צבע לבן')).not.toBeInTheDocument();
    expect(screen.getByText('מברשת')).toBeInTheDocument();
    expect(storedCart().map((i) => i.id)).toEqual([2]);
  });

  test('"empty cart" clears the lines and the delivery choice, and stores an empty cart', async () => {
    seedCart([PAINT, BRUSH]);
    await renderAt();
    await screen.findByText('מברשת');
    chooseDelivery('משלוח');
    expect(screen.getByRole('radio', { name: /משלוח/ })).toBeChecked();

    await clickAndSettle(screen.getByRole('button', { name: 'רוקן עגלה' }));

    expect(screen.queryByText('מברשת')).not.toBeInTheDocument();
    expect(storedCart()).toEqual([]);
    expect(screen.queryByRole('radio', { name: /משלוח/ })).not.toBeInTheDocument();
  });

  test('the delivery choice adds the fee of 20 to the total, pickup is free, and it is not stored', async () => {
    seedCart([{ ...BRUSH, quantity: 2 }]);
    await renderAt();
    await screen.findByText('מברשת');
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
    expect(screen.getByText('בחר אופן קבלה לפני המשך')).toBeInTheDocument();

    chooseDelivery('משלוח');
    expect(summary().getByText('₪20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeEnabled();

    chooseDelivery('איסוף');
    expect(summary().getByText('חינם')).toBeInTheDocument();
    expect(summary().queryByText('₪20')).not.toBeInTheDocument();
    expect(localStorage.getItem('tamburia-delivery')).toBeNull();
    expect(storedCart()).toEqual([{ ...BRUSH, quantity: 2 }]);
  });

  test('a product that is no longer in the catalog is flagged and blocks the continue button', async () => {
    catalogIds = [1];
    seedCart([PAINT, BRUSH]);
    await renderAt();
    await screen.findByText('מברשת');
    chooseDelivery('איסוף');

    expect(await screen.findByText('לא זמין כרגע')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledWith('/api/products?ids=1%2C2', expect.anything());
  });

  test('an empty cart makes no availability request', async () => {
    await renderAt();
    await screen.findByRole('dialog', CART_DIALOG);

    expect(global.fetch.mock.calls.some(([url]) => String(url).startsWith('/api/products?ids='))).toBe(false);
  });

  test('the cart count shows on the navbar button', async () => {
    seedCart([PAINT, BRUSH]);
    await renderAt('/');

    expect(await screen.findByRole('button', { name: 'עגלת קניות — 3 פריטים' })).toBeInTheDocument();
  });
});

describe('the checkout fields', () => {
  /** Opens the cart with a saved line, picks pickup and goes to the details step. */
  async function goToDetails() {
    seedCart([PAINT]);
    await renderAt();
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');
    fireEvent.click(screen.getByRole('button', { name: /המשך לפרטים/ }));
    return screen.findByLabelText(/שם מלא/);
  }

  test('survive closing and reopening the cart drawer', async () => {
    const nameField = await goToDetails();
    fireEvent.change(nameField, { target: { value: 'דנה כהן' } });
    fireEvent.change(screen.getByLabelText(/טלפון/), { target: { value: '0501234567' } });

    // Closing from the details step goes back one history entry (to the cart step), closing again leaves.
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    await screen.findByRole('button', { name: /המשך לפרטים/ });
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    await waitFor(() => expect(screen.queryByRole('dialog', CART_DIALOG)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /עגלת קניות/ }));
    await screen.findByText('צבע לבן');
    fireEvent.click(screen.getByRole('button', { name: /המשך לפרטים/ }));

    expect(await screen.findByLabelText(/שם מלא/)).toHaveValue('דנה כהן');
    expect(screen.getByLabelText(/טלפון/)).toHaveValue('0501234567');
  });

  test('keep what was typed when going back to the cart step and forward again', async () => {
    const nameField = await goToDetails();
    fireEvent.change(nameField, { target: { value: 'דנה כהן' } });

    fireEvent.click(screen.getByRole('button', { name: /חזרה לעגלה|חזור/ }));
    await screen.findByText('צבע לבן');
    fireEvent.click(screen.getByRole('button', { name: /המשך לפרטים/ }));

    expect(await screen.findByLabelText(/שם מלא/)).toHaveValue('דנה כהן');
  });
});

describe('the menu drawer', () => {
  test('opening the menu marks the page as having a drawer, closing it removes the mark', async () => {
    await renderAt('/');

    fireEvent.click(await screen.findByRole('button', { name: 'פתח תפריט' }));
    expect(document.body).toHaveClass('has-drawer');

    fireEvent.click(screen.getByRole('button', { name: 'סגור תפריט' }));
    expect(document.body).not.toHaveClass('has-drawer');
  });
});

describe('the cart stays fresh', () => {
  const availabilityCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).startsWith('/api/products?ids=')).length;
  const alertText = () => screen.getByRole('alert').textContent;
  const showTab = (visible) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  afterEach(() => {
    delete document.visibilityState;
  });

  test('the first load asks once: restoring the cart does not loop', async () => {
    seedCart([PAINT, BRUSH]);
    await renderAt();
    await screen.findByText('מברשת');
    await act(async () => {});

    expect(availabilityCalls()).toBe(1);
  });

  test('a restored price that is out of date is replaced and shown with the old and the new price', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    await renderAt();
    await screen.findByText('צבע לבן');

    expect(alertText()).toContain('צבע לבן');
    expect(alertText()).toContain('₪80');
    expect(alertText()).toContain('₪100');
    expect(storedCart()[0].price).toBe(100);
    expect(JSON.parse(localStorage.getItem('tamburia-cart-price-changes'))).toHaveLength(1);
  });

  test('continuing is blocked until the customer acknowledges, and then it works', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    await renderAt();
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');

    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
    expect(screen.getByText(/אשרו את שינויי המחיר/)).toBeInTheDocument();

    await clickAndSettle(screen.getByRole('button', { name: /הבנתי/ }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem('tamburia-cart-price-changes'))).toEqual([]);
  });

  test('a price that is already up to date asks for nothing', async () => {
    seedCart([PAINT]);
    await renderAt();
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeEnabled();
  });

  test('opening /checkout directly cannot skip the acknowledgment: the order cannot be sent', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    await renderAt('/checkout');
    await screen.findByLabelText(/שם מלא/);

    expect(alertText()).toContain('₪100');
    expect(screen.getByRole('button', { name: /שלח הזמנה/ })).toBeDisabled();

    await clickAndSettle(screen.getByRole('button', { name: /הבנתי/ }));

    expect(screen.getByRole('button', { name: /שלח הזמנה/ })).toBeEnabled();
  });

  test('a reload before acknowledging does not lose the pending change', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    const first = await renderAt();
    await screen.findByText('צבע לבן');
    first.unmount();

    // The cart now holds the catalog price, so the fresh check finds nothing new to say: the
    // pending change can only come from what was stored.
    await renderAt('/checkout');
    await screen.findByLabelText(/שם מלא/);

    expect(alertText()).toContain('₪80');
    expect(screen.getByRole('button', { name: /שלח הזמנה/ })).toBeDisabled();
  });

  test('the acknowledgment stays valid when moving between the cart and the checkout', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    await renderAt();
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');
    await clickAndSettle(screen.getByRole('button', { name: /הבנתי/ }));

    await clickAndSettle(screen.getByRole('button', { name: /המשך לפרטים/ }));
    await screen.findByLabelText(/שם מלא/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /שלח הזמנה/ })).toBeEnabled();

    await clickAndSettle(screen.getByRole('button', { name: /חזרה לעגלה/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('entering the checkout checks the cart again', async () => {
    seedCart([PAINT]);
    await renderAt();
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');
    const before = availabilityCalls();

    await clickAndSettle(screen.getByRole('button', { name: /המשך לפרטים/ }));

    expect(availabilityCalls()).toBe(before + 1);
  });

  test('coming back to the tab checks again, and a new price needs a new acknowledgment', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    await renderAt();
    await screen.findByText('צבע לבן');
    await clickAndSettle(screen.getByRole('button', { name: /הבנתי/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const before = availabilityCalls();

    catalogOverrides = { 1: { price: 120 } };
    await act(async () => { showTab(true); });

    expect(availabilityCalls()).toBe(before + 1);
    expect(alertText()).toContain('₪100');
    expect(alertText()).toContain('₪120');
    chooseDelivery('איסוף');
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
  });

  test('hiding the tab does not ask', async () => {
    seedCart([PAINT]);
    await renderAt();
    await screen.findByText('צבע לבן');
    const before = availabilityCalls();

    await act(async () => { showTab(false); });

    expect(availabilityCalls()).toBe(before);
  });

  test('a product that sold out is flagged and blocks continuing, with the price left alone', async () => {
    catalogOverrides = { 2: { in_stock: false } };
    seedCart([PAINT, BRUSH]);
    await renderAt();
    await screen.findByText('מברשת');
    chooseDelivery('איסוף');

    expect(await screen.findByText('לא זמין כרגע')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a variant that no longer exists blocks only its own line', async () => {
    catalogOverrides = { 1: { variants: [{ label: "5 ל'", price: 100 }] } };
    const five = { ...PAINT, quantity: 1, selectedVariant: "5 ל'" };
    const eighteen = { ...PAINT, quantity: 1, price: 300, selectedVariant: "18 ל'" };
    seedCart([five, eighteen]);
    await renderAt();

    const rows = await within(drawer()).findAllByRole('listitem');
    await waitFor(() => expect(rows[1]).toHaveClass('is-unavailable'));
    expect(rows[0]).not.toHaveClass('is-unavailable');
    chooseDelivery('איסוף');
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeDisabled();
  });

  test('tampered pending-change records cannot crash the cart: they are ignored and the cart renders', async () => {
    seedCart([PAINT]);
    localStorage.setItem('tamburia-cart-price-changes', JSON.stringify([
      { id: 1, selectedVariant: null, name: { a: 1 }, from: 1, to: 2 },
      { id: 1, selectedVariant: { x: 1 }, name: 'צבע', from: 1, to: 2 },
      'junk', null, 7,
    ]));
    await renderAt();

    expect(await screen.findByText('צבע לבן')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    chooseDelivery('איסוף');
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeEnabled();
  });

  test('removing a line in the drawer drops its pending change from storage and the screen', async () => {
    seedCart([{ ...PAINT, price: 80 }, BRUSH]);
    await renderAt();
    await screen.findByText('צבע לבן');
    expect(alertText()).toContain('צבע לבן');
    expect(JSON.parse(localStorage.getItem('tamburia-cart-price-changes'))).toHaveLength(1);

    await clickAndSettle(screen.getByRole('button', { name: 'הסר: צבע לבן' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('tamburia-cart-price-changes'))).toEqual([]);
  });

  test('a network failure during the check changes nothing and blocks nothing', async () => {
    seedCart([{ ...PAINT, price: 80 }]);
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    render(
      <MemoryRouter initialEntries={['/cart']}>
        <App />
      </MemoryRouter>
    );
    await act(async () => {});
    await screen.findByText('צבע לבן');
    chooseDelivery('איסוף');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(storedCart()[0].price).toBe(80);
    expect(screen.getByRole('button', { name: /המשך לפרטים/ })).toBeEnabled();
  });
});
