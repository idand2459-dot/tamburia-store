/**
 * בדיקות לסימון ברשימת הליקוט ב-useAdminOrders: העדכון האופטימי,
 * וההחזרה של השורה בלבד כשהשמירה נכשלה.
 *
 * ה-WebSocket מוחלף בכפיל: הבדיקה היא על ה-state ולא על התעבורה.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminOrders } from './useAdminOrders';
import { NETWORK_ERROR } from '../utils/apiErrors';

jest.mock('./useWebSocket', () => ({ useWebSocket: () => {} }));

const ORDER = { id: 12, status: 'processing', items: [{ name: 'א' }, { name: 'ב' }], picked_items: [0] };

/**
 * עוטף fetch מזויף: GET מחזיר את ההזמנה, וה-PUT מחכה עד שהבדיקה
 * מחליטה איך הוא ייגמר — כך אפשר לראות את המסך באמצע השמירה.
 */
function fakeApi() {
  let settle;
  const api = jest.fn((_url, options) => {
    if (!options) return Promise.resolve({ ok: true, json: async () => [ORDER] });
    return new Promise((resolve, reject) => { settle = { resolve, reject }; });
  });
  return { api, settle: () => settle };
}

/** מרנדר את ההוק ומחכה שההזמנה תיטען. */
async function setup() {
  const fake = fakeApi();
  const { result } = renderHook(() => useAdminOrders(fake.api));
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  return { ...fake, result };
}

const pickedOf = (result) => result.current.orders[0].picked_items;

test('הסימון מופיע במסך מיד, לפני שהשרת ענה', async () => {
  const { api, settle, result } = await setup();

  let pending;
  act(() => { pending = result.current.togglePicked(12, 1, true); });
  expect(pickedOf(result)).toEqual([0, 1]);
  expect(api).toHaveBeenLastCalledWith('/api/orders/12/items/1/picked', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ picked: true }),
  }));

  await act(async () => { settle().resolve({ ok: true, json: async () => ({}) }); await pending; });
  expect(pickedOf(result)).toEqual([0, 1]);
});

test('השרת דחה: השורה חוזרת למצבה, ומוחזרת הודעת השרת', async () => {
  const { settle, result } = await setup();

  let pending;
  act(() => { pending = result.current.togglePicked(12, 1, true); });
  let message;
  await act(async () => {
    settle().resolve({ ok: false, json: async () => ({ error: 'הזמנה 12 לא נמצאה' }) });
    message = await pending;
  });

  expect(pickedOf(result)).toEqual([0]);
  expect(message).toBe('הזמנה 12 לא נמצאה');
});

test('תקלת רשת: ביטול שנכשל מחזיר את הסימון', async () => {
  const { settle, result } = await setup();

  let pending;
  act(() => { pending = result.current.togglePicked(12, 0, false); });
  expect(pickedOf(result)).toEqual([]);

  let message;
  await act(async () => { settle().reject(new Error('offline')); message = await pending; });
  expect(pickedOf(result)).toEqual([0]);
  expect(message).toBe(NETWORK_ERROR);
});

test('החזרה אחרי כישלון אינה מוחקת שורה אחרת שסומנה בינתיים', async () => {
  const { api, result } = await setup();
  const replies = [];
  api.mockImplementation(() => new Promise((resolve) => replies.push(resolve)));

  let first;
  let second;
  act(() => { first = result.current.togglePicked(12, 1, true); });
  act(() => { second = result.current.togglePicked(12, 0, false); });
  expect(pickedOf(result)).toEqual([1]);

  await act(async () => {
    replies[0]({ ok: true, json: async () => ({}) });
    replies[1]({ ok: false, json: async () => ({}) });
    await Promise.all([first, second]);
  });
  expect(pickedOf(result)).toEqual([0, 1]);
});
