/**
 * בדיקות ל-useCart — כרגע לארגומנט הכמות של addToCart.
 *
 * זו הבדיקה הראשונה בצד הלקוח, והיא כאן מפני שהכמות היא ההתנהגות
 * היחידה בעגלה ששני קוראים שונים מסתמכים עליה בשתי צורות: כרטיס
 * המוצר ברשת קורא בלי כמות ומצפה לפריט אחד, ועמוד המוצר מעביר את
 * מה שנבחר בבורר. ברירת מחדל ששוברת את הקורא הראשון היא בדיוק מה
 * שקל לא לשים לב אליו, ולכן שני המקרים כתובים כאן במפורש.
 *
 * מריצים עם `npm run test:client` מהשורש. ה-localStorage מתאפס לפני
 * כל בדיקה, כי useCart טוען ממנו את המצב ההתחלתי ושומר בכל שינוי.
 */
import { renderHook, act } from '@testing-library/react';
import { useCart } from './useCart';

const PRODUCT = {
  id: 1, name: 'מברשת צביעה', price: 10,
  selectedColor: null, selectedSize: null,
};

beforeEach(() => localStorage.clear());

test('קורא בלי כמות מוסיף פריט אחד, ולחיצה שנייה מגדילה לשניים', () => {
  const { result } = renderHook(() => useCart());

  act(() => result.current.addToCart(PRODUCT));
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(1);

  act(() => result.current.addToCart(PRODUCT));
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(2);
  expect(result.current.cartCount).toBe(2);
});

test('כמות מפורשת נכנסת כמו שהיא, ומצטברת על פריט קיים', () => {
  const { result } = renderHook(() => useCart());

  act(() => result.current.addToCart(PRODUCT, 3));
  expect(result.current.cart[0].quantity).toBe(3);

  act(() => result.current.addToCart(PRODUCT, 2));
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(5);

  act(() => result.current.addToCart({ ...PRODUCT, id: 2 }, 4));
  expect(result.current.cart).toHaveLength(2);
  expect(result.current.cartCount).toBe(9);
  expect(result.current.subtotal).toBe(90);
});

test('צבע אחר הוא שורה אחרת בעגלה, עם כמות משלה', () => {
  const { result } = renderHook(() => useCart());

  act(() => result.current.addToCart({ ...PRODUCT, selectedColor: 'לבן' }, 3));
  act(() => result.current.addToCart({ ...PRODUCT, selectedColor: 'שחור' }, 2));

  expect(result.current.cart.map((item) => item.quantity)).toEqual([3, 2]);
});
