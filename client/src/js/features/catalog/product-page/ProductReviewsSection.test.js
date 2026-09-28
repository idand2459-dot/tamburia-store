/**
 * בדיקות לטופס הביקורת שבעמוד המוצר, ובעיקר למסלול הכישלון.
 *
 * עד לא מזמן הטופס התעלם מהתשובה לגמרי: 400 מהשרת ("חסר שם הכותב")
 * הציג "תודה! הביקורת תפורסם לאחר אישור", והביקורת נעלמה בלי שאיש
 * ידע. הבדיקות כאן נועלות את שלושת החלקים של התיקון — אין תודה,
 * יש הודעה, והטופס נשאר מלא — כי הכישלון הוא בדיוק המסלול שאיש לא
 * רואה בפיתוח, ולכן קל לשבור אותו שוב.
 *
 * fireEvent ולא user-event, כמו ב-Drawer.test.js: הגרסה שבפרויקט
 * היא 13, ואין בה עדיין userEvent.setup.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductReviewsSection from './ProductReviewsSection';

const THANKS = /תודה/;
const NAME_FIELD = 'ישראל ישראלי';
const TEXT_FIELD = 'מה דעתך על המוצר?';

/** תשובת שרת מוכנה, מוצלחת או כושלת. */
const respond = (ok, status, body) => ({ ok, status, json: async () => body });

/** מרנדר את המקטע בלי ביקורות קיימות ופותח את הטופס. */
function openForm() {
  render(<ProductReviewsSection productId={7} reviews={[]} />);
  fireEvent.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));
}

/** ממלא את הטופס ושולח אותו. */
function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText(NAME_FIELD), { target: { value: 'ישראל' } });
  fireEvent.change(screen.getByPlaceholderText(TEXT_FIELD), { target: { value: 'מוצר מצוין' } });
  fireEvent.click(screen.getByRole('button', { name: /שלח ביקורת/ }));
}

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

test('שליחה מוצלחת מציגה תודה', async () => {
  global.fetch.mockResolvedValue(respond(true, 201, { id: 1 }));

  openForm();
  fillAndSubmit();

  expect(await screen.findByText(THANKS)).toBeDefined();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('400 מהשרת מציג את ההודעה שלו, בלי תודה, והטופס נשאר מלא', async () => {
  global.fetch.mockResolvedValue(respond(false, 400, { error: 'הדירוג חייב להיות מספר שלם בין 1 ל-5' }));

  openForm();
  fillAndSubmit();

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('הדירוג חייב להיות מספר שלם בין 1 ל-5');
  expect(screen.queryByText(THANKS)).toBeNull();

  // מה שהלקוח כתב הוא הדבר היחיד כאן שאי אפשר לשחזר, ולכן הוא נשאר.
  expect(screen.getByPlaceholderText(NAME_FIELD).value).toBe('ישראל');
  expect(screen.getByPlaceholderText(TEXT_FIELD).value).toBe('מוצר מצוין');
});

test('נפילת רשת מציגה הודעה משלה, ולא את זו של השרת', async () => {
  global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

  openForm();
  fillAndSubmit();

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('לא הצלחנו להגיע לשרת');
  expect(screen.queryByText(THANKS)).toBeNull();
});

test('כפתור השליחה נעול כל עוד השליחה בדרך', async () => {
  let release;
  global.fetch.mockReturnValue(new Promise((resolve) => {
    release = () => resolve(respond(true, 201, { id: 1 }));
  }));

  openForm();
  fillAndSubmit();

  expect(screen.getByRole('button', { name: /שולח/ }).disabled).toBe(true);

  release();
  await waitFor(() => expect(screen.getByText(THANKS)).toBeDefined());
});

test('פתיחה מחדש של הטופס מנקה שגיאה קודמת', async () => {
  global.fetch.mockResolvedValue(respond(false, 400, { error: 'חסר שם הכותב' }));

  openForm();
  fillAndSubmit();
  expect(await screen.findByRole('alert')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: /סגור/ }));
  fireEvent.click(screen.getByRole('button', { name: /כתוב ביקורת/ }));

  expect(screen.queryByRole('alert')).toBeNull();
});
