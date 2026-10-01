/**
 * בדיקות לסינון של לשונית המוצרים מול כתובת שהתיישנה.
 *
 * הסינון יושב בכתובת (?category=…&q=…), ולכן הוא שורד רענון — וגם
 * שינויים בקטלוג. התקלה שהבדיקות האלה משחזרות: כל מוצרי הגינה נמחקו,
 * בכתובת נשארו category=garden ו-q מחיפוש של הבוקר, והרשימה "נתקעה" על
 * מוצר גינה מוסתר. לחיצה על שבב אחר סימנה אותו ושינתה את הכתובת, אבל
 * החיפוש עקף את הסינון והרשימה לא זזה.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProductsTab from './ProductsTab';

/* קטלוג אחרי שמוצרי הגינה הגלויים נמחקו: נשאר רק מוצר גינה מוסתר. */
const PRODUCTS = [
  { id: 1, name: 'דבק מגע', price: 30, category: 'adhesives', active: true, in_stock: true },
  { id: 2, name: 'סיליקון', price: 25, category: 'adhesives', active: true, in_stock: true },
  { id: 3, name: 'מפסק', price: 15, category: 'electrical', active: true, in_stock: true },
  { id: 4, name: 'מזמרת גינה ישנה', price: 40, category: 'garden', active: false, in_stock: true },
];

/** הכתובת הנוכחית, כדי לבדוק מה נשאר בה אחרי כל פעולה. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{decodeURIComponent(location.search)}</output>;
}

/** מרנדר את הלשונית בכתובת נתונה. */
function renderAt(search, props = {}) {
  const noop = () => {};
  const ui = (extra) => (
    <MemoryRouter initialEntries={[`/admin/products${search}`]}>
      <Routes>
        <Route path="/admin/products" element={(
          <>
            <ProductsTab
              products={PRODUCTS} productsLoaded
              onEdit={noop} onDelete={noop} onToggleStock={noop} onToggleActive={noop}
              onUpdatePrice={noop} productsError="" scrollToId={null} onScrolled={noop}
              {...props} {...extra}
            />
            <LocationProbe />
          </>
        )} />
      </Routes>
    </MemoryRouter>
  );
  const utils = render(ui());
  return { ...utils, rerenderWith: (extra) => utils.rerender(ui(extra)) };
}

const listed = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const chip = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const search = () => screen.getByTestId('search').textContent;

test('קטגוריה שהתרוקנה בכתובת חוזרת בשקט ל"הכל"', () => {
  renderAt('?category=garden');
  expect(listed()).toEqual(['דבק מגע', 'סיליקון', 'מפסק']);
  expect(chip('הכל')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: /^גינה/ })).toBeNull();
  expect(search()).toBe('');
});

test('ערך לא מוכר בכתובת חוזר ל"הכל"', () => {
  renderAt('?category=nonsense');
  expect(listed()).toHaveLength(3);
  expect(chip('הכל')).toHaveAttribute('aria-pressed', 'true');
  expect(search()).toBe('');
});

test('המקרה שדווח: חיפוש ישן בכתובת לא תוקע את השבבים', () => {
  renderAt('?category=garden&q=גינה');
  // החיפוש מוצא את מוצר הגינה המוסתר, ואף שבב אינו מסומן בזמן חיפוש
  expect(listed()).toEqual(['מזמרת גינה ישנה']);
  expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);

  fireEvent.click(chip('דבקים'));
  expect(listed()).toEqual(['דבק מגע', 'סיליקון']);
  expect(chip('דבקים')).toHaveAttribute('aria-pressed', 'true');
  expect(search()).toBe('?category=adhesives');

  fireEvent.click(chip('מוצרי חשמל'));
  expect(listed()).toEqual(['מפסק']);

  fireEvent.click(chip('הכל'));
  expect(listed()).toHaveLength(3);
  expect(search()).toBe('');
});

test('לפני שהרשימה נטענה, קטגוריה בכתובת אינה מאופסת', () => {
  const view = renderAt('?category=adhesives', { products: [], productsLoaded: false });
  expect(search()).toBe('?category=adhesives');

  view.rerenderWith({ products: PRODUCTS, productsLoaded: true });
  expect(listed()).toEqual(['דבק מגע', 'סיליקון']);
  expect(chip('דבקים')).toHaveAttribute('aria-pressed', 'true');
});

test('"מוסתרים" ריק נשאר פעיל, עם ההודעה שלו', () => {
  renderAt('?category=hidden', { products: PRODUCTS.filter((p) => p.active) });
  expect(chip('מוסתרים')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('כל המוצרים מוצגים בחנות')).toBeInTheDocument();
  expect(search()).toBe('?category=hidden');
});
