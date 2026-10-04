/**
 * בדיקות לרשימת הליקוט בכרטיס ההזמנה: לחיצה על שורה, ההתקדמות בכרטיס
 * הסגור, ההדגשה כשהכול הוכן, התמונות, וההודעה כשהשמירה נכשלה.
 *
 * השמירה עצמה וההחזרה למצב הקודם נבדקות ב-hooks/useAdminOrders.test.js;
 * כאן onTogglePicked הוא כפיל.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import OrderCard from './OrderCard';

const ORDER = {
  id: 12,
  status: 'processing',
  delivery_method: 'pickup',
  customer_name: 'דנה כהן',
  customer_phone: '0501234567',
  subtotal: 240,
  delivery_fee: 0,
  total: 240,
  created_at: '2026-10-04T08:00:00Z',
  items: [
    { id: 1, name: 'צבע לבן', price: 100, quantity: 2, selectedVariant: "5 ל'", selectedColor: 'לבן' },
    { id: 2, name: 'מברשת', price: 30, quantity: 1 },
    { id: 3, name: 'מוצר שנמחק', price: 10, quantity: 1 },
  ],
  picked_items: [0],
};

/* מוצר 1 גלוי עם תמונה, 2 מוסתר עם תמונה, 3 כבר לא בקטלוג. */
const PRODUCTS = new Map([
  [1, { id: 1, category: 'painting', image_url: '/images/white.webp', active: true }],
  [2, { id: 2, category: 'painting', image_url: '/images/brush.webp', active: false }],
]);

/** מרנדר כרטיס אחד, פתוח כברירת מחדל. */
function renderCard({ order = ORDER, isOpen = true, onTogglePicked = jest.fn(async () => null) } = {}) {
  render(
    <OrderCard
      order={order}
      productsById={PRODUCTS}
      isOpen={isOpen}
      onToggle={() => {}}
      onStatusChange={() => {}}
      onTogglePicked={onTogglePicked}
      onDelete={() => {}}
    />
  );
  return { onTogglePicked };
}

/** השורה ברשימה שמכילה את שם המוצר. */
const line = (name) => screen.getAllByRole('listitem').find((li) => within(li).queryByText(name));

/* התמונה היא קישוט — alt="" בתוך aria-hidden, כי השם כתוב לידה — ולכן
   מחפשים אותה כ-presentation וגם בין הרכיבים המוסתרים מקורא המסך. */
const thumbOf = (name) => within(line(name)).queryByRole('presentation', { hidden: true });

test('לחיצה בכל מקום בשורה מסמנת אותה', () => {
  const { onTogglePicked } = renderCard();
  fireEvent.click(screen.getByText('מברשת'));
  expect(onTogglePicked).toHaveBeenCalledWith(12, 1, true);
});

test('לחיצה על שורה מסומנת מבטלת את הסימון', () => {
  const { onTogglePicked } = renderCard();
  fireEvent.click(screen.getByText('צבע לבן'));
  expect(onTogglePicked).toHaveBeenCalledWith(12, 0, false);
});

test('כל שורה היא תיבת סימון אמיתית, ששמה הוא שם המוצר', () => {
  renderCard();
  const paint = screen.getByRole('checkbox', { name: /צבע לבן/ });
  expect(paint).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /מברשת/ })).not.toBeChecked();
  expect(line('צבע לבן')).toHaveClass('is-picked');
});

test('השורה מראה כמות, גרסה, צבע ומידה', () => {
  renderCard();
  const paint = line('צבע לבן');
  expect(within(paint).getByText(/× 2/)).toBeInTheDocument();
  expect(within(paint).getByText("5 ל' · לבן")).toBeInTheDocument();
});

test('תמונה ממוצר גלוי, וגיבוי למוצר מוסתר או שנמחק', () => {
  renderCard();
  expect(thumbOf('צבע לבן')).toHaveAttribute('src', '/images/white.webp');
  expect(thumbOf('מברשת')).toBeNull();
  expect(thumbOf('מוצר שנמחק')).toBeNull();
});

test('הכרטיס הסגור מראה כמה הוכנו', () => {
  renderCard({ isOpen: false });
  expect(screen.getByText('1/3 הוכנו')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

test('כשהכול הוכן בהזמנה שבטיפול: הצעד הבא מודגש, עם הודעה', () => {
  renderCard({ order: { ...ORDER, picked_items: [0, 1, 2] }, isOpen: false });
  expect(screen.getByRole('status')).toHaveTextContent('כל המוצרים הוכנו');
  expect(screen.getByRole('button', { name: /מוכנה לאיסוף/ })).toHaveClass('is-ready');
});

test('לא מדגישים כשחסרה שורה, וגם לא בהזמנה שעוד לא בטיפול', () => {
  renderCard({ isOpen: false });
  expect(screen.getByRole('status')).toBeEmptyDOMElement();

  renderCard({ order: { ...ORDER, id: 13, status: 'new', picked_items: [0, 1, 2] }, isOpen: false });
  expect(screen.getByRole('button', { name: /התחל טיפול/ })).not.toHaveClass('is-ready');
});

test('שמירה שנכשלה מציגה את ההודעה ליד הרשימה', async () => {
  renderCard({ onTogglePicked: jest.fn(async () => 'הסימון לא נשמר. נסה שוב.') });
  fireEvent.click(screen.getByText('מברשת'));
  expect(await screen.findByRole('alert')).toHaveTextContent('הסימון לא נשמר. נסה שוב.');
});
