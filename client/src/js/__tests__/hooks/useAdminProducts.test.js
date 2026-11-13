/**
 * Tests for useAdminProducts, pinned at the fetch level: the exact request each action sends
 * (URL, method, headers, body), what the hook returns, the error text it keeps, and when it
 * reloads the list. They record today's behavior, imperfections included.
 *
 * The hook is given the real admin API (createAdminApi) over the fake global fetch, with a
 * no-op expiry callback: the 401 handling is pinned in pages/admin/Admin.test.js and
 * services/adminService.test.js. Only this adapter changed when the hook moved to named
 * adminApi calls; the assertions did not.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { createAdminApi } from '../../services/adminService';
import { NETWORK_ERROR } from '../../utils/apiErrors';

const LIST_URL = '/api/products?active=all';
const PRODUCT = { id: 7, name: 'דבק מגע', price: 30, in_stock: true, active: true };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

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

/** The form fields the hook receives when the form is saved. */
const FIELDS = {
  name: 'מברשת',
  price: '12.90',
  inStock: true,
  colors: [{ name: ' לבן ', hex: '#fff' }, { name: '   ', hex: '#000' }, { name: 'שחור' }],
  category: 'painting',
  subcategory: '',
  sku: 'TT-001',
  description: 'מברשת איכותית',
  variants: [{ label: " 5 ל' ", price: '99.5' }, { label: '', price: '10' }, { label: 'ריק', price: '' }],
  imageIllustrative: 1,
};

/** The body those fields turn into. */
const BODY_FOR = (imageUrls) => ({
  name: 'מברשת',
  price: 12.9,
  in_stock: true,
  image_url: imageUrls[0] || '',
  images: imageUrls.slice(1),
  colors: [{ name: 'לבן', hex: '#fff' }, { name: 'שחור', hex: '' }],
  category: 'painting',
  subcategory: null,
  sku: 'TT-001',
  description: 'מברשת איכותית',
  image_illustrative: true,
  variants: [{ label: "5 ל'", price: 99.5 }],
});

let routes;

/** Calls the fake fetch has seen for one URL (and, optionally, one method). */
const callsTo = (url, method) => global.fetch.mock.calls.filter(([u, o]) => (
  u === url && (method === undefined || (o?.method || 'GET') === method)
));
const listCalls = () => callsTo(LIST_URL);

/** Renders the hook and waits for the first list. */
async function setup() {
  const { result } = renderHook(() => useAdminProducts(adminApi));
  await waitFor(() => expect(result.current.productsLoaded).toBe(true));
  return result;
}

beforeEach(() => {
  routes = {
    list: () => reply(200, [PRODUCT]),
    post: () => reply(201, { id: 99 }),
    put: () => reply(200, {}),
    delete: () => reply(200, {}),
    upload: () => reply(200, { imageUrls: ['/uploads/a.webp', '/uploads/b.webp'] }),
  };
  global.fetch = jest.fn((url, options) => {
    const method = options?.method || 'GET';
    if (url === LIST_URL) return routes.list();
    if (url === '/api/upload-multiple' && method === 'POST') return routes.upload();
    if (url === '/api/products' && method === 'POST') return routes.post();
    if (url === '/api/products/7' && method === 'PUT') return routes.put();
    if (url === '/api/products/7' && method === 'DELETE') return routes.delete();
    throw new Error(`unexpected request: ${method} ${url}`);
  });
});

afterEach(() => {
  delete global.fetch;
});

describe('loading the list', () => {
  test('GETs the full list including hidden products, with no options', async () => {
    const result = await setup();

    expect(listCalls()).toHaveLength(1);
    expect(listCalls()[0][1]).toBeUndefined();
    expect(result.current.products).toEqual([PRODUCT]);
    expect(result.current.productsError).toBe('');
  });

  test.each([
    ['a non-OK answer with an error object', () => reply(500, { error: 'שגיאת שרת' })],
    ['an OK answer that is an object', () => reply(200, { products: [PRODUCT] })],
    ['an OK answer that is null', () => reply(200, null)],
  ])('%s: the list is left unchanged, is not marked as loaded and shows no error', async (_label, failing) => {
    const result = await setup();
    routes.list = failing;

    await act(async () => { result.current.fetchProducts(); });
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    await act(async () => {});

    expect(result.current.products).toEqual([PRODUCT]);
    expect(result.current.productsError).toBe('');
  });

  test.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a body that is not JSON', () => reply(502, undefined)],
  ])('%s: the list is left unchanged and shows no error', async (_label, failing) => {
    const result = await setup();
    routes.list = failing;

    await act(async () => { result.current.fetchProducts(); });
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    await act(async () => {});

    expect(result.current.products).toEqual([PRODUCT]);
    expect(result.current.productsError).toBe('');
  });

  test('when the first list is not an array the products stay empty and are not marked as loaded', async () => {
    routes.list = () => reply(401, { error: 'נדרשת התחברות כמנהל' });
    const { result } = renderHook(() => useAdminProducts(adminApi));
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await act(async () => {});

    expect(result.current.products).toEqual([]);
    expect(result.current.productsLoaded).toBe(false);
  });
});

describe('createProduct', () => {
  test('POSTs the product body without uploading when there are no new images, reloads and clears the error', async () => {
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, []); });

    expect(ok).toBe(true);
    expect(callsTo('/api/upload-multiple')).toHaveLength(0);
    const posts = callsTo('/api/products', 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][1].headers).toEqual(JSON_HEADERS);
    expect(JSON.parse(posts[0][1].body)).toEqual(BODY_FOR([]));
    expect(posts[0][1].body).toBe(JSON.stringify(BODY_FOR([])));
    expect(listCalls()).toHaveLength(2);
    expect(result.current.productsError).toBe('');
    expect(result.current.uploadingImages).toBe(false);
  });

  test('uploads the new images first, then POSTs the product with their URLs (first is the main image)', async () => {
    const result = await setup();
    const files = [new File(['a'], 'a.png'), new File(['b'], 'b.png')];

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, files); });

    expect(ok).toBe(true);
    const uploads = callsTo('/api/upload-multiple');
    expect(uploads).toHaveLength(1);
    expect(Object.keys(uploads[0][1]).sort()).toEqual(['body', 'method']);
    expect(uploads[0][1].method).toBe('POST');
    expect(uploads[0][1].body).toBeInstanceOf(FormData);
    expect(uploads[0][1].body.getAll('images')).toEqual(files);
    const order = global.fetch.mock.calls.map(([u]) => u);
    expect(order.indexOf('/api/upload-multiple')).toBeLessThan(order.lastIndexOf('/api/products'));
    expect(JSON.parse(callsTo('/api/products', 'POST')[0][1].body)).toEqual(
      BODY_FOR(['/uploads/a.webp', '/uploads/b.webp'])
    );
  });

  test('an upload answer without imageUrls (or that is not JSON) saves the product with no images', async () => {
    routes.upload = () => reply(200, undefined);
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, [new File(['a'], 'a.png')]); });

    expect(ok).toBe(true);
    expect(JSON.parse(callsTo('/api/products', 'POST')[0][1].body)).toEqual(BODY_FOR([]));
  });

  test.each([
    ['the server message', { error: 'הקובץ גדול מדי' }, 'הקובץ גדול מדי'],
    ['the fallback when there is no message', {}, 'העלאת התמונות נכשלה. המוצר לא נשמר.'],
    ['the fallback when the body is not JSON', undefined, 'העלאת התמונות נכשלה. המוצר לא נשמר.'],
  ])('a rejected upload shows %s, saves nothing and returns false', async (_label, body, expected) => {
    routes.upload = () => reply(400, body);
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, [new File(['a'], 'a.png')]); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(expected);
    expect(callsTo('/api/products', 'POST')).toHaveLength(0);
    expect(listCalls()).toHaveLength(1);
    expect(result.current.uploadingImages).toBe(false);
  });

  test.each([
    ['the server message', 400, { error: 'שם המוצר חסר' }, 'שם המוצר חסר'],
    ['the server message of a 401', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['the fallback when there is no message', 500, {}, 'הוספת המוצר נכשלה.'],
    ['the fallback for a blank message', 500, { error: '  ' }, 'הוספת המוצר נכשלה.'],
    ['the fallback when the body is not JSON', 502, undefined, 'הוספת המוצר נכשלה.'],
  ])('a rejected product shows %s, returns false and does not reload', async (_label, status, body, expected) => {
    routes.post = () => reply(status, body);
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, []); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(expected);
    expect(listCalls()).toHaveLength(1);
    expect(result.current.uploadingImages).toBe(false);
  });

  test('a network failure shows the network message, returns false and releases the upload flag', async () => {
    routes.post = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, []); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(NETWORK_ERROR);
    expect(listCalls()).toHaveLength(1);
    expect(result.current.uploadingImages).toBe(false);
  });

  test('a network failure during the upload shows the network message and saves nothing', async () => {
    routes.upload = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.createProduct(FIELDS, [new File(['a'], 'a.png')]); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(NETWORK_ERROR);
    expect(callsTo('/api/products', 'POST')).toHaveLength(0);
    expect(result.current.uploadingImages).toBe(false);
  });

  test('a success clears an earlier error', async () => {
    routes.post = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.createProduct(FIELDS, []); });
    expect(result.current.productsError).toBe('שגיאת שרת');

    routes.post = () => reply(201, { id: 99 });
    await act(async () => { await result.current.createProduct(FIELDS, []); });

    expect(result.current.productsError).toBe('');
  });
});

describe('updateProduct', () => {
  test('PUTs the body with the existing image URLs first and the newly uploaded ones after them', async () => {
    const result = await setup();

    let ok;
    await act(async () => {
      ok = await result.current.updateProduct(7, FIELDS, ['/uploads/old.webp', '/uploads/old2.webp'], [new File(['a'], 'a.png')]);
    });

    expect(ok).toBe(true);
    const puts = callsTo('/api/products/7', 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0][1].headers).toEqual(JSON_HEADERS);
    expect(puts[0][1].body).toBe(JSON.stringify(BODY_FOR([
      '/uploads/old.webp', '/uploads/old2.webp', '/uploads/a.webp', '/uploads/b.webp',
    ])));
    expect(listCalls()).toHaveLength(2);
    expect(result.current.productsError).toBe('');
  });

  test('without new images nothing is uploaded', async () => {
    const result = await setup();

    await act(async () => { await result.current.updateProduct(7, FIELDS, ['/uploads/old.webp'], []); });

    expect(callsTo('/api/upload-multiple')).toHaveLength(0);
    expect(callsTo('/api/products/7', 'PUT')[0][1].body).toBe(JSON.stringify(BODY_FOR(['/uploads/old.webp'])));
  });

  test('a rejected upload shows its message and does not send the PUT', async () => {
    routes.upload = () => reply(400, { error: 'הקובץ גדול מדי' });
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.updateProduct(7, FIELDS, [], [new File(['a'], 'a.png')]); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe('הקובץ גדול מדי');
    expect(callsTo('/api/products/7', 'PUT')).toHaveLength(0);
    expect(result.current.uploadingImages).toBe(false);
  });

  test.each([
    ['the server message', 404, { error: 'מוצר 7 לא נמצא' }, 'מוצר 7 לא נמצא'],
    ['the fallback when there is no message', 500, {}, 'שמירת המוצר נכשלה.'],
    ['the fallback when the body is not JSON', 502, undefined, 'שמירת המוצר נכשלה.'],
  ])('a rejected PUT shows %s, returns false and does not reload', async (_label, status, body, expected) => {
    routes.put = () => reply(status, body);
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.updateProduct(7, FIELDS, [], []); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(expected);
    expect(listCalls()).toHaveLength(1);
    expect(result.current.uploadingImages).toBe(false);
  });

  test('a network failure shows the network message and returns false', async () => {
    routes.put = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.updateProduct(7, FIELDS, [], []); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(NETWORK_ERROR);
    expect(result.current.uploadingImages).toBe(false);
  });
});

describe('partial updates (stock, visibility, price, subcategory)', () => {
  test.each([
    ['toggleStock turns an in-stock product off', (r, p) => r.toggleStock(p), { in_stock: true }, { in_stock: false }],
    ['toggleStock turns an out-of-stock product on', (r, p) => r.toggleStock(p), { in_stock: false }, { in_stock: true }],
    ['toggleActive hides a visible product', (r, p) => r.toggleActive(p), { active: true }, { active: false }],
    ['toggleActive shows a product whose active is false', (r, p) => r.toggleActive(p), { active: false }, { active: true }],
    ['toggleActive hides a product whose active is missing', (r, p) => r.toggleActive(p), {}, { active: false }],
    ['updatePrice sends only the price', (r, p) => r.updatePrice(p, 45.5), {}, { price: 45.5 }],
    ['updateSubcategory sends only the subcategory', (r, p) => r.updateSubcategory(p, 'brushes'), {}, { subcategory: 'brushes' }],
    ['updateSubcategory turns an empty value into null', (r, p) => r.updateSubcategory(p, ''), {}, { subcategory: null }],
  ])('%s', async (_label, run, productFields, expectedPatch) => {
    const result = await setup();

    let ok;
    await act(async () => { ok = await run(result.current, { id: 7, ...productFields }); });

    expect(ok).toBe(true);
    const puts = callsTo('/api/products/7', 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0][1]).toEqual({
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(expectedPatch),
    });
    expect(listCalls()).toHaveLength(2);
    expect(result.current.productsError).toBe('');
  });

  test.each([
    ['toggleStock', (r) => r.toggleStock({ id: 7, in_stock: true }), 'עדכון המלאי נכשל.'],
    ['toggleActive', (r) => r.toggleActive({ id: 7, active: true }), 'הסתרת המוצר נכשלה.'],
    ['updatePrice', (r) => r.updatePrice({ id: 7 }, 10), 'עדכון המחיר נכשל.'],
    ['updateSubcategory', (r) => r.updateSubcategory({ id: 7 }, 'x'), 'שיבוץ תת-הקטגוריה נכשל.'],
  ])('%s: a rejected PUT without a message shows its own fallback, returns false and does not reload', async (_label, run, fallback) => {
    routes.put = () => reply(500, {});
    const result = await setup();

    let ok;
    await act(async () => { ok = await run(result.current); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(fallback);
    expect(listCalls()).toHaveLength(1);
  });

  test('a rejected PUT shows the server message as it is', async () => {
    routes.put = () => reply(400, { error: 'המחיר חייב להיות חיובי' });
    const result = await setup();

    await act(async () => { await result.current.updatePrice({ id: 7 }, -1); });

    expect(result.current.productsError).toBe('המחיר חייב להיות חיובי');
  });

  test('a body that is not JSON shows the fallback', async () => {
    routes.put = () => reply(502, undefined);
    const result = await setup();

    await act(async () => { await result.current.toggleStock({ id: 7, in_stock: true }); });

    expect(result.current.productsError).toBe('עדכון המלאי נכשל.');
  });

  test('a network failure shows the network message and returns false', async () => {
    routes.put = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    let ok;
    await act(async () => { ok = await result.current.toggleStock({ id: 7, in_stock: true }); });

    expect(ok).toBe(false);
    expect(result.current.productsError).toBe(NETWORK_ERROR);
  });

  test('a success clears an earlier error', async () => {
    routes.put = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.toggleStock({ id: 7, in_stock: true }); });
    expect(result.current.productsError).toBe('שגיאת שרת');

    routes.put = () => reply(200, {});
    await act(async () => { await result.current.toggleStock({ id: 7, in_stock: true }); });

    expect(result.current.productsError).toBe('');
  });
});

describe('deleteProduct', () => {
  test('sends the DELETE with no confirmation, reloads, clears the error and returns deleted', async () => {
    const confirm = jest.spyOn(window, 'confirm');
    routes.put = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();
    await act(async () => { await result.current.toggleStock({ id: 7, in_stock: true }); });
    expect(result.current.productsError).toBe('שגיאת שרת');

    let outcome;
    await act(async () => { outcome = await result.current.deleteProduct(PRODUCT); });

    expect(outcome).toEqual({ status: 'deleted' });
    expect(callsTo('/api/products/7', 'DELETE')).toEqual([['/api/products/7', { method: 'DELETE' }]]);
    expect(confirm).not.toHaveBeenCalled();
    expect(listCalls()).toHaveLength(2);
    expect(result.current.productsError).toBe('');
    confirm.mockRestore();
  });

  test('a 409 with details.reason has_orders returns has_orders with the server message', async () => {
    routes.delete = () => reply(409, { error: 'המוצר נמכר בהזמנות', details: { reason: 'has_orders' } });
    const result = await setup();

    let outcome;
    await act(async () => { outcome = await result.current.deleteProduct(PRODUCT); });

    expect(outcome).toEqual({ status: 'has_orders', message: 'המוצר נמכר בהזמנות' });
    expect(listCalls()).toHaveLength(1);
  });

  test.each([
    ['a 409 with another reason', 409, { error: 'התנגשות', details: { reason: 'other' } }, 'התנגשות'],
    ['a 409 without details', 409, { error: 'התנגשות' }, 'התנגשות'],
    ['a 401', 401, { error: 'נדרשת התחברות כמנהל' }, 'נדרשת התחברות כמנהל'],
    ['a 404', 404, { error: 'מוצר 7 לא נמצא' }, 'מוצר 7 לא נמצא'],
    ['a body without a message', 500, {}, 'מחיקת המוצר נכשלה. אפשר לנסות שוב.'],
    ['a blank message', 500, { error: '  ' }, 'מחיקת המוצר נכשלה. אפשר לנסות שוב.'],
    ['a body that is not JSON', 502, undefined, 'מחיקת המוצר נכשלה. אפשר לנסות שוב.'],
  ])('%s returns an error outcome and does not reload', async (_label, status, body, message) => {
    routes.delete = () => reply(status, body);
    const result = await setup();

    let outcome;
    await act(async () => { outcome = await result.current.deleteProduct(PRODUCT); });

    expect(outcome).toEqual({ status: 'error', message });
    expect(listCalls()).toHaveLength(1);
  });

  test('a rejected delete does not touch productsError: the card shows the outcome', async () => {
    routes.delete = () => reply(500, { error: 'שגיאת שרת' });
    const result = await setup();

    await act(async () => { await result.current.deleteProduct(PRODUCT); });

    expect(result.current.productsError).toBe('');
  });

  test('a network failure returns an error outcome with the network message', async () => {
    routes.delete = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await setup();

    let outcome;
    await act(async () => { outcome = await result.current.deleteProduct(PRODUCT); });

    expect(outcome).toEqual({ status: 'error', message: NETWORK_ERROR });
    expect(result.current.productsError).toBe('');
  });
});

describe('handleImport (CSV rows)', () => {
  const CSV = [
    'name,price,in_stock,sku,category,colors,description',
    'מברשת,25,true,TT-001,painting,"לבן,שחור",איכותית',
    'סיליקון,18.5,false,,adhesives,,',
  ].join('\n');

  /** Feeds the CSV to the hook the way the file input does and waits for the preview. */
  async function loadCsv(result) {
    const input = { files: [new File([CSV], 'products.csv')], value: 'products.csv' };
    act(() => { result.current.handleCsvFile({ target: input }); });
    await waitFor(() => expect(result.current.csvPreview).not.toBeNull());
  }

  test('POSTs each previewed row with empty images, counts the answers and reloads once', async () => {
    let call = 0;
    routes.post = () => reply(++call === 2 ? 400 : 201, {});
    const result = await setup();
    await loadCsv(result);
    expect(result.current.csvPreview).toHaveLength(2);

    await act(async () => { await result.current.handleImport(); });

    const posts = callsTo('/api/products', 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0][1].headers).toEqual(JSON_HEADERS);
    expect(JSON.parse(posts[0][1].body)).toEqual({
      name: 'מברשת', price: 25, in_stock: true, sku: 'TT-001', category: 'painting',
      colors: ['לבן', 'שחור'], description: 'איכותית', image_url: '', images: [],
    });
    expect(JSON.parse(posts[1][1].body)).toMatchObject({ name: 'סיליקון', price: 18.5, in_stock: false, sku: '' });
    expect(result.current.importResult).toEqual({ success: 1, failed: 1 });
    expect(result.current.csvPreview).toBeNull();
    expect(result.current.importing).toBe(false);
    expect(listCalls()).toHaveLength(2);
  });

  test('a network failure counts the row as failed and the import goes on', async () => {
    let call = 0;
    routes.post = () => (++call === 1 ? Promise.reject(new TypeError('Failed to fetch')) : reply(201, {}));
    const result = await setup();
    await loadCsv(result);

    await act(async () => { await result.current.handleImport(); });

    expect(callsTo('/api/products', 'POST')).toHaveLength(2);
    expect(result.current.importResult).toEqual({ success: 1, failed: 1 });
  });

  test('with no previewed rows nothing is sent', async () => {
    const result = await setup();

    await act(async () => { await result.current.handleImport(); });

    expect(callsTo('/api/products', 'POST')).toHaveLength(0);
    expect(result.current.importResult).toBeNull();
  });
});
