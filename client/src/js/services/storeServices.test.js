/**
 * בדיקות לשירותי החנות שאין להם קובץ בדיקה משלהם: orderService,
 * pigmentService, authService, והנפילות של reviewService.
 *
 * העיקר הוא מה שהקוראים נשענים עליו: 409 מהשרת מגיע עם המחירים
 * העדכניים ב-details, הודעת השרת עוברת כמו שהיא, וטלפון נשלח בספרות
 * בלבד. מריצים עם `npm run test:client` מהשורש.
 */
import { createOrder, getOrdersByPhone, ApiError } from './orderService';
import { getPigmentFormulas } from './pigmentService';
import { login, isLoggedIn, logout } from './authService';
import { getReviews, getReviewStats } from './reviewService';

/** תשובה מוצלחת עם גוף JSON. */
function ok(body, status = 200) {
  return Promise.resolve({ ok: true, status, json: () => Promise.resolve(body) });
}

/** תשובה כושלת, כמו שהשרת מחזיר אותה — { error, details? }. */
function fail(status, body) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });
}

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

describe('createOrder', () => {
  test('שולח POST עם JSON ומחזיר את ההזמנה שנשמרה', async () => {
    global.fetch.mockReturnValue(ok({ id: 7, total: 58.7 }, 201));

    const saved = await createOrder({ items: [{ id: 1, quantity: 2 }] });

    expect(saved).toEqual({ id: 7, total: 58.7 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ items: [{ id: 1, quantity: 2 }] });
  });

  test('409 זורק ApiError עם הסטטוס, הודעת השרת והמחירים העדכניים', async () => {
    const prices = [{ id: 1, price: 12.9 }];
    global.fetch.mockReturnValue(fail(409, { error: 'המחירים השתנו', details: { prices } }));

    const error = await createOrder({ items: [] }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('המחירים השתנו');
    expect(error.details.prices).toEqual(prices);
  });

  test('דחייה בלי הסבר מהשרת — ההודעה של ההזמנה', async () => {
    global.fetch.mockReturnValue(fail(500, {}));

    const error = await createOrder({ items: [] }).catch((e) => e);

    expect(error.message).toBe('שליחת ההזמנה נכשלה. אפשר לנסות שוב.');
  });

  test('תקלת רשת אינה ApiError', async () => {
    global.fetch.mockReturnValue(Promise.reject(new TypeError('Failed to fetch')));

    const error = await createOrder({ items: [] }).catch((e) => e);

    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe('getOrdersByPhone', () => {
  test('שולח את הספרות בלבד', async () => {
    global.fetch.mockReturnValue(ok([]));

    await getOrdersByPhone('050-123 4567');

    expect(global.fetch.mock.calls[0][0]).toBe('/api/orders/by-phone/0501234567');
  });

  test('הגבלת קצב (429) זורקת, ולא חוזרת כאילו היו הזמנות', async () => {
    global.fetch.mockReturnValue(fail(429, { error: 'יותר מדי בדיקות' }));

    await expect(getOrdersByPhone('0501234567')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getPigmentFormulas', () => {
  test('מחזיר את הגוונים', async () => {
    global.fetch.mockReturnValue(ok([{ color_code: 'A1' }]));
    await expect(getPigmentFormulas()).resolves.toEqual([{ color_code: 'A1' }]);
  });

  test('כל כישלון חוזר כמערך ריק', async () => {
    global.fetch.mockReturnValue(fail(500, { error: 'x' }));
    await expect(getPigmentFormulas()).resolves.toEqual([]);

    global.fetch.mockReturnValue(Promise.reject(new TypeError('offline')));
    await expect(getPigmentFormulas()).resolves.toEqual([]);
  });
});

describe('authService', () => {
  test('login מעביר את הודעת השרת על סיסמה שגויה', async () => {
    global.fetch.mockReturnValue(fail(401, { error: 'סיסמה שגויה' }));
    await expect(login('nope')).rejects.toThrow('סיסמה שגויה');
  });

  test('isLoggedIn: 200 → true, 401 ותקלת רשת → false', async () => {
    global.fetch.mockReturnValue(ok({ authenticated: true }));
    await expect(isLoggedIn()).resolves.toBe(true);

    global.fetch.mockReturnValue(fail(401, {}));
    await expect(isLoggedIn()).resolves.toBe(false);

    global.fetch.mockReturnValue(Promise.reject(new TypeError('offline')));
    await expect(isLoggedIn()).resolves.toBe(false);
  });

  test('logout אינו זורק גם בלי שרת', async () => {
    global.fetch.mockReturnValue(Promise.reject(new TypeError('offline')));
    await expect(logout()).resolves.toBeUndefined();
  });
});

describe('reviewService — מה חוזר כשמשהו נכשל', () => {
  test('getReviews: שגיאת שרת → מערך ריק', async () => {
    global.fetch.mockReturnValue(fail(500, { error: 'x' }));
    await expect(getReviews({ type: 'store' })).resolves.toEqual([]);
  });

  test('getReviews: תקלת רשת עדיין נזרקת לקורא', async () => {
    global.fetch.mockReturnValue(Promise.reject(new TypeError('offline')));
    await expect(getReviews({ type: 'store' })).rejects.toThrow('offline');
  });

  test('getReviewStats: שגיאת שרת → null, ולא גוף השגיאה', async () => {
    global.fetch.mockReturnValue(fail(500, { error: 'x' }));
    await expect(getReviewStats()).resolves.toBeNull();
  });
});
