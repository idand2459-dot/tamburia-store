/**
 * בדיקות לכלל "מוצר בלי מחיר".
 *
 * הפונקציה הזו קובעת האם כפתור העגלה מושבת, ולכן טעות בה היא או מוצר
 * שאי אפשר לקנות למרות שיש לו מחיר, או מוצר ב-₪0 שחוזר להיות ניתן
 * להזמנה. חמישה רכיבים באתר ושני מקומות באדמין נשענים עליה.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import {
  orderablePrice, hasPrice, priceLabel, selectedPrice, NO_PRICE_LABEL,
  formatPrice, formatAmount, parsePriceInput, toAgorot, lineTotal, sumPrices,
} from './pricing';

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

/* ---- מחירים עשרוניים ----------------------------------------------------
   הבאג: 12.90 שהוקלד באדמין הגיע למסד כ-12 (parseInt) או 13 (Math.round),
   ושדה number בלי step חסם אותו עוד בדפדפן. אלה הכללים שמחליפים זאת. */

test('תצוגה: עשרוני עם שתי ספרות, שלם בלי נקודה', () => {
  expect(formatPrice(12.9)).toBe('₪12.90');
  expect(formatPrice(30)).toBe('₪30');
  expect(formatPrice(0.5)).toBe('₪0.50');
  expect(priceLabel({ price: 12.9 })).toBe('₪12.90');
  expect(priceLabel({ price: 30 })).toBe('₪30');
});

test('תצוגה: שארית float אינה הופכת מחיר שלם לעשרוני', () => {
  expect(formatAmount(30.000000000004)).toBe('30');
  expect(formatAmount(0.1 + 0.2)).toBe('0.30');
});

test('קלט: נקודה, פסיק ישראלי ומספר שלם', () => {
  expect(parsePriceInput('12.90')).toBe(12.9);
  expect(parsePriceInput('12,90')).toBe(12.9);
  expect(parsePriceInput(' 12.9 ')).toBe(12.9);
  expect(parsePriceInput('30')).toBe(30);
  expect(parsePriceInput(30)).toBe(30);
  expect(parsePriceInput('0')).toBe(0);
});

test('קלט: יותר משתי ספרות או טקסט — נדחה, לא מעוגל', () => {
  expect(parsePriceInput('12.999')).toBeNull();
  expect(parsePriceInput('12.')).toBeNull();
  expect(parsePriceInput('-5')).toBeNull();
  expect(parsePriceInput('יקר')).toBeNull();
  expect(parsePriceInput('')).toBeNull();
  expect(parsePriceInput('1,2,3')).toBeNull();
});

test('חשבון באגורות: 12.9 ו-12.90 זהים, 3 × 12.9 הוא 38.7', () => {
  expect(toAgorot(12.9)).toBe(toAgorot('12.90'));
  expect(lineTotal(12.9, 3)).toBe(38.7);
  expect(sumPrices([0.1, 0.2])).toBe(0.3);
  expect(sumPrices([38.7, 20])).toBe(58.7);
});
