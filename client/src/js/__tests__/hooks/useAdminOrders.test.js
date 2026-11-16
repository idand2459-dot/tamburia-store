/**
 * בדיקות לסימון ברשימת הליקוט ב-useAdminOrders: העדכון האופטימי,
 * וההחזרה של השורה בלבד כשהשמירה נכשלה.
 *
 * The 30-second polling is pinned in useAdminOrders.polling.test.js.
 *
 * מריצים עם `npm run test:client` מהשורש.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { createAdminApi } from '../../services/adminService';
import { NETWORK_ERROR } from '../../utils/apiErrors';

const ORDER = { id: 12, status: 'processing', items: [{ name: 'א' }, { name: 'ב' }], picked_items: [0] };

/**
 * fetch מזויף: GET מחזיר את ההזמנה, וה-PUT מחכה עד שהבדיקה
 * מחליטה איך הוא ייגמר — כך אפשר לראות את המסך באמצע השמירה.
 * ההוק מקבל את ה-API האמיתי של הניהול מעל ה-fetch הזה; `api` הוא
 * ה-fetch המזויף עצמו, ולכן ההצהרות על הבקשות נשארו כמות שהיו.
 */
function fakeApi() {
  let settle;
  const api = jest.fn((_url, options) => {
    if (!options) return Promise.resolve({ ok: true, json: async () => [ORDER] });
    return new Promise((resolve, reject) => { settle = { resolve, reject }; });
  });
  global.fetch = api;
  return { api, adminApi: createAdminApi(() => {}), settle: () => settle };
}

/** מרנדר את ההוק ומחכה שההזמנה תיטען. */
async function setup() {
  const fake = fakeApi();
  const { result } = renderHook(() => useAdminOrders(fake.adminApi));
  await waitFor(() => expect(result.current.orders).toHaveLength(1));
  return { ...fake, result };
}

const pickedOf = (result) => result.current.orders[0].picked_items;

afterEach(() => {
  delete global.fetch;
});

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
 * screen shows afterwards. The hook is given the real admin API (createAdminApi) over the fake
 * global fetch (no 401 handling: that is pinned in Admin.test.js and adminService.test.js).
 * When the admin API layer was introduced, only `adminApi` changed; the assertions below keep describing the same
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

/** The hook's argument: the real admin API over the global fetch (adapter changed in P2; assertions did not). */
const adminApi = createAdminApi(() => {});

/** The list loads the fake fetch has seen (a GET with no options). */
const listCalls = () => global.fetch.mock.calls.filter(([url, options]) => url === '/api/orders' && !options);

/** Renders the hook with the fake fetch and waits for the first load. */
async function setupOverFetch() {
  const { result } = renderHook(() => useAdminOrders(adminApi));
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

/*
 * loadOrders, pinned through the `fetchOrders` the hook returns. These record what the code
 * does today, imperfections included: it never looks at the status, only at whether the body
 * is an array. A non-OK answer with a JSON object therefore empties the list, while a failure
 * to get or read an answer at all leaves the list as it was. Neither shows an error.
 */
describe('loadOrders (fetch level)', () => {
  const SECOND = { id: 13, status: 'new', items: [{ name: 'ג' }], picked_items: [] };
  let listReply;

  beforeEach(() => {
    listReply = () => reply(200, [ORDER]);
    global.fetch = jest.fn((url, options) => {
      if (url === '/api/orders' && !options) return listReply();
      throw new Error(`unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  /** Loads the list again, the way the status change and the delete do. */
  const reload = (result) => act(async () => { await result.current.fetchOrders(); });

  test('loads an array of orders from GET /api/orders, with no options, and shows no error', async () => {
    const result = await setupOverFetch();

    const [firstUrl, firstOptions] = global.fetch.mock.calls[0];
    expect(firstUrl).toBe('/api/orders');
    expect(firstOptions).toBeUndefined();
    expect(result.current.orders).toEqual([ORDER]);
    expect(result.current.ordersError).toBe('');

    listReply = () => reply(200, [ORDER, SECOND]);
    await reload(result);
    expect(result.current.orders).toEqual([ORDER, SECOND]);
  });

  test.each([
    ['a non-OK answer with an error object (401)', 401, { error: 'נדרשת התחברות כמנהל' }],
    ['a non-OK answer with an error object (500)', 500, { error: 'שגיאת שרת' }],
    ['an OK answer that is an object', 200, { orders: [ORDER] }],
    ['an OK answer that is null', 200, null],
    ['an OK answer that is a string', 200, 'שגיאה'],
  ])('%s: the list becomes empty and no error is shown', async (_label, status, body) => {
    const result = await setupOverFetch();
    listReply = () => reply(status, body);

    await reload(result);

    expect(result.current.orders).toEqual([]);
    expect(result.current.ordersError).toBe('');
  });

  test.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an OK answer whose body is not JSON', () => reply(200, undefined)],
    ['a non-OK answer whose body is not JSON (a proxy page)', () => reply(502, undefined)],
  ])('%s: the list stays as it was and no error is shown', async (_label, failing) => {
    const result = await setupOverFetch();
    listReply = failing;

    await reload(result);

    expect(result.current.orders).toEqual([ORDER]);
    expect(result.current.ordersError).toBe('');
  });
});

/*
 * togglePicked, pinned at the fetch level: the exact request and what it returns. The optimistic
 * update and the rollback are pinned by the first tests in this file; here the rollback is
 * checked against the real request/answer shapes. The message is returned, not stored: the
 * pick list shows it next to the line that was clicked.
 */
describe('togglePicked (fetch level)', () => {
  const PICK_URL = '/api/orders/12/items/1/picked';
  const FALLBACK = 'הסימון לא נשמר. נסה שוב.';
  let pickReply;

  const pickCalls = () => global.fetch.mock.calls.filter(([url]) => url === PICK_URL);

  beforeEach(() => {
    pickReply = () => reply(200, {});
    global.fetch = jest.fn((url, options) => {
      if (url === '/api/orders' && !options) return reply(200, [ORDER]);
      if (url.startsWith('/api/orders/12/items/')) return pickReply();
      throw new Error(`unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  /** Clicks a line and returns what togglePicked returned. */
  const toggle = async (result, line, picked) => {
    let message;
    await act(async () => { message = await result.current.togglePicked(12, line, picked); });
    return message;
  };

  test('sends the PUT with a JSON body, returns null, keeps the mark and does not reload the list', async () => {
    const result = await setupOverFetch();

    const message = await toggle(result, 1, true);

    expect(pickCalls()).toHaveLength(1);
    expect(pickCalls()[0][1]).toEqual({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picked: true }),
    });
    expect(message).toBeNull();
    expect(pickedOf(result)).toEqual([0, 1]);
    expect(listCalls()).toHaveLength(1);
  });

  test('un-marking sends picked: false', async () => {
    const result = await setupOverFetch();

    await toggle(result, 1, false);

    expect(pickCalls()[0][1].body).toBe(JSON.stringify({ picked: false }));
  });

  test.each([
    ['a 401 answer', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['a 404 answer', 404, { error: 'הזמנה 12 לא נמצאה' }, 'הזמנה 12 לא נמצאה'],
    ['a 400 answer', 400, { error: 'שורה לא קיימת' }, 'שורה לא קיימת'],
  ])('%s returns the server message and rolls the line back', async (_label, status, body, expected) => {
    pickReply = () => reply(status, body);
    const result = await setupOverFetch();

    const message = await toggle(result, 1, true);

    expect(message).toBe(expected);
    expect(pickedOf(result)).toEqual([0]);
    expect(listCalls()).toHaveLength(1);
  });

  test.each([
    ['a body that is not JSON', undefined],
    ['a JSON body without a message', {}],
    ['a blank message', { error: '   ' }],
  ])('%s: returns the fallback message and rolls the line back', async (_label, body) => {
    pickReply = () => reply(500, body);
    const result = await setupOverFetch();

    const message = await toggle(result, 1, true);

    expect(message).toBe(FALLBACK);
    expect(pickedOf(result)).toEqual([0]);
  });

  test('a network failure returns the network message and rolls the line back', async () => {
    pickReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setupOverFetch();

    const message = await toggle(result, 1, true);

    expect(message).toBe(NETWORK_ERROR);
    expect(pickedOf(result)).toEqual([0]);
  });

  test('a failed un-mark puts the mark back', async () => {
    pickReply = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setupOverFetch();

    const message = await toggle(result, 0, false);

    expect(global.fetch).toHaveBeenLastCalledWith('/api/orders/12/items/0/picked', expect.anything());
    expect(message).toBe('שגיאת שרת');
    expect(pickedOf(result)).toEqual([0]);
  });
});
