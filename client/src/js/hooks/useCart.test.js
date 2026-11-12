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

/*
 * CURRENT BEHAVIOR, pinned on purpose (backlog item BF-01, REFACTOR_PLAN.md §7).
 *
 * The two ways of adding to the cart match "the same line" differently, and neither one
 * looks at the variant the way the checkout form does. This test records what the code does
 * today so a refactor cannot change it by accident. It is not a statement that this is right:
 * when BF-01 is fixed, this is the test that is rewritten, deliberately and in that commit.
 */
test('CURRENT BEHAVIOR (BF-01): the variant is not part of a cart line, and a bundle matches by id only', () => {
  const { result } = renderHook(() => useCart());
  const small = { ...PRODUCT, price: 10, selectedVariant: '1 ליטר' };
  const large = { ...PRODUCT, price: 40, selectedVariant: '5 ליטר' };

  // addToCart: another variant, with no colour or size, merges into the first line.
  act(() => result.current.addToCart(small, 1));
  act(() => result.current.addToCart(large, 2));
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(3);
  expect(result.current.cart[0].selectedVariant).toBe('1 ליטר');
  expect(result.current.cart[0].price).toBe(10);
  expect(result.current.subtotal).toBe(30);

  // addBundleToCart: an existing id is matched whatever its colour, size or variant.
  act(() => result.current.setCart([{ ...PRODUCT, selectedColor: 'לבן', quantity: 1 }]));
  act(() => result.current.addBundleToCart([{ ...PRODUCT, selectedColor: 'שחור', quantity: 2 }]));
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(3);
  expect(result.current.cart[0].selectedColor).toBe('לבן');

  // addBundleToCart: a product that is not in the cart is added with its colour cleared.
  act(() => result.current.addBundleToCart([{ ...PRODUCT, id: 2, selectedColor: 'אדום', quantity: 1 }]));
  expect(result.current.cart).toHaveLength(2);
  expect(result.current.cart[1].id).toBe(2);
  expect(result.current.cart[1].selectedColor).toBeNull();
});
