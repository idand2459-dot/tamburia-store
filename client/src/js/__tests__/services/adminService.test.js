/**
 * Unit tests for createAdminApi(...).request with a fake fetch: it passes the call through
 * untouched, calls onUnauthorized for a 401 only, and returns the same response. The screen-level
 * behavior (the message after a 401, the call order) is pinned in pages/admin/Admin.test.js.
 *
 * Run with `npm run test:client` from the root.
 */
import { createAdminApi } from '../../services/adminService';

const response = (status) => ({ ok: status >= 200 && status < 300, status });

afterEach(() => {
  delete global.fetch;
});

test('passes the url and options to fetch unchanged and returns the very same response', async () => {
  const res = response(200);
  global.fetch = jest.fn(() => Promise.resolve(res));
  const onUnauthorized = jest.fn();
  const options = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' };

  const returned = await createAdminApi(onUnauthorized).request('/api/orders/1/status', options);

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0]).toHaveLength(2);
  expect(global.fetch.mock.calls[0][0]).toBe('/api/orders/1/status');
  expect(global.fetch.mock.calls[0][1]).toBe(options);
  expect(returned).toBe(res);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('a call with no options reaches fetch with undefined options', async () => {
  global.fetch = jest.fn(() => Promise.resolve(response(200)));

  await createAdminApi(jest.fn()).request('/api/orders');

  expect(global.fetch).toHaveBeenCalledWith('/api/orders', undefined);
});

test('a 401 calls onUnauthorized once, after fetch answered and before the caller gets the response', async () => {
  const res = response(401);
  const events = [];
  global.fetch = jest.fn(() => { events.push('fetch'); return Promise.resolve(res); });
  const onUnauthorized = jest.fn(() => { events.push('expired'); });

  const pending = createAdminApi(onUnauthorized).request('/api/orders');
  pending.then(() => events.push('caller'));
  const returned = await pending;
  await Promise.resolve();

  expect(returned).toBe(res);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(onUnauthorized).toHaveBeenCalledWith();
  expect(events).toEqual(['fetch', 'expired', 'caller']);
});

test.each([200, 201, 400, 403, 404, 409, 500, 502])('a %s answer does not call onUnauthorized', async (status) => {
  global.fetch = jest.fn(() => Promise.resolve(response(status)));
  const onUnauthorized = jest.fn();

  await createAdminApi(onUnauthorized).request('/api/orders');

  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('every 401 calls it again', async () => {
  global.fetch = jest.fn(() => Promise.resolve(response(401)));
  const onUnauthorized = jest.fn();
  const { request } = createAdminApi(onUnauthorized);

  await request('/api/orders');
  await request('/api/products?active=all');

  expect(onUnauthorized).toHaveBeenCalledTimes(2);
});

test('a network failure rejects with the same error and does not call onUnauthorized', async () => {
  const failure = new TypeError('Failed to fetch');
  global.fetch = jest.fn(() => Promise.reject(failure));
  const onUnauthorized = jest.fn();

  await expect(createAdminApi(onUnauthorized).request('/api/orders')).rejects.toBe(failure);

  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('a callback that throws makes the call reject, as the inline wrapper did', async () => {
  global.fetch = jest.fn(() => Promise.resolve(response(401)));
  const boom = new Error('boom');

  await expect(createAdminApi(() => { throw boom; }).request('/api/orders')).rejects.toBe(boom);
});

test('without a callback a 401 is simply returned', async () => {
  const res = response(401);
  global.fetch = jest.fn(() => Promise.resolve(res));

  await expect(createAdminApi().request('/api/orders')).resolves.toBe(res);
});

test('request uses the fetch that exists when it is called, not the one at creation time', async () => {
  const api = createAdminApi(jest.fn());
  global.fetch = jest.fn(() => Promise.resolve(response(200)));

  await api.request('/api/orders');

  expect(global.fetch).toHaveBeenCalledTimes(1);
});

describe('reviews', () => {
  test('getReviews GETs /api/reviews/all with no options and returns the raw response', async () => {
    const res = response(200);
    global.fetch = jest.fn(() => Promise.resolve(res));

    const returned = await createAdminApi(jest.fn()).getReviews();

    expect(global.fetch).toHaveBeenCalledWith('/api/reviews/all', undefined);
    expect(returned).toBe(res);
  });

  test('approveReview PUTs approved: true as JSON to the review', async () => {
    global.fetch = jest.fn(() => Promise.resolve(response(200)));

    await createAdminApi(jest.fn()).approveReview(5);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('/api/reviews/5/approve');
    expect(global.fetch.mock.calls[0][1]).toEqual({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"approved":true}',
    });
  });

  test('deleteReview sends a bare DELETE to the review', async () => {
    global.fetch = jest.fn(() => Promise.resolve(response(200)));

    await createAdminApi(jest.fn()).deleteReview(5);

    expect(global.fetch).toHaveBeenCalledWith('/api/reviews/5', { method: 'DELETE' });
    expect(global.fetch.mock.calls[0][1]).toEqual({ method: 'DELETE' });
  });

  test.each([
    ['getReviews', (api) => api.getReviews()],
    ['approveReview', (api) => api.approveReview(5)],
    ['deleteReview', (api) => api.deleteReview(5)],
  ])('%s calls onUnauthorized on a 401 and still returns that response', async (_name, call) => {
    const res = response(401);
    global.fetch = jest.fn(() => Promise.resolve(res));
    const onUnauthorized = jest.fn();

    const returned = await call(createAdminApi(onUnauthorized));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(returned).toBe(res);
  });

  test.each([
    ['getReviews', (api) => api.getReviews()],
    ['approveReview', (api) => api.approveReview(5)],
    ['deleteReview', (api) => api.deleteReview(5)],
  ])('%s rejects on a network failure and does not call onUnauthorized', async (_name, call) => {
    const failure = new TypeError('Failed to fetch');
    global.fetch = jest.fn(() => Promise.reject(failure));
    const onUnauthorized = jest.fn();

    await expect(call(createAdminApi(onUnauthorized))).rejects.toBe(failure);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('orders, settings and products', () => {
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const lastCall = () => global.fetch.mock.calls[0];

  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve(response(200)));
  });

  test.each([
    ['getOrders', (api) => api.getOrders(), '/api/orders', undefined],
    ['updateOrderStatus', (api) => api.updateOrderStatus(12, 'processing'), '/api/orders/12/status',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"status":"processing"}' }],
    ['setOrderLinePicked (mark)', (api) => api.setOrderLinePicked(12, 1, true), '/api/orders/12/items/1/picked',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"picked":true}' }],
    ['setOrderLinePicked (clear)', (api) => api.setOrderLinePicked(12, 0, false), '/api/orders/12/items/0/picked',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"picked":false}' }],
    ['deleteOrder', (api) => api.deleteOrder(12), '/api/orders/12', { method: 'DELETE' }],
    ['getSetting', (api) => api.getSetting('stats-counting-from'), '/api/settings/stats-counting-from', undefined],
    ['saveSetting (a value)', (api) => api.saveSetting('stats-counting-from', '2026-10-01T00:00:00.000Z'),
      '/api/settings/stats-counting-from',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"value":"2026-10-01T00:00:00.000Z"}' }],
    ['saveSetting (null clears)', (api) => api.saveSetting('stats-counting-from', null),
      '/api/settings/stats-counting-from', { method: 'PUT', headers: JSON_HEADERS, body: '{"value":null}' }],
    ['getProducts', (api) => api.getProducts(), '/api/products?active=all', undefined],
    ['createProduct', (api) => api.createProduct({ name: 'א', price: 5 }), '/api/products',
      { method: 'POST', headers: JSON_HEADERS, body: '{"name":"א","price":5}' }],
    ['updateProduct', (api) => api.updateProduct(7, { name: 'ב' }), '/api/products/7',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"name":"ב"}' }],
    ['patchProduct', (api) => api.patchProduct(7, { in_stock: false }), '/api/products/7',
      { method: 'PUT', headers: JSON_HEADERS, body: '{"in_stock":false}' }],
    ['deleteProduct', (api) => api.deleteProduct(7), '/api/products/7', { method: 'DELETE' }],
  ])('%s sends exactly this request', async (_name, call, url, options) => {
    await call(createAdminApi(jest.fn()));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(lastCall()[0]).toBe(url);
    if (options === undefined) expect(lastCall()[1]).toBeUndefined();
    else expect(lastCall()[1]).toEqual(options);
  });

  test('uploadProductImages POSTs the files as "images" form data with no Content-Type', async () => {
    const files = [new File(['a'], 'a.png'), new File(['b'], 'b.png')];

    await createAdminApi(jest.fn()).uploadProductImages(files);

    expect(lastCall()[0]).toBe('/api/upload-multiple');
    expect(Object.keys(lastCall()[1]).sort()).toEqual(['body', 'method']);
    expect(lastCall()[1].method).toBe('POST');
    expect(lastCall()[1].body).toBeInstanceOf(FormData);
    expect(lastCall()[1].body.getAll('images')).toEqual(files);
    expect([...lastCall()[1].body.keys()]).toEqual(['images', 'images']);
  });

  test.each([
    ['getOrders', (api) => api.getOrders()],
    ['updateOrderStatus', (api) => api.updateOrderStatus(12, 'new')],
    ['setOrderLinePicked', (api) => api.setOrderLinePicked(12, 1, true)],
    ['deleteOrder', (api) => api.deleteOrder(12)],
    ['getSetting', (api) => api.getSetting('k')],
    ['saveSetting', (api) => api.saveSetting('k', null)],
    ['getProducts', (api) => api.getProducts()],
    ['uploadProductImages', (api) => api.uploadProductImages([new File(['a'], 'a.png')])],
    ['createProduct', (api) => api.createProduct({})],
    ['updateProduct', (api) => api.updateProduct(7, {})],
    ['patchProduct', (api) => api.patchProduct(7, {})],
    ['deleteProduct', (api) => api.deleteProduct(7)],
  ])('%s calls onUnauthorized on a 401 and returns that response; a network failure rejects without it', async (_name, call) => {
    const res = response(401);
    global.fetch = jest.fn(() => Promise.resolve(res));
    const onUnauthorized = jest.fn();
    expect(await call(createAdminApi(onUnauthorized))).toBe(res);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const failure = new TypeError('Failed to fetch');
    global.fetch = jest.fn(() => Promise.reject(failure));
    const other = jest.fn();
    await expect(call(createAdminApi(other))).rejects.toBe(failure);
    expect(other).not.toHaveBeenCalled();
  });
});
