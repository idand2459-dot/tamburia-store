/**
 * Pins useAvailability as it behaves today: it asks the server once for all the ids of the cart,
 * and returns the ids the answer does not contain. Written before the availability moved to the
 * Redux store (P4R); the assertions stay when it moves, only the way the test reaches it changes.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAvailability } from './useAvailability';

/** A fetch response. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let inCatalog;
let answer;

const askedUrls = () => global.fetch.mock.calls.map(([url]) => url);

beforeEach(() => {
  inCatalog = [];
  answer = (url) => {
    const asked = decodeURIComponent(url.split('ids=')[1]).split(',').map(Number);
    const products = asked.filter((id) => inCatalog.includes(id)).map((id) => ({ id }));
    return reply(200, { products, pagination: { total: products.length } });
  };
  global.fetch = jest.fn((url) => answer(url));
});

afterEach(() => {
  delete global.fetch;
});

test('asks once for the sorted, de-duplicated ids and returns the ones missing from the answer', async () => {
  inCatalog = [3];

  const { result } = renderHook(() => useAvailability([5, 3, 3, 1]));

  await waitFor(() => expect([...result.current]).toEqual([1, 5]));
  expect(askedUrls()).toEqual(['/api/products?ids=1%2C3%2C5']);
  expect(global.fetch.mock.calls[0][1]).toEqual({ signal: expect.any(AbortSignal) });
});

test('returns an empty set when every id is in the catalog', async () => {
  inCatalog = [1, 2];

  const { result } = renderHook(() => useAvailability([1, 2]));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(result.current.size).toBe(0);
});

test.each([
  ['an empty list', []],
  ['no list', undefined],
  ['only falsy ids', [0, null, undefined]],
])('makes no request for %s and returns an empty set', async (_label, ids) => {
  const { result } = renderHook(() => useAvailability(ids));
  await act(async () => {});

  expect(global.fetch).not.toHaveBeenCalled();
  expect(result.current.size).toBe(0);
});

test('asks about at most 100 ids: the first 100 of the list as given, then sorted', async () => {
  const ids = Array.from({ length: 120 }, (_, i) => 120 - i);

  renderHook(() => useAvailability(ids));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  const asked = decodeURIComponent(askedUrls()[0].split('ids=')[1]).split(',').map(Number);
  expect(asked).toHaveLength(100);
  expect(asked[0]).toBe(21);
  expect(asked[99]).toBe(120);
});

test('a new array with the same ids does not ask again', async () => {
  inCatalog = [1];
  const { rerender } = renderHook(({ ids }) => useAvailability(ids), { initialProps: { ids: [1, 2] } });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  rerender({ ids: [2, 1] });
  await act(async () => {});

  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('different ids ask again, abort the earlier request, and replace the result', async () => {
  inCatalog = [];
  const { result, rerender } = renderHook(({ ids }) => useAvailability(ids), { initialProps: { ids: [1] } });
  await waitFor(() => expect([...result.current]).toEqual([1]));
  const firstSignal = global.fetch.mock.calls[0][1].signal;

  inCatalog = [2];
  rerender({ ids: [2] });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  await act(async () => {});

  expect(firstSignal.aborted).toBe(true);
  expect(askedUrls()[1]).toBe('/api/products?ids=2');
  expect([...result.current]).toEqual([]);
});

test('emptying the list clears the result without asking', async () => {
  const { result, rerender } = renderHook(({ ids }) => useAvailability(ids), { initialProps: { ids: [1] } });
  await waitFor(() => expect([...result.current]).toEqual([1]));

  rerender({ ids: [] });
  await act(async () => {});

  expect(result.current.size).toBe(0);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([
  ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ['a server error', () => reply(500, { error: 'שגיאת שרת' })],
])('%s keeps the previous result and does not throw', async (_label, failing) => {
  inCatalog = [];
  const { result, rerender } = renderHook(({ ids }) => useAvailability(ids), { initialProps: { ids: [1] } });
  await waitFor(() => expect([...result.current]).toEqual([1]));

  answer = failing;
  rerender({ ids: [1, 2] });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  await act(async () => {});

  expect([...result.current]).toEqual([1]);
});

test('unmounting aborts the request in flight', async () => {
  answer = () => new Promise(() => {});
  const { unmount } = renderHook(() => useAvailability([1]));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const { signal } = global.fetch.mock.calls[0][1];

  unmount();

  expect(signal.aborted).toBe(true);
});
