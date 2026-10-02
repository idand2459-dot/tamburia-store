/**
 * בדיקות ל-productService.
 *
 * העיקר כאן הוא הנרמול: GET /api/products מחזיר מערך שטוח, אבל עם
 * limit או offset הוא מחזיר { products, pagination }. ההבדל הזה כבר
 * הפיל את אותו באג פעמיים כשכל קורא זכר אותו לבד, ועכשיו הוא חי
 * במקום אחד — ולכן הוא נבדק כאן, בשתי הצורות.
 *
 * אחריו נבדקת בניית הכתובת, כי "אותן בקשות בדיוק" הוא התנאי של
 * הריפקטור הזה: פרמטר ריק אסור להופיע, ובלי פרמטרים כלל אסור
 * שיתווסף '?' לכתובת.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { getProducts, getProduct, isNotFound, isAbortError, ApiError } from './productService';

/** תשובה מוצלחת עם גוף JSON. */
function ok(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

/** תשובה כושלת, כמו שהשרת מחזיר אותה — { error }. */
function fail(status, body) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });
}

/** הכתובת שנשלחה ב-fetch האחרון. */
function lastUrl() {
  return global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];
}

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

describe('getProducts — נרמול צורת התשובה', () => {
  test('מערך שטוח הופך ל-{ products, pagination } עם pagination ריק', async () => {
    global.fetch.mockReturnValue(ok([{ id: 1 }, { id: 2 }]));

    const result = await getProducts({ category: 'painting' });

    expect(result.products).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.pagination).toBeNull();
  });

  test('{ products, pagination } עובר כמו שהוא', async () => {
    const pagination = { total: 40, limit: 8, offset: 0 };
    global.fetch.mockReturnValue(ok({ products: [{ id: 3 }], pagination }));

    const result = await getProducts({ search: 'מברשת', limit: 8 });

    expect(result.products).toEqual([{ id: 3 }]);
    expect(result.pagination).toEqual(pagination);
  });

  test('תשובה משונה אינה מפילה את הקורא אלא מחזירה רשימה ריקה', async () => {
    global.fetch.mockReturnValue(ok({}));

    await expect(getProducts()).resolves.toEqual({ products: [], pagination: null });
  });
});

describe('getProducts — בניית הכתובת', () => {
  beforeEach(() => global.fetch.mockReturnValue(ok([])));

  test('בלי פרמטרים כלל הכתובת נקייה, בלי סימן שאלה', async () => {
    await getProducts();
    expect(lastUrl()).toBe('/api/products');
  });

  test('פרמטרים ריקים, undefined ו-null מושמטים', async () => {
    await getProducts({ category: 'tools', subcategory: '', search: undefined, offset: null });
    expect(lastUrl()).toBe('/api/products?category=tools');
  });

  test('offset אפס נשלח, כי אפס הוא ערך ולא היעדר ערך', async () => {
    await getProducts({ limit: 8, offset: 0 });
    expect(lastUrl()).toBe('/api/products?limit=8&offset=0');
  });

  test('אותה כתובת שעמוד המוצר בנה קודם לבד', async () => {
    await getProducts({ category: 'painting', limit: 5 });
    expect(lastUrl()).toBe('/api/products?category=painting&limit=5');
  });

  test('inStock נשלח כ-in_stock, בשם שהשרת מאמת', async () => {
    await getProducts({ inStock: true });
    expect(lastUrl()).toBe('/api/products?in_stock=true');
  });

  test('ערכים מקודדים — עברית ותווים שמשמעותיים ב-query חוזרים כמו שנשלחו', async () => {
    await getProducts({ search: 'צבע & מכחול' });

    const query = new URLSearchParams(lastUrl().split('?')[1]);
    expect(query.get('search')).toBe('צבע & מכחול');
  });
});

describe('getProduct', () => {
  test('מחזיר את המוצר', async () => {
    global.fetch.mockReturnValue(ok({ id: 7, name: 'מברשת' }));

    await expect(getProduct(7)).resolves.toEqual({ id: 7, name: 'מברשת' });
    expect(lastUrl()).toBe('/api/products/7');
  });

  test('404 זורק שגיאה שאפשר לזהות כ"לא נמצא"', async () => {
    global.fetch.mockReturnValue(fail(404, { error: 'מוצר 999 לא נמצא' }));

    const error = await getProduct(999).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(isNotFound(error)).toBe(true);
    expect(error.message).toBe('מוצר 999 לא נמצא');
  });

  test('שגיאת שרת מגיעה עם ההודעה של השרת, ואינה "לא נמצא"', async () => {
    global.fetch.mockReturnValue(fail(500, { error: 'משהו השתבש' }));

    const error = await getProduct(7).catch((e) => e);

    expect(error.message).toBe('משהו השתבש');
    expect(error.status).toBe(500);
    expect(isNotFound(error)).toBe(false);
  });

  test('תשובה כושלת שאינה JSON נופלת להודעה כללית ולא מפילה את הקורא', async () => {
    global.fetch.mockReturnValue(Promise.resolve({
      ok: false, status: 502, json: () => Promise.reject(new SyntaxError('not json')),
    }));

    const error = await getProduct(7).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBeTruthy();
  });
});

describe('ביטול בקשה', () => {
  test('ה-signal מועבר ל-fetch', async () => {
    global.fetch.mockReturnValue(ok([]));
    const controller = new AbortController();

    await getProducts({ signal: controller.signal });

    expect(global.fetch).toHaveBeenCalledWith('/api/products', { signal: controller.signal });
  });

  test('ביטול מתגלגל לקורא ומזוהה כביטול ולא ככישלון', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    global.fetch.mockReturnValue(Promise.reject(abortError));

    const error = await getProducts({ signal: new AbortController().signal }).catch((e) => e);

    expect(error).toBe(abortError);
    expect(isAbortError(error)).toBe(true);
    expect(isNotFound(error)).toBe(false);
  });
});
