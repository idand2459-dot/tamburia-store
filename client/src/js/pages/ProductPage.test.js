/**
 * בדיקות למרוץ שבין שני מוצרים בעמוד המוצר.
 *
 * הכרטיסים שבתחתית העמוד הם קישורים למוצרים אחרים, ולחיצה עליהם
 * מחליפה את ה-prod בלי לפרק את הרכיב. לכן מעבר מהיר בין שני מוצרים
 * הוא הניווט הרגיל כאן ולא מקרה קצה: שתי השליפות של המוצר הראשון
 * עדיין באוויר כשהשני כבר מוצג, ובלי ביטול התשובה האיטית שלהן הייתה
 * נוחתת על העמוד של השני.
 *
 * הבדיקות מדמות בדיוק את הרצף הזה — מוצר א', מעבר למוצר ב', ורק אז
 * תשובות שתי הבקשות של א'.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductPage from './ProductPage';
import { StoreContext } from '../context/storeContext';

const STORE = {
  addToCart: () => {},
  wishlistIds: [],
  toggleCardWishlist: () => {},
};

const PRODUCT_A = { id: 1, name: 'מברשת א', price: 10, category: 'painting', in_stock: true };
const PRODUCT_B = { id: 2, name: 'מברשת ב', price: 20, category: 'tools', in_stock: true };

/**
 * בקשה תלויה שנפתרת רק כשאומרים לה — כדי לשלוט בסדר הנחיתה.
 *
 * היא מכבדת את ה-signal בדיוק כמו fetch אמיתי: ביטול דוחה אותה
 * ב-AbortError. בלי זה המוק היה נפתר גם אחרי ביטול, והבדיקה הייתה
 * מודדת משהו שלא קיים בדפדפן.
 */
function pendingRequest() {
  let resolve;
  const start = (url, { signal }) => new Promise((res, rej) => {
    resolve = res;
    signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
  });
  return { start, resolve: (value) => resolve(value) };
}

/** תשובת fetch מוכנה. */
const respond = (body) => ({ ok: true, status: 200, json: async () => body });

/** עוטף את עמוד המוצר בראוטר ובהקשר החנות. */
function renderPage(product) {
  return render(
    <MemoryRouter>
      <StoreContext.Provider value={STORE}>
        <ProductPage product={product} onAddToCart={() => {}} />
      </StoreContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => { localStorage.clear(); global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

test('תשובה מאוחרת של המוצר הקודם אינה נוחתת על המוצר הנוכחי', async () => {
  const slowRelated = pendingRequest();
  const slowReviews = pendingRequest();

  // המוצר הראשון: שתי בקשות שנתקעות. השני: תשובות מיידיות.
  global.fetch
    .mockImplementationOnce(slowRelated.start)
    .mockImplementationOnce(slowReviews.start)
    .mockImplementation((url) => Promise.resolve(
      url.startsWith('/api/reviews')
        ? respond([{ id: 90, reviewer_name: 'דנה', rating: 5, text: 'מעולה', created_at: '2026-01-01' }])
        : respond([{ id: 30, name: 'שייך למוצר ב', price: 7, category: 'tools' }]),
    ));

  const { rerender } = renderPage(PRODUCT_A);

  // מעבר מהיר למוצר ב', בזמן ששתי הבקשות של א' עדיין באוויר.
  rerender(
    <MemoryRouter>
      <StoreContext.Provider value={STORE}>
        <ProductPage product={PRODUCT_B} onAddToCart={() => {}} />
      </StoreContext.Provider>
    </MemoryRouter>,
  );

  expect(await screen.findByText('שייך למוצר ב')).toBeDefined();

  // ורק עכשיו נוחתות התשובות של א'. הביטול כבר ניתק אותן.
  //
  // ה-setTimeout אינו קישוט: בלעדיו ההמתנה נגמרת לפני שהשרשרת של
  // השירות (fetch ואז res.json) הספיקה להתנקז, והבדיקה הייתה עוברת
  // גם בלי הביטול — כלומר לא בודקת כלום. מחזור מאקרו אחד מרוקן את
  // כל תורי המיקרו שנותרו.
  await act(async () => {
    slowRelated.resolve(respond([{ id: 40, name: 'שייך למוצר א', price: 5, category: 'painting' }]));
    slowReviews.resolve(respond([{ id: 91, reviewer_name: 'יוסי', rating: 1, text: 'של מוצר א', created_at: '2026-01-01' }]));
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(screen.queryByText('שייך למוצר א')).toBeNull();
  expect(screen.queryByText('של מוצר א')).toBeNull();
  expect(screen.getByText('שייך למוצר ב')).toBeDefined();
  expect(screen.getByText('מעולה')).toBeDefined();
});

test('שתי הבקשות מקבלות signal, ומבוטלות בפירוק הרכיב', async () => {
  global.fetch.mockResolvedValue(respond([]));

  const { unmount } = renderPage(PRODUCT_A);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

  const signals = global.fetch.mock.calls.map(([, options]) => options.signal);
  expect(signals.every(Boolean)).toBe(true);
  expect(signals.every((s) => s.aborted === false)).toBe(true);

  unmount();
  expect(signals.every((s) => s.aborted === true)).toBe(true);
});

test('המעבר מרוקן מיד את הביקורות ואת המוצרים הקשורים של הקודם', async () => {
  global.fetch.mockImplementation((url) => Promise.resolve(
    url.startsWith('/api/reviews')
      ? respond([{ id: 92, reviewer_name: 'דנה', rating: 5, text: 'ביקורת של א', created_at: '2026-01-01' }])
      : respond([{ id: 41, name: 'קשור למוצר א', price: 5, category: 'painting' }]),
  ));

  const { rerender } = renderPage(PRODUCT_A);
  expect(await screen.findByText('קשור למוצר א')).toBeDefined();
  expect(screen.getByText('ביקורת של א')).toBeDefined();

  // מכאן ואילך השרת לא עונה בכלל, כך שמה שיוצג הוא מה שנשאר ב-state.
  global.fetch.mockImplementation(() => new Promise(() => {}));

  rerender(
    <MemoryRouter>
      <StoreContext.Provider value={STORE}>
        <ProductPage product={PRODUCT_B} onAddToCart={() => {}} />
      </StoreContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.queryByText('קשור למוצר א')).toBeNull());
  expect(screen.queryByText('ביקורת של א')).toBeNull();
});
