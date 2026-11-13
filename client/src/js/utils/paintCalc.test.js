/**
 * Unit tests for utils/paintCalc.js, called directly. The behavior through the rendered
 * calculator (typing, buttons, the bundle) is pinned in
 * features/calculators/PaintCalculator.test.js; these cover the formulas on their own,
 * including the rounding.
 *
 * Run with `npm run test:client` from the root.
 */
import { LARGE_BUCKET_LITERS, blendWithWhite, isLight, calculatePaint, cheaperBucket } from './paintCalc';

const RED = { color_code: 'A1', ml_per_liter_light: 25, ml_per_liter_medium: 50, ml_per_liter_dark: 100 };
const base = { walls: [{ length: '5', height: '2.5' }], windows: 0, doors: 0, coats: 2, formula: undefined, shade: 'medium' };

describe('calculatePaint', () => {
  test('area, net area and liters for one wall and two coats', () => {
    expect(calculatePaint(base)).toEqual({
      totalWallArea: '12.5', netArea: '12.5', paintLiters: 2.5, paintCans5: 1, paintCans18: 1, colorMixBottles: 0,
    });
  });

  test('windows take 1.5 m² and doors 2 m²; the net area never goes below zero', () => {
    expect(calculatePaint({ ...base, windows: 2, doors: 1 }).netArea).toBe('7.5');
    expect(calculatePaint({ ...base, walls: [{ length: '1', height: '1' }], doors: 3 })).toMatchObject({
      netArea: '0.0', paintLiters: 0, paintCans5: 0, paintCans18: 0,
    });
  });

  test('empty or invalid wall fields count as zero', () => {
    const result = calculatePaint({ ...base, walls: [{ length: '4', height: '2' }, { length: '', height: '3' }, { length: 'x', height: 'y' }] });

    expect(result.totalWallArea).toBe('8.0');
  });

  test('liters are rounded up to one decimal and the buckets to whole numbers', () => {
    // 1 coat over 12.5 m² = 1.25 L -> 1.3 L; 3 coats = 3.75 L -> 3.8 L
    expect(calculatePaint({ ...base, coats: 1 }).paintLiters).toBe(1.3);
    expect(calculatePaint({ ...base, coats: 3 }).paintLiters).toBe(3.8);
    // 30 L: 6 buckets of 5 or 2 of 18
    expect(calculatePaint({ ...base, walls: [{ length: '10', height: '15' }] })).toMatchObject({ paintLiters: 30, paintCans5: 6, paintCans18: 2 });
  });

  test('pigment bottles are 250 ml each, rounded up, by the dose of the chosen shade', () => {
    const tenLiters = { ...base, walls: [{ length: '10', height: '5' }], formula: RED };

    expect(calculatePaint({ ...tenLiters, shade: 'light' }).colorMixBottles).toBe(1);
    expect(calculatePaint({ ...tenLiters, shade: 'medium' }).colorMixBottles).toBe(2);
    expect(calculatePaint({ ...tenLiters, shade: 'dark' }).colorMixBottles).toBe(4);
    expect(calculatePaint({ ...tenLiters, formula: undefined }).colorMixBottles).toBe(0);
  });

  test('the large bucket is 18 liters', () => {
    expect(LARGE_BUCKET_LITERS).toBe(18);
  });
});

describe('cheaperBucket', () => {
  const result = { paintCans5: 6, paintCans18: 2 };
  const products = (p5, p18) => (key) => ({ paint5: p5, paint18: p18 }[key] ?? null);

  test('returns the option with the lower total price for the whole quantity', () => {
    expect(cheaperBucket(result, products({ price: 100 }, { price: 250 }))).toMatchObject({ key: 'paint18', quantity: 2 });
    expect(cheaperBucket(result, products({ price: 50 }, { price: 250 }))).toMatchObject({ key: 'paint5', quantity: 6 });
  });

  test('a tie keeps the 5 liter bucket', () => {
    expect(cheaperBucket(result, products({ price: 150 }, { price: 450 })).key).toBe('paint5');
  });

  test('skips sizes with no product or no quantity; null when nothing is left or there is no result', () => {
    expect(cheaperBucket(result, products(null, { price: 250 })).key).toBe('paint18');
    expect(cheaperBucket({ paintCans5: 0, paintCans18: 2 }, products({ price: 1 }, { price: 250 })).key).toBe('paint18');
    expect(cheaperBucket(result, products(null, null))).toBeNull();
    expect(cheaperBucket(null, products({ price: 1 }, { price: 1 }))).toBeNull();
  });
});

describe('colour helpers', () => {
  test('blendWithWhite mixes towards white by the factor and rounds each channel', () => {
    expect(blendWithWhite('#ff0000', 1)).toBe('rgb(255,0,0)');
    expect(blendWithWhite('#ff0000', 0)).toBe('rgb(255,255,255)');
    expect(blendWithWhite('#0000ff', 0.35)).toBe('rgb(166,166,255)');
  });

  test('isLight is true above a luminance of 160 and for input it cannot read', () => {
    expect(isLight('rgb(255,255,255)')).toBe(true);
    expect(isLight('rgb(0,0,0)')).toBe(false);
    expect(isLight('rgb(166,166,255)')).toBe(true);
    expect(isLight('rgb(255,0,0)')).toBe(false);
    expect(isLight('not a colour')).toBe(true);
  });
});
