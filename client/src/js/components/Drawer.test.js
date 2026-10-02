/**
 * בדיקות למגירה — ארבע ההתנהגויות שאי אפשר לראות בעין.
 *
 * העיצוב נבדק במסך; מה שנבדק כאן הוא מה שאין לו מראה: Escape סוגר,
 * המיקוד נכנס לפאנל בפתיחה וחוזר בסגירה לכפתור שפתח, הגלילה מאחור
 * נעולה כל זמן שהחלון פתוח, ו-Tab גולש בין הראשון והאחרון ולא יוצא.
 * שלושת החלונות של האתר עוברים דרך הרכיב הזה, ולכן הבדיקות האלה
 * מכסות את שלושתם.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { render, fireEvent } from '@testing-library/react';
import Drawer from './Drawer';

/** עוטף את המגירה בכפתור שפותח אותה, כדי שיהיה למיקוד לאן לחזור. */
function Harness({ open, onClose = () => {} }) {
  return (
    <>
      <button type="button" id="opener">פתח</button>
      {open && (
        <Drawer title="בדיקה" onClose={onClose}>
          <button type="button" id="inside">בפנים</button>
        </Drawer>
      )}
    </>
  );
}

test('Escape סוגר את המגירה', () => {
  const onClose = jest.fn();
  render(<Harness open onClose={onClose} />);

  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('המיקוד נכנס לפאנל בפתיחה וחוזר בסגירה לכפתור שפתח', () => {
  const { rerender } = render(<Harness open={false} />);
  const opener = document.getElementById('opener');
  opener.focus();
  expect(document.activeElement).toBe(opener);

  rerender(<Harness open />);
  expect(document.activeElement.getAttribute('role')).toBe('dialog');

  rerender(<Harness open={false} />);
  expect(document.activeElement).toBe(opener);
});

test('הגלילה מאחור נעולה כל זמן שהמגירה פתוחה', () => {
  const { rerender } = render(<Harness open={false} />);
  expect(document.body.style.overflow).toBe('');

  rerender(<Harness open />);
  expect(document.body.style.overflow).toBe('hidden');

  rerender(<Harness open={false} />);
  expect(document.body.style.overflow).toBe('');
});

test('Tab גולש בין התחנה האחרונה והראשונה ואינו יוצא מהפאנל', () => {
  render(<Harness open />);
  const close = document.querySelector('.drawer-close');
  const inside = document.getElementById('inside');

  inside.focus();
  fireEvent.keyDown(document.body, { key: 'Tab' });
  expect(document.activeElement).toBe(close);

  fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(inside);
});
