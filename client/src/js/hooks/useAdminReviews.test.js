/**
 * Tests for useAdminReviews, pinned at the fetch level: the exact request each action sends,
 * the error text it keeps, and when it reloads the list. They record today's behavior,
 * imperfections included: the list is loaded by a fire-and-forget chain, so a non-OK answer
 * that carries a JSON object empties the list, while a network failure or a body that is not
 * JSON leaves it as it was. Neither shows an error.
 *
 * The hook is given the real admin API (createAdminApi) over the fake global fetch, with a
 * no-op expiry callback: the 401 handling is pinned in pages/admin/Admin.test.js and
 * services/adminService.test.js. Only this adapter changed when the hook moved to named
 * adminApi calls; the assertions did not.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminReviews } from './useAdminReviews';
import { createAdminApi } from '../services/adminService';
import { NETWORK_ERROR } from '../utils/apiErrors';

const LIST_URL = '/api/reviews/all';
const REVIEW = { id: 5, author: 'דנה', rating: 5, approved: false };
const SECOND = { id: 6, author: 'יוסי', rating: 4, approved: true };

/** A fetch response; a body of `undefined` is one that is not JSON. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

/** The hook's argument: the real admin API over the global fetch. */
const adminApi = createAdminApi(() => {});

let routes;
let confirm;

const callsTo = (url, method) => global.fetch.mock.calls.filter(([u, o]) => (
  u === url && (method === undefined || (o?.method || 'GET') === method)
));
const listCalls = () => callsTo(LIST_URL);

/** Renders the hook and waits for the first list. */
async function setup() {
  const { result } = renderHook(() => useAdminReviews(adminApi));
  await waitFor(() => expect(result.current.reviews).toHaveLength(1));
  return result;
}

/** Loads the list again and lets the chain settle. */
async function reload(result, expectedCalls) {
  await act(async () => { result.current.fetchReviews(); });
  await waitFor(() => expect(listCalls()).toHaveLength(expectedCalls));
  await act(async () => {});
}

beforeEach(() => {
  routes = {
    list: () => reply(200, [REVIEW]),
    approve: () => reply(200, {}),
    remove: () => reply(200, {}),
  };
  confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn((url, options) => {
    const method = options?.method || 'GET';
    if (url === LIST_URL) return routes.list();
    if (url === '/api/reviews/5/approve' && method === 'PUT') return routes.approve();
    if (url === '/api/reviews/5' && method === 'DELETE') return routes.remove();
    throw new Error(`unexpected request: ${method} ${url}`);
  });
});

afterEach(() => {
  confirm.mockRestore();
  delete global.fetch;
});

describe('loading the list', () => {
  test('GETs /api/reviews/all with no options, so unapproved reviews are included', async () => {
    const result = await setup();

    expect(listCalls()).toHaveLength(1);
    expect(listCalls()[0][1]).toBeUndefined();
    expect(result.current.reviews).toEqual([REVIEW]);
    expect(result.current.reviewsError).toBe('');

    routes.list = () => reply(200, [REVIEW, SECOND]);
    await reload(result, 2);
    expect(result.current.reviews).toEqual([REVIEW, SECOND]);
  });

  test.each([
    ['a non-OK answer with an error object (401)', 401, { error: 'נדרשת התחברות כמנהל' }],
    ['a non-OK answer with an error object (500)', 500, { error: 'שגיאת שרת' }],
    ['an OK answer that is an object', 200, { reviews: [REVIEW] }],
    ['an OK answer that is null', 200, null],
  ])('%s: the list becomes empty and no error is shown', async (_label, status, body) => {
    const result = await setup();
    routes.list = () => reply(status, body);

    await reload(result, 2);

    expect(result.current.reviews).toEqual([]);
    expect(result.current.reviewsError).toBe('');
  });

  test.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an OK answer whose body is not JSON', () => reply(200, undefined)],
    ['a non-OK answer whose body is not JSON (a proxy page)', () => reply(502, undefined)],
  ])('%s: the list stays as it was and no error is shown', async (_label, failing) => {
    const result = await setup();
    routes.list = failing;

    await reload(result, 2);

    expect(result.current.reviews).toEqual([REVIEW]);
    expect(result.current.reviewsError).toBe('');
  });
});

describe('approveReview', () => {
  test('sends the PUT with approved: true, reloads the list on success and clears an earlier error', async () => {
    routes.approve = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.approveReview(5); });
    expect(result.current.reviewsError).toBe('שגיאת שרת');

    routes.approve = () => reply(200, {});
    routes.list = () => reply(200, [{ ...REVIEW, approved: true }]);
    await act(async () => { await result.current.approveReview(5); });

    const puts = callsTo('/api/reviews/5/approve', 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[1][1]).toEqual({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    expect(result.current.reviewsError).toBe('');
    await waitFor(() => expect(result.current.reviews).toEqual([{ ...REVIEW, approved: true }]));
    expect(listCalls()).toHaveLength(2);
  });

  test.each([
    ['a 401 answer shows the server message', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['a 404 answer shows the server message', 404, { error: 'ביקורת 5 לא נמצאה' }, 'ביקורת 5 לא נמצאה'],
    ['a body that is not JSON shows the fallback', 502, undefined, 'אישור הביקורת נכשל.'],
    ['a JSON body without a message shows the fallback', 500, {}, 'אישור הביקורת נכשל.'],
    ['a blank message shows the fallback', 500, { error: '   ' }, 'אישור הביקורת נכשל.'],
  ])('%s and does not reload', async (_label, status, body, expected) => {
    routes.approve = () => reply(status, body);
    const result = await setup();

    await act(async () => { await result.current.approveReview(5); });

    expect(result.current.reviewsError).toBe(expected);
    expect(listCalls()).toHaveLength(1);
  });

  test('a network failure shows the network message and does not reload', async () => {
    routes.approve = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    await act(async () => { await result.current.approveReview(5); });

    expect(result.current.reviewsError).toBe(NETWORK_ERROR);
    expect(listCalls()).toHaveLength(1);
  });
});

describe('deleteReview', () => {
  test('when the admin cancels the confirmation nothing is sent', async () => {
    confirm.mockReturnValue(false);
    const result = await setup();

    await act(async () => { await result.current.deleteReview(5); });

    expect(confirm).toHaveBeenCalledWith('למחוק ביקורת?');
    expect(callsTo('/api/reviews/5')).toHaveLength(0);
    expect(listCalls()).toHaveLength(1);
  });

  test('sends the DELETE after confirmation, reloads the list on success and clears an earlier error', async () => {
    routes.remove = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.deleteReview(5); });
    expect(result.current.reviewsError).toBe('שגיאת שרת');

    routes.remove = () => reply(200, {});
    routes.list = () => reply(200, []);
    await act(async () => { await result.current.deleteReview(5); });

    const deletes = callsTo('/api/reviews/5', 'DELETE');
    expect(deletes).toHaveLength(2);
    expect(deletes[1]).toEqual(['/api/reviews/5', { method: 'DELETE' }]);
    expect(result.current.reviewsError).toBe('');
    await waitFor(() => expect(result.current.reviews).toEqual([]));
    expect(listCalls()).toHaveLength(2);
  });

  test.each([
    ['a 401 answer shows the server message', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['a 404 answer shows the server message', 404, { error: 'ביקורת 5 לא נמצאה' }, 'ביקורת 5 לא נמצאה'],
    ['a body that is not JSON shows the fallback', 502, undefined, 'מחיקת הביקורת נכשלה.'],
    ['a JSON body without a message shows the fallback', 500, {}, 'מחיקת הביקורת נכשלה.'],
    ['a blank message shows the fallback', 500, { error: '   ' }, 'מחיקת הביקורת נכשלה.'],
  ])('%s and does not reload', async (_label, status, body, expected) => {
    routes.remove = () => reply(status, body);
    const result = await setup();

    await act(async () => { await result.current.deleteReview(5); });

    expect(result.current.reviewsError).toBe(expected);
    expect(listCalls()).toHaveLength(1);
  });

  test('a network failure shows the network message and does not reload', async () => {
    routes.remove = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    await act(async () => { await result.current.deleteReview(5); });

    expect(result.current.reviewsError).toBe(NETWORK_ERROR);
    expect(listCalls()).toHaveLength(1);
  });
});
