/**
 * The public order lookup was removed (P8.2): /orders/lookup is an ordinary not-found page, no
 * navigation offers "ההזמנות שלי", and nothing ever asks the API for orders by phone number.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// require.context exists only under webpack; App.test.js stubs this module the same way.
jest.mock('../features/catalog/CategoryBanner', () => () => null);

/** Renders the whole app at a path with a fake fetch that answers every API call with an empty list. */
function renderAt(path) {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => { localStorage.clear(); window.scrollTo = jest.fn(); });
afterEach(() => { delete global.fetch; });

test('/orders/lookup shows the normal 404 page', async () => {
  renderAt('/orders/lookup');

  expect(await screen.findByRole('heading', { name: 'העמוד לא נמצא' })).toBeInTheDocument();
  expect(screen.queryByText('ההזמנות שלי')).toBeNull();
});

test('the store navigation has no order lookup link, and no lookup request is made', async () => {
  const { container } = renderAt('/contact');

  await screen.findByRole('button', { name: 'פתח תפריט', hidden: true });
  expect(container.textContent).not.toContain('ההזמנות שלי');
  expect(container.querySelector('.navbar-link--orders')).toBeNull();
  const urls = global.fetch.mock.calls.map(([url]) => String(url));
  expect(urls.some((url) => url.includes('by-phone'))).toBe(false);
});
