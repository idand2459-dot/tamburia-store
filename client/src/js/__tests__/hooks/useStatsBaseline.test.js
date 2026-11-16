/**
 * Tests for useStatsBaseline, pinned at the fetch level: the GET that loads the counting start,
 * the PUT that sets or clears it, the value the hook keeps (the one the server returns, not the
 * one it sent), and the error text for each failure. They record today's behavior.
 *
 * The hook is given the real admin API (createAdminApi) over the fake global fetch, with a
 * no-op expiry callback: the 401 handling is pinned in pages/admin/Admin.test.js and
 * services/adminService.test.js. Only this adapter changed when the hook moved to named
 * adminApi calls; the assertions did not.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStatsBaseline } from '../../hooks/useStatsBaseline';
import { createAdminApi } from '../../services/adminService';
import { NETWORK_ERROR } from '../../utils/apiErrors';

const URL_ = '/api/settings/stats-counting-from';
const SINCE = '2026-10-01T00:00:00.000Z';
const LOAD_FALLBACK = 'טעינת נקודת ההתחלה של הסיכומים נכשלה.';
const RESET_FALLBACK = 'איפוס הסיכומים נכשל.';
const CLEAR_FALLBACK = 'ביטול האיפוס נכשל.';

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

let getReply;
let putReply;

const getCalls = () => global.fetch.mock.calls.filter(([, o]) => !o);
const putCalls = () => global.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');

/** Renders the hook and waits for the first load to finish. */
async function setup() {
  const { result } = renderHook(() => useStatsBaseline(adminApi));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

beforeEach(() => {
  getReply = () => reply(200, { value: SINCE });
  putReply = () => reply(200, { value: SINCE });
  global.fetch = jest.fn((url, options) => {
    if (url !== URL_) throw new Error(`unexpected request: ${url}`);
    return options?.method === 'PUT' ? putReply() : getReply();
  });
});

afterEach(() => {
  delete global.fetch;
});

describe('loading the counting start', () => {
  test('GETs the setting with no options, keeps its value and stops loading', async () => {
    const { result } = renderHook(() => useStatsBaseline(adminApi));
    expect(result.current.loading).toBe(true);
    expect(result.current.since).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCalls()).toEqual([[URL_, undefined]]);
    expect(result.current.since).toBe(SINCE);
    expect(result.current.baselineError).toBe('');
  });

  test.each([
    ['null', { value: null }],
    ['a missing value', {}],
  ])('%s means no baseline: since is null and there is no error', async (_label, body) => {
    getReply = () => reply(200, body);

    const result = await setup();

    expect(result.current.since).toBeNull();
    expect(result.current.baselineError).toBe('');
  });

  test.each([
    ['the server message of a 401', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['the server message of a 500', 500, { error: 'שגיאת שרת' }, 'שגיאת שרת'],
    ['the fallback when there is no message', 500, {}, LOAD_FALLBACK],
    ['the fallback for a blank message', 500, { error: '  ' }, LOAD_FALLBACK],
    ['the fallback when the body is not JSON', 502, undefined, LOAD_FALLBACK],
  ])('a non-OK answer shows %s, keeps since null and still stops loading', async (_label, status, body, expected) => {
    getReply = () => reply(status, body);

    const result = await setup();

    expect(result.current.baselineError).toBe(expected);
    expect(result.current.since).toBeNull();
  });

  test('a network failure shows the network message and still stops loading', async () => {
    getReply = () => Promise.reject(new TypeError('Failed to fetch'));

    const result = await setup();

    expect(result.current.baselineError).toBe(NETWORK_ERROR);
    expect(result.current.since).toBeNull();
  });

  test('an OK answer whose body is not JSON shows the network message and still stops loading', async () => {
    getReply = () => reply(200, undefined);

    const result = await setup();

    expect(result.current.baselineError).toBe(NETWORK_ERROR);
    expect(result.current.since).toBeNull();
  });
});

describe('resetStats', () => {
  test('PUTs the current moment as an ISO string and keeps the value the server returned', async () => {
    getReply = () => reply(200, { value: null });
    putReply = () => reply(200, { value: 'normalized-by-the-server' });
    const result = await setup();

    const before = Date.now();
    await act(async () => { await result.current.resetStats(); });
    const after = Date.now();

    const puts = putCalls();
    expect(puts).toHaveLength(1);
    expect(puts[0][0]).toBe(URL_);
    expect(Object.keys(puts[0][1]).sort()).toEqual(['body', 'headers', 'method']);
    expect(puts[0][1].method).toBe('PUT');
    expect(puts[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    const sent = JSON.parse(puts[0][1].body);
    expect(Object.keys(sent)).toEqual(['value']);
    expect(new Date(sent.value).toISOString()).toBe(sent.value);
    expect(new Date(sent.value).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(sent.value).getTime()).toBeLessThanOrEqual(after);
    expect(result.current.since).toBe('normalized-by-the-server');
    expect(result.current.baselineError).toBe('');
  });

  test.each([
    ['the server message', 400, { error: 'ערך לא תקין' }, 'ערך לא תקין'],
    ['the fallback when there is no message', 500, {}, RESET_FALLBACK],
    ['the fallback when the body is not JSON', 502, undefined, RESET_FALLBACK],
  ])('a non-OK answer shows %s and leaves since as it was', async (_label, status, body, expected) => {
    putReply = () => reply(status, body);
    const result = await setup();

    await act(async () => { await result.current.resetStats(); });

    expect(result.current.baselineError).toBe(expected);
    expect(result.current.since).toBe(SINCE);
  });

  test('a network failure shows the network message and leaves since as it was', async () => {
    putReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    await act(async () => { await result.current.resetStats(); });

    expect(result.current.baselineError).toBe(NETWORK_ERROR);
    expect(result.current.since).toBe(SINCE);
  });

  test('an OK answer whose body is not JSON shows the network message and leaves since as it was', async () => {
    putReply = () => reply(200, undefined);
    const result = await setup();

    await act(async () => { await result.current.resetStats(); });

    expect(result.current.baselineError).toBe(NETWORK_ERROR);
    expect(result.current.since).toBe(SINCE);
  });

  test('a success clears an earlier error', async () => {
    putReply = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.resetStats(); });
    expect(result.current.baselineError).toBe('שגיאת שרת');

    putReply = () => reply(200, { value: SINCE });
    await act(async () => { await result.current.resetStats(); });

    expect(result.current.baselineError).toBe('');
  });
});

describe('clearBaseline', () => {
  test('PUTs value: null and keeps the null the server returned', async () => {
    putReply = () => reply(200, { value: null });
    const result = await setup();
    expect(result.current.since).toBe(SINCE);

    await act(async () => { await result.current.clearBaseline(); });

    expect(putCalls()).toHaveLength(1);
    expect(putCalls()[0][1]).toEqual({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: null }),
    });
    expect(result.current.since).toBeNull();
    expect(result.current.baselineError).toBe('');
  });

  test.each([
    ['the server message', 400, { error: 'ערך לא תקין' }, 'ערך לא תקין'],
    ['the fallback when there is no message', 500, {}, CLEAR_FALLBACK],
    ['the fallback when the body is not JSON', 502, undefined, CLEAR_FALLBACK],
  ])('a non-OK answer shows %s and leaves since as it was', async (_label, status, body, expected) => {
    putReply = () => reply(status, body);
    const result = await setup();

    await act(async () => { await result.current.clearBaseline(); });

    expect(result.current.baselineError).toBe(expected);
    expect(result.current.since).toBe(SINCE);
  });

  test('a network failure shows the network message and leaves since as it was', async () => {
    putReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    await act(async () => { await result.current.clearBaseline(); });

    expect(result.current.baselineError).toBe(NETWORK_ERROR);
    expect(result.current.since).toBe(SINCE);
  });
});
