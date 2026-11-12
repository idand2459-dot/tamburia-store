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

/*
 * handleStatusChange, pinned at the fetch level: what is sent over the network and what the
 * screen shows afterwards. The hook is given an `api` built straight on the fake global fetch
 * (no 401 handling: that belongs to Admin.js and gets its own test). When the admin API layer
 * is introduced, only `apiOverFetch` changes; the assertions below keep describing the same
 * externally visible behavior.
 */

/** A fetch response; a body of `undefined` is one that is not JSON. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

/** The hook's `api` argument, built on the global fetch. */
const apiOverFetch = (url, options) => fetch(url, options);

/** The list loads the fake fetch has seen (a GET with no options). */
const listCalls = () => global.fetch.mock.calls.filter(([url, options]) => url === '/api/orders' && !options);

/** Renders the hook with the fake fetch and waits for the first load. */
async function setupOverFetch() {
  const { result } = renderHook(() => useAdminOrders(apiOverFetch));
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  return result;
}

describe('handleStatusChange (fetch level)', () => {
  const STATUS_URL = '/api/orders/12/status';
  let statusReply;

  const statusCalls = () => global.fetch.mock.calls.filter(([url]) => url === STATUS_URL);

  beforeEach(() => {
    statusReply = () => reply(200, {});
    global.fetch = jest.fn((url, options) => {
      if (url === '/api/orders' && !options) return reply(200, [ORDER]);
      if (url === STATUS_URL) return statusReply();
      throw new Error(`unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('sends the PUT with a JSON body, reloads the list on success and clears an earlier error', async () => {
    const result = await setupOverFetch();

    statusReply = () => reply(500, { error: 'שגיאת שרת' });
    await act(async () => { await result.current.handleStatusChange(12, 'ready_for_pickup'); });
    expect(result.current.ordersError).toBe('שגיאת שרת');

    statusReply = () => reply(200, { id: 12, status: 'ready_for_pickup' });
    await act(async () => { await result.current.handleStatusChange(12, 'ready_for_pickup'); });

    expect(statusCalls()).toHaveLength(2);
    expect(statusCalls()[1]).toEqual([STATUS_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready_for_pickup' }),
    }]);
    expect(result.current.ordersError).toBe('');
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  test.each([
    [401, 'נדרשת התחברות כמנהל'],
    [404, 'הזמנה 12 לא נמצאה'],
    [400, 'סטטוס לא חוקי'],
  ])('a %i answer shows the server message as it is and does not reload', async (status, message) => {
    const result = await setupOverFetch();
    statusReply = () => reply(status, { error: message });

    await act(async () => { await result.current.handleStatusChange(12, 'new'); });

    expect(result.current.ordersError).toBe(message);
    expect(listCalls()).toHaveLength(1);
  });

  test.each([
    ['a body that is not JSON', undefined],
    ['a JSON body without a message', {}],
    ['a blank message', { error: '   ' }],
  ])('%s: shows the fallback message and does not reload', async (_label, body) => {
    const result = await setupOverFetch();
    statusReply = () => reply(502, body);

    await act(async () => { await result.current.handleStatusChange(12, 'new'); });

    expect(result.current.ordersError).toBe('שינוי הסטטוס של הזמנה #12 נכשל.');
    expect(listCalls()).toHaveLength(1);
  });

  test('a network failure shows the network message and does not reload', async () => {
    const result = await setupOverFetch();
    statusReply = () => Promise.reject(new TypeError('Failed to fetch'));

    await act(async () => { await result.current.handleStatusChange(12, 'new'); });

    expect(result.current.ordersError).toBe(NETWORK_ERROR);
    expect(listCalls()).toHaveLength(1);
  });
});

/*
 * handleDeleteOrder, pinned the same way: the confirmation the admin gets, the exact request,
 * and what the screen shows afterwards. window.confirm is the only thing replaced besides fetch.
 */
describe('handleDeleteOrder (fetch level)', () => {
  const ORDER_URL = '/api/orders/12';
  const CONFIRM_TEXT = 'למחוק את ההזמנה?';
  let deleteReply;
  let confirm;

  const deleteCalls = () => global.fetch.mock.calls.filter(([url]) => url === ORDER_URL);

  beforeEach(() => {
    deleteReply = () => reply(200, {});
    confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    global.fetch = jest.fn((url, options) => {
      if (url === '/api/orders' && !options) return reply(200, [ORDER]);
      if (url === ORDER_URL) return deleteReply();
      throw new Error(`unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    confirm.mockRestore();
    delete global.fetch;
  });

  test('when the admin cancels the confirmation nothing is sent and the list is not reloaded', async () => {
    const result = await setupOverFetch();
    confirm.mockReturnValue(false);

    await act(async () => { await result.current.handleDeleteOrder(12); });

    expect(confirm).toHaveBeenCalledWith(CONFIRM_TEXT);
    expect(deleteCalls()).toHaveLength(0);
    expect(listCalls()).toHaveLength(1);
    expect(result.current.ordersError).toBe('');
  });

  test('sends the DELETE after confirmation, reloads the list on success and clears an earlier error', async () => {
    const result = await setupOverFetch();

    deleteReply = () => reply(500, { error: 'שגיאת שרת' });
    await act(async () => { await result.current.handleDeleteOrder(12); });
    expect(result.current.ordersError).toBe('שגיאת שרת');

    deleteReply = () => reply(200, { message: 'ההזמנה נמחקה' });
    await act(async () => { await result.current.handleDeleteOrder(12); });

    expect(confirm).toHaveBeenCalledWith(CONFIRM_TEXT);
    expect(deleteCalls()).toHaveLength(2);
    expect(deleteCalls()[1]).toEqual([ORDER_URL, { method: 'DELETE' }]);
    expect(result.current.ordersError).toBe('');
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  test.each([
    [401, 'נדרשת התחברות כמנהל'],
    [404, 'הזמנה 12 לא נמצאה'],
    [500, 'שגיאת שרת'],
  ])('a %i answer shows the server message as it is and does not reload', async (status, message) => {
    const result = await setupOverFetch();
    deleteReply = () => reply(status, { error: message });

    await act(async () => { await result.current.handleDeleteOrder(12); });

    expect(result.current.ordersError).toBe(message);
    expect(listCalls()).toHaveLength(1);
  });

  test.each([
    ['a body that is not JSON', undefined],
    ['a JSON body without a message', {}],
    ['a blank message', { error: '   ' }],
  ])('%s: shows the fallback message and does not reload', async (_label, body) => {
    const result = await setupOverFetch();
    deleteReply = () => reply(502, body);

    await act(async () => { await result.current.handleDeleteOrder(12); });

    expect(result.current.ordersError).toBe('מחיקת הזמנה #12 נכשלה.');
    expect(listCalls()).toHaveLength(1);
  });

  test('a network failure shows the network message and does not reload', async () => {
    const result = await setupOverFetch();
    deleteReply = () => Promise.reject(new TypeError('Failed to fetch'));

    await act(async () => { await result.current.handleDeleteOrder(12); });

    expect(result.current.ordersError).toBe(NETWORK_ERROR);
    expect(listCalls()).toHaveLength(1);
  });
});
