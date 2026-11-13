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

jest.mock('../hooks/useWebSocket', () => ({ useWebSocket: () => {} }));
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

/** Renders the whole app at a path. The catalog answers the availability request from catalogIds. */
async function renderAt(path = '/cart') {
  global.fetch = jest.fn((url) => {
    if (typeof url === 'string' && url.startsWith('/api/products?ids=')) {
      const asked = new URLSearchParams(url.split('?')[1]).get('ids').split(',').map(Number);
      const products = asked.filter((id) => catalogIds.includes(id)).map((id) => ({ id }));
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
