/**
 * בדיקות לסרגל תתי-הקטגוריות בעמוד הקטגוריה.
 *
 * המוצרים הועלו בלי תת-קטגוריה, וכל תת-קטגוריה בסרגל הראתה 0 — כפתורים
 * שמובילים לרשת ריקה. עכשיו תת-קטגוריה ריקה אינה מוצגת, ו-?sub= שמצביע
 * על אחת כזו חוזר בשקט ל"הכל".
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CategoryView from './CategoryView';
import { StoreContext } from '../../context/storeContext';

/* הבאנר טוען את תמונות הקטגוריות דרך require.context של webpack, שאין
   ב-Jest. הוא לא חלק ממה שנבדק כאן. */
jest.mock('./CategoryBanner', () => () => null);

const STORE = { addToCart: () => {}, wishlistIds: [], toggleCardWishlist: () => {} };

/* מוצרי צביעה: שניים ברולרים, אחד בצבעים, ואחד בלי תת-קטגוריה. */
const PRODUCTS = [
  { id: 1, name: 'רולר 9"', price: 20, category: 'painting', subcategory: 'rollers_pads', in_stock: true },
  { id: 2, name: 'רולר מיני', price: 12, category: 'painting', subcategory: 'rollers_pads', in_stock: true },
  { id: 3, name: 'צבע לבן', price: 90, category: 'painting', subcategory: 'paints', in_stock: true },
  { id: 4, name: 'מגש', price: 15, category: 'painting', subcategory: null, in_stock: true },
];

/** הכתובת הנוכחית, כדי לבדוק מה נשאר ב-?sub=. */
function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

/** מרנדר את עמוד הקטגוריה בכתובת נתונה. */
function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <StoreContext.Provider value={STORE}>
        <Routes>
          <Route path="/category/:slug" element={<><CategoryView /><LocationProbe /></>} />
        </Routes>
      </StoreContext.Provider>
    </MemoryRouter>,
  );
}

const sidebar = () => screen.getByRole('navigation', { name: 'תתי-קטגוריות' });
const sidebarItems = () => within(sidebar()).getAllByRole('button').map((b) => b.querySelector('span').textContent);

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => PRODUCTS }));
  // ProductList ו-CategoryBanner משתמשים בו לאנימציית הכניסה; ל-jsdom אין
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { delete global.fetch; delete global.IntersectionObserver; });

test('תת-קטגוריות בלי מוצרים אינן מוצגות, ו"הכל" תמיד מוצג', async () => {
  renderAt('/category/painting');
  await waitFor(() => expect(screen.getByText('צבע לבן')).toBeInTheDocument());
  expect(sidebarItems()).toEqual(['הכל', 'רולרים ורפידות', 'צבעים']);
});

test('?sub= של תת-קטגוריה ריקה חוזר בשקט ל"הכל"', async () => {
  renderAt('/category/painting?sub=spray');
  await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
  // כל ארבעת המוצרים, ו"הכל" מסומן
  for (const name of ['רולר 9"', 'רולר מיני', 'צבע לבן', 'מגש']) {
    expect(screen.getByText(name)).toBeInTheDocument();
  }
  expect(within(sidebar()).getByRole('button', { name: /^הכל/ })).toHaveAttribute('aria-current', 'true');
});

test('?sub= של תת-קטגוריה לא קיימת חוזר ל"הכל"', async () => {
  renderAt('/category/painting?sub=no_such_sub');
  await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
  expect(screen.getByText('מגש')).toBeInTheDocument();
});

test('?sub= של תת-קטגוריה עם מוצרים נשאר ומסנן', async () => {
  renderAt('/category/painting?sub=rollers_pads');
  await waitFor(() => expect(screen.getByText('רולר מיני')).toBeInTheDocument());
  expect(screen.getByTestId('search').textContent).toBe('?sub=rollers_pads');
  expect(screen.queryByText('צבע לבן')).toBeNull();
});
