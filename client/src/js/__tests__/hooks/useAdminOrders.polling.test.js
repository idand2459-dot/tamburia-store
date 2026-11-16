/**
 * The order polling in useAdminOrders: the baseline, new-order detection, the visibility pause,
 * recovery after a failure, the 401 stop, and the guards against overlapping and stale requests.
 *
 * The hook gets the real admin API over a fake global fetch; time is driven by Jest fake timers
 * and document.hidden is stubbed. Run with `npm run test:client` from the root.
 */
import { renderHook, act } from '@testing-library/react';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { createAdminApi } from '../../services/adminService';

const POLL_MS = 30000;
const order = (id, status = 'new') => ({ id, status, items: [{ name: 'א' }], picked_items: [] });

/** A fetch response; a body of `undefined` is one that is not JSON. */
const reply = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not json');
    return body;
  },
});

/** A promise settled by the test, to hold a request open. */
function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

let hidden;
let listReply;
let onNewOrder;

/** Every GET /api/orders the fake fetch has seen. */
const listCalls = () => global.fetch.mock.calls.filter(([url, options]) => url === '/api/orders' && !options);

/** Moves the clock and lets the requests it starts settle. */
const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

/** Hides or shows the tab, as the browser does. */
const setHidden = (value) => act(async () => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
});

/** Renders the hook and waits for the first load. */
async function setup(initial = [order(1), order(2)]) {
  listReply = () => reply(200, initial);
  const view = renderHook(() => useAdminOrders(createAdminApiOnce(), { onNewOrder }));
  // Flush the first load without moving the fake clock (waitFor would advance it).
  await act(async () => {});
  expect(view.result.current.orders).toHaveLength(initial.length);
  return view;
}

// One API object for the whole test, as Admin.js keeps (useMemo): a new one on every render
// would re-run the polling effect.
let sharedApi;
const createAdminApiOnce = () => sharedApi;

beforeEach(() => {
  jest.useFakeTimers();
  hidden = false;
  onNewOrder = jest.fn();
  sharedApi = createAdminApi(() => {});
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/orders' && !options) return listReply();
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  jest.useRealTimers();
  delete global.fetch;
  delete document.hidden;
});

describe('baseline and detection', () => {
  test('the first load sets the baseline: no sound, no confetti', async () => {
    const { result } = await setup();

    expect(onNewOrder).not.toHaveBeenCalled();
    expect(result.current.showConfetti).toBe(false);
  });

  test('a poll that finds the same orders announces nothing', async () => {
    const { result } = await setup();

    await advance(POLL_MS);
    await advance(POLL_MS);

    expect(listCalls()).toHaveLength(3);
    expect(onNewOrder).not.toHaveBeenCalled();
    expect(result.current.showConfetti).toBe(false);
  });

  test('a new order is announced once: sound, confetti, and the new count', async () => {
    const { result } = await setup();
    listReply = () => reply(200, [order(3), order(1), order(2, 'processing')]);

    await advance(POLL_MS);

    expect(onNewOrder).toHaveBeenCalledTimes(1);
    expect(result.current.showConfetti).toBe(true);
    expect(result.current.orders).toHaveLength(3);
    expect(result.current.orders.filter((o) => o.status === 'new')).toHaveLength(2);

    // The same list on the next polls is not a new order again.
    await advance(POLL_MS);
    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a delete together with a new order (same count) is still announced', async () => {
    await setup([order(1), order(2)]);
    listReply = () => reply(200, [order(3), order(2)]);

    await advance(POLL_MS);

    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a shorter list (an order deleted) is not a new order, and the deleted one is not new if it returns', async () => {
    const { result } = await setup([order(1), order(2)]);
    listReply = () => reply(200, [order(2)]);

    await advance(POLL_MS);
    expect(result.current.orders).toHaveLength(1);
    expect(onNewOrder).not.toHaveBeenCalled();

    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);
    expect(onNewOrder).not.toHaveBeenCalled();
  });

  test('an order found by a manual reload is announced once, and the next poll does not repeat it', async () => {
    const { result } = await setup();
    listReply = () => reply(200, [order(3), order(1), order(2)]);

    await act(async () => { await result.current.fetchOrders(); });
    expect(onNewOrder).toHaveBeenCalledTimes(1);

    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a first answer that is not a list does not set the baseline, so existing orders are not announced later', async () => {
    listReply = () => reply(500, { error: 'שגיאת שרת' });
    const { result } = renderHook(() => useAdminOrders(sharedApi, { onNewOrder }));
    await act(async () => {});
    expect(listCalls()).toHaveLength(1);

    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);

    expect(result.current.orders).toHaveLength(2);
    expect(onNewOrder).not.toHaveBeenCalled();
  });
});

describe('schedule and visibility', () => {
  test('polls every 30 seconds and not sooner', async () => {
    await setup();

    await advance(POLL_MS - 1);
    expect(listCalls()).toHaveLength(1);

    await advance(1);
    expect(listCalls()).toHaveLength(2);

    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(3);
  });

  test('a hidden tab does not poll; showing it refreshes at once and the schedule continues', async () => {
    await setup();

    await setHidden(true);
    await advance(10 * POLL_MS);
    expect(listCalls()).toHaveLength(1);

    listReply = () => reply(200, [order(1), order(2), order(3)]);
    await setHidden(false);
    expect(listCalls()).toHaveLength(2);
    expect(onNewOrder).toHaveBeenCalledTimes(1);

    await advance(POLL_MS - 1);
    expect(listCalls()).toHaveLength(2);
    await advance(1);
    expect(listCalls()).toHaveLength(3);
  });

  test('a tab that is hidden when the screen opens polls only after it is shown', async () => {
    hidden = true;
    const { result } = await setup();

    await advance(5 * POLL_MS);
    expect(listCalls()).toHaveLength(1);

    await setHidden(false);
    expect(listCalls()).toHaveLength(2);
    expect(result.current.orders).toHaveLength(2);
  });

  test('unmounting stops the timer and the listener', async () => {
    const { unmount } = await setup();

    unmount();
    await advance(5 * POLL_MS);
    await setHidden(true);
    await setHidden(false);

    expect(listCalls()).toHaveLength(1);
  });
});

describe('failures', () => {
  test.each([
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 with an error object', () => reply(500, { error: 'שגיאת שרת' })],
    ['a 502 that is not JSON', () => reply(502, undefined)],
  ])('%s keeps the list, shows no error, and the next tick recovers', async (_label, failing) => {
    const { result } = await setup();

    listReply = failing;
    await advance(POLL_MS);
    expect(result.current.orders).toHaveLength(2);
    expect(result.current.ordersError).toBe('');
    expect(onNewOrder).not.toHaveBeenCalled();

    listReply = () => reply(200, [order(1), order(2), order(3)]);
    await advance(POLL_MS);
    expect(result.current.orders).toHaveLength(3);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a 401 stops polling, keeps the list, and the tab coming back does not poll again', async () => {
    const { result } = await setup();

    listReply = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(2);
    expect(result.current.orders).toHaveLength(2);

    await advance(10 * POLL_MS);
    await setHidden(true);
    await setHidden(false);
    expect(listCalls()).toHaveLength(2);
  });

  test('a 401 calls the admin API handler once, through the real wrapper', async () => {
    const onUnauthorized = jest.fn();
    sharedApi = createAdminApi(onUnauthorized);
    await setup();

    listReply = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
    await advance(POLL_MS);
    await advance(10 * POLL_MS);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('overlap and stale answers', () => {
  test('no second request starts while one is open, on the timer or on becoming visible', async () => {
    await setup();
    const slow = deferred();
    listReply = () => slow.promise;

    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(2);

    await advance(5 * POLL_MS);
    await setHidden(true);
    await setHidden(false);
    expect(listCalls()).toHaveLength(2);

    await act(async () => { slow.resolve(await reply(200, [order(1), order(2)])); });
    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(3);
  });

  test('a tick is skipped while a manual request is open', async () => {
    const { result } = await setup();
    const slow = deferred();
    listReply = () => slow.promise;

    let manual;
    act(() => { manual = result.current.fetchOrders(); });
    expect(listCalls()).toHaveLength(2);

    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(2);

    await act(async () => { slow.resolve(await reply(200, [order(1), order(2)])); await manual; });
    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(3);
  });

  test('a slow poll answer does not overwrite the newer list of a manual reload', async () => {
    const { result } = await setup([order(1, 'new')]);
    const slowPoll = deferred();
    listReply = () => slowPoll.promise;

    await advance(POLL_MS);
    expect(listCalls()).toHaveLength(2);

    // The admin changes a status; the reload answers first, with the newer state.
    listReply = () => reply(200, [order(1, 'processing')]);
    await act(async () => { await result.current.fetchOrders(); });
    expect(result.current.orders[0].status).toBe('processing');

    // Then the old poll answers with the state from before the change.
    await act(async () => { slowPoll.resolve(await reply(200, [order(1, 'new')])); });
    expect(result.current.orders[0].status).toBe('processing');
  });
});

describe('what may set the baseline and the ids seen', () => {
  test('a first load that fails on the network does not set the baseline', async () => {
    listReply = () => Promise.reject(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAdminOrders(sharedApi, { onNewOrder }));
    await act(async () => {});
    expect(result.current.orders).toEqual([]);

    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);

    expect(result.current.orders).toHaveLength(2);
    expect(onNewOrder).not.toHaveBeenCalled();
  });

  test('a non-OK answer with a list body does not add to the ids seen, on a poll or a manual reload', async () => {
    const { result } = await setup([order(1)]);

    listReply = () => reply(500, [order(1), order(2)]);
    await advance(POLL_MS);
    await act(async () => { await result.current.fetchOrders(); });
    expect(onNewOrder).not.toHaveBeenCalled();

    // The order is announced only when an OK answer shows it.
    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a poll answer dropped as stale is announced once, by the newer manual answer', async () => {
    const { result } = await setup([order(1)]);
    const slowPoll = deferred();
    listReply = () => slowPoll.promise;
    await advance(POLL_MS);

    listReply = () => reply(200, [order(1), order(2)]);
    await act(async () => { await result.current.fetchOrders(); });
    expect(onNewOrder).toHaveBeenCalledTimes(1);

    await act(async () => { slowPoll.resolve(await reply(200, [order(1), order(2)])); });
    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  test('a poll answer dropped as stale loses nothing when the newer request fails: the next poll announces it once', async () => {
    const { result } = await setup([order(1)]);
    const slowPoll = deferred();
    listReply = () => slowPoll.promise;
    await advance(POLL_MS);

    listReply = () => Promise.reject(new TypeError('Failed to fetch'));
    await act(async () => { await result.current.fetchOrders(); });
    await act(async () => { slowPoll.resolve(await reply(200, [order(1), order(2)])); });
    expect(onNewOrder).not.toHaveBeenCalled();

    listReply = () => reply(200, [order(1), order(2)]);
    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
    await advance(POLL_MS);
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });
});
