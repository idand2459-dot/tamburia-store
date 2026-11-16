/**
 * The 20-second limit on an order request, and what tells a timeout from a refusal.
 *
 * A timeout is not a failure the server confirmed: it may have created the order and only the answer
 * is missing. So it is its own error (TimeoutError), never an ApiError, and the checkout treats
 * everything that is not a 4xx ApiError as an unknown outcome.
 */
import { createOrder, ApiError, TimeoutError, ORDER_TIMEOUT_MS } from '../../services/orderService';
import { postJson } from '../../services/http';

/** A fetch that never answers and rejects the way a real one does when its signal aborts. */
function hangingFetch() {
  return jest.fn((url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => {
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    });
  }));
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  delete global.fetch;
});

describe('createOrder timeout', () => {
  test('the limit is 20 seconds', () => {
    expect(ORDER_TIMEOUT_MS).toBe(20_000);
  });

  test('a request that is not answered in time is cut and throws a TimeoutError, not an ApiError', async () => {
    global.fetch = hangingFetch();

    const result = createOrder({ items: [] }).catch((error) => error);
    jest.advanceTimersByTime(19_999);
    await Promise.resolve();
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);

    jest.advanceTimersByTime(1);
    const error = await result;

    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('TimeoutError');
    expect(error.timeoutMs).toBe(20_000);
  });

  test('an answer in time is returned and the timer is cleared', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 5 }) }));

    await expect(createOrder({ items: [] })).resolves.toEqual({ id: 5 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a refusal in time is an ApiError and clears the timer', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'לא תקין' }) }));

    const error = await createOrder({ items: [] }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a network failure keeps its own error and clears the timer', async () => {
    const failure = new TypeError('Failed to fetch');
    global.fetch = jest.fn(() => Promise.reject(failure));

    const error = await createOrder({ items: [] }).catch((e) => e);

    expect(error).toBe(failure);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a body that arrives too slowly counts as a timeout as well', async () => {
    let started;
    global.fetch = jest.fn((url, options) => Promise.resolve({
      ok: true,
      status: 201,
      json: () => new Promise((_, reject) => {
        started = true;
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    }));

    const result = createOrder({ items: [] }).catch((error) => error);
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toBe(true);
    jest.advanceTimersByTime(20_000);

    expect(await result).toBeInstanceOf(TimeoutError);
  });
});

describe('postJson without a timeout', () => {
  test('passes the caller\'s signal through untouched and sets no timer', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));

    await postJson('/x', {}, { signal: controller.signal });

    expect(global.fetch.mock.calls[0][1].signal).toBe(controller.signal);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('the caller can still cancel a request that has a timeout, and that is not a TimeoutError', async () => {
    global.fetch = hangingFetch();
    const controller = new AbortController();

    const result = postJson('/x', {}, { signal: controller.signal, timeoutMs: 20_000 }).catch((error) => error);
    controller.abort();
    const error = await result;

    expect(error.name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(TimeoutError);
    expect(jest.getTimerCount()).toBe(0);
  });
});
