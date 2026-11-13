/**
 * Tests for the 401 handling in the `api` wrapper that Admin.js builds and hands to its hooks:
 * a 401 calls the current `onExpired`, and the very same response still reaches the hook, so
 * the message on screen is unchanged. Other answers never call it.
 *
 * These pin today's behavior so the admin API layer (P2) can be proven neutral. They go through
 * the rendered screen and the global fetch only: no hook or wrapper is imported.
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Admin from './Admin';

jest.mock('../../hooks/useWebSocket', () => ({ useWebSocket: () => {} }));

const ORDER = {
  id: 12,
  status: 'new',
  delivery_method: 'pickup',
  customer_name: 'דנה כהן',
  customer_phone: '0501234567',
  subtotal: 100,
  delivery_fee: 0,
  total: 100,
  created_at: '2026-10-04T08:00:00Z',
  items: [{ id: 1, name: 'צבע לבן', price: 100, quantity: 1 }],
  picked_items: [],
};

const STATUS_URL = '/api/orders/12/status';

/** A fetch response; a body of `undefined` is one that is not JSON. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

let statusReply;
let onExpired;

/** Renders the orders tab and waits for the order card to appear. */
async function renderAdmin(props = {}) {
  const view = render(
    <MemoryRouter>
      <Admin onBack={() => {}} onExpired={onExpired} tab="orders" onTabChange={() => {}} {...props} />
    </MemoryRouter>
  );
  await screen.findByRole('button', { name: /התחל טיפול/ });
  return view;
}

const clickStart = () => fireEvent.click(screen.getByRole('button', { name: /התחל טיפול/ }));

beforeEach(() => {
  onExpired = jest.fn();
  statusReply = () => reply(200, {});
  global.fetch = jest.fn((url) => {
    if (url === '/api/orders') return reply(200, [ORDER]);
    if (url === '/api/products?active=all') return reply(200, []);
    if (url === '/api/reviews/all') return reply(200, []);
    if (url === STATUS_URL) return statusReply();
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  delete global.fetch;
});

test('a 401 answer calls onExpired and the same server message is still shown', async () => {
  statusReply = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
  await renderAdmin();
  expect(onExpired).not.toHaveBeenCalled();

  clickStart();

  expect(await screen.findByText('נדרשת התחברות כמנהל')).toBeInTheDocument();
  expect(onExpired).toHaveBeenCalledTimes(1);
});

test('onExpired is called before the hook shows the message', async () => {
  statusReply = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
  const seenAtCall = [];
  onExpired = jest.fn(() => { seenAtCall.push(screen.queryByText('נדרשת התחברות כמנהל')); });
  await renderAdmin();

  clickStart();

  await screen.findByText('נדרשת התחברות כמנהל');
  expect(seenAtCall).toEqual([null]);
});

test.each([
  ['a 500 answer', 500, { error: 'שגיאת שרת' }, 'שגיאת שרת'],
  ['a 404 answer', 404, { error: 'הזמנה 12 לא נמצאה' }, 'הזמנה 12 לא נמצאה'],
  ['a 400 answer', 400, { error: 'סטטוס לא חוקי' }, 'סטטוס לא חוקי'],
])('%s does not call onExpired, and its message is shown', async (_label, status, body, message) => {
  statusReply = () => reply(status, body);
  await renderAdmin();

  clickStart();

  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(onExpired).not.toHaveBeenCalled();
});

test('a successful answer does not call onExpired', async () => {
  await renderAdmin();

  clickStart();

  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => url === STATUS_URL)).toBe(true));
  expect(onExpired).not.toHaveBeenCalled();
});

test('a network failure does not call onExpired', async () => {
  statusReply = () => Promise.reject(new TypeError('Failed to fetch'));
  await renderAdmin();

  clickStart();

  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => url === STATUS_URL)).toBe(true));
  expect(onExpired).not.toHaveBeenCalled();
});

test('a 401 on the first load calls onExpired once for each of the three loads', async () => {
  global.fetch = jest.fn(() => reply(401, { error: 'נדרשת התחברות כמנהל' }));

  render(
    <MemoryRouter>
      <Admin onBack={() => {}} onExpired={onExpired} tab="orders" onTabChange={() => {}} />
    </MemoryRouter>
  );

  await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(3));
  expect(global.fetch.mock.calls.map(([url]) => url).sort()).toEqual([
    '/api/orders', '/api/products?active=all', '/api/reviews/all',
  ]);
});

test('the latest onExpired is the one called after a re-render', async () => {
  statusReply = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
  const view = await renderAdmin();
  const latest = jest.fn();

  view.rerender(
    <MemoryRouter>
      <Admin onBack={() => {}} onExpired={latest} tab="orders" onTabChange={() => {}} />
    </MemoryRouter>
  );
  clickStart();

  await screen.findByText('נדרשת התחברות כמנהל');
  expect(latest).toHaveBeenCalledTimes(1);
  expect(onExpired).not.toHaveBeenCalled();
});
