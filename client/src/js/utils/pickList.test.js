/**
 * בדיקות לפונקציות של רשימת הליקוט: הקבוצה של השורות שהוכנו
 * וההתקדמות שנגזרת ממנה.
 */
import { isPicked, withLine, pickProgress } from './pickList';

const order = (picked_items, lines = 3) => ({
  items: Array.from({ length: lines }, (_, i) => ({ name: `פריט ${i}` })),
  picked_items,
});

test('withLine מוסיף שורה וממיין כמו השרת', () => {
  expect(withLine([2], 0, true)).toEqual([0, 2]);
});

test('withLine אינו מכפיל שורה שכבר מסומנת', () => {
  expect(withLine([0, 1], 1, true)).toEqual([0, 1]);
});

test('withLine מבטל שורה אחת ומשאיר את השאר', () => {
  expect(withLine([0, 1, 2], 1, false)).toEqual([0, 2]);
});

test('withLine מסתדר עם הזמנה ישנה בלי picked_items', () => {
  expect(withLine(undefined, 1, true)).toEqual([1]);
  expect(isPicked({ items: [] }, 0)).toBe(false);
});

test('pickProgress סופר מה הוכן מתוך כמה', () => {
  expect(pickProgress(order([0]))).toEqual({ done: 1, total: 3, complete: false });
  expect(pickProgress(order([0, 1, 2]))).toEqual({ done: 3, total: 3, complete: true });
});

test('הזמנה בלי שורות אינה "הוכנה כולה"', () => {
  expect(pickProgress(order([], 0)).complete).toBe(false);
});
