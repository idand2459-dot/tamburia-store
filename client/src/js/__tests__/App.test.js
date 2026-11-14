/**
 * Pins the admin entry as App.js wires it today: /admin redirects to the orders tab, the admin
 * code loads lazily behind the session check, a visitor without a session sees the login form
 * and nothing else is requested, and a logged-in admin gets the admin screen.
 *
 * These cover the "lazy admin chunk" and "/admin redirects and logs in" behaviors that the plan
 * lists for P4 and that no other test reached. The store routes are covered by their own page
 * tests.
 *
 * Run with `npm run test:client` from the root.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// require.context exists only under webpack; CategoryPage.test.js stubs this module the same way.
jest.mock('../features/catalog/CategoryBanner', () => () => null);

/** A fetch response. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** Renders the whole app at a path, with a fake fetch and the given session answer. */
function renderAt(path, sessionStatus) {
  global.fetch = jest.fn((url) => {
    if (url === '/api/auth/me') return reply(sessionStatus, {});
    if (typeof url === 'string' && url.startsWith('/api/')) return reply(200, []);
    throw new Error(`unexpected request: ${url}`);
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

const requestedUrls = () => global.fetch.mock.calls.map(([url]) => url);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete global.fetch;
});

test.each([
  ['/admin'],
  ['/admin/orders'],
  ['/admin/not-a-tab'],
])('%s without a session shows the login form', async (path) => {
  renderAt(path, 401);

  expect(await screen.findByRole('heading', { name: 'כניסה לניהול' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('סיסמה')).toBeInTheDocument();
});

test('without a session nothing but the session check is requested, so no admin data is fetched', async () => {
  renderAt('/admin/orders', 401);

  await screen.findByRole('heading', { name: 'כניסה לניהול' });

  expect(requestedUrls()).toEqual(['/api/auth/me']);
});

test.each([
  ['/admin'],
  ['/admin/orders'],
])('%s with a session shows the admin screen and loads the orders, products and reviews', async (path) => {
  renderAt(path, 200);

  expect(await screen.findByRole('heading', { name: 'ניהול טכניק טמבור' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'כניסה לניהול' })).not.toBeInTheDocument();
  expect(requestedUrls()).toEqual(expect.arrayContaining([
    '/api/auth/me', '/api/orders', '/api/products?active=all', '/api/reviews/all',
  ]));
});
