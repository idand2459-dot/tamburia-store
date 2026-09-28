/**
 * בדיקות לכלל "מוצר בלי מחיר".
 *
 * הפונקציה הזו קובעת האם כפתור העגלה מושבת, ולכן טעות בה היא או מוצר
 * שאי אפשר לקנות למרות שיש לו מחיר, או מוצר ב-₪0 שחוזר להיות ניתן
 * להזמנה. חמישה רכיבים באתר ושני מקומות באדמין נשענים עליה.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { orderablePrice, hasPrice, priceLabel, selectedPrice, NO_PRICE_LABEL } from './pricing';

test('מחיר חיובי הוא מחיר', () => {
  expect(orderablePrice({ price: 120 })).toBe(120);
  expect(hasPrice({ price: 120 })).toBe(true);
  expect(priceLabel({ price: 120 })).toBe('₪120');
});

test('מחיר 0 אינו מחיר', () => {
  expect(orderablePrice({ price: 0 })).toBeNull();
  expect(hasPrice({ price: 0 })).toBe(false);
  expect(priceLabel({ price: 0 })).toBe(NO_PRICE_LABEL);
});

test('מחיר חסר או פסול אינו מחיר', () => {
  expect(hasPrice({})).toBe(false);
  expect(hasPrice({ price: null })).toBe(false);
  expect(hasPrice({ price: 'יקר' })).toBe(false);
  expect(hasPrice(undefined)).toBe(false);
});

test('גרסה מתומחרת אחת מספיקה, והמחיר הוא הזול מבין המתומחרות', () => {
  const product = {
    price: 0,
    variants: [{ label: 'קטן', price: 0 }, { label: 'בינוני', price: 80 }, { label: 'גדול', price: 50 }],
  };
  // 0 של "קטן" אינו נכנס לחשבון, אחרת "מ-₪0" היה חוזר דרך הגרסאות
  expect(orderablePrice(product)).toBe(50);
  expect(hasPrice(product)).toBe(true);
});

test('מוצר שכל גרסאותיו ב-0 הוא מוצר בלי מחיר', () => {
  expect(hasPrice({ price: 0, variants: [{ label: 'א', price: 0 }] })).toBe(false);
});

test('מערך גרסאות ריק נופל בחזרה למחיר המוצר', () => {
  expect(orderablePrice({ price: 45, variants: [] })).toBe(45);
});

test('selectedPrice מעדיף את הגרסה שנבחרה על מחיר המוצר', () => {
  const product = { price: 30 };
  expect(selectedPrice(product, { label: 'גדול', price: 90 })).toBe(90);
  expect(selectedPrice(product, null)).toBe(30);
  // גרסה שנבחרה והמחיר שלה 0 — אין מה להזמין, גם אם למוצר יש מחיר
  expect(selectedPrice(product, { label: 'קטן', price: 0 })).toBeNull();
});
