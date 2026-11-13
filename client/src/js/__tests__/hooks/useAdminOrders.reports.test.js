/**
 * Characterization tests for the two report outputs of useAdminOrders: the statistics numbers
 * (getStats) and the CSV text of the order export (exportOrdersToExcel). They were written
 * against the code as it stood inside the hook and stay unchanged when the calculation moves
 * to utils/orderReports.js (P3), so they prove the move changed no number and no character.
 *
 * Dates are built in local time and the clock is frozen at Friday 13 Nov 2026, 12:00, so the
 * day, week and month boundaries are exact whatever the machine's time zone.
 *
 * Run with `npm run test:client` from the root.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { createAdminApi } from '../../services/adminService';
import { STATUS_CONFIG, formatDate } from '../../pages/admin/adminConstants';

jest.mock('../../hooks/useWebSocket', () => ({ useWebSocket: () => {} }));

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const at = (month, day, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute).toISOString();

const adminApi = createAdminApi(() => {});

/** Renders the hook over a fake fetch serving these orders. */
async function setup(orders) {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => orders }));
  const { result } = renderHook(() => useAdminOrders(adminApi));
  await waitFor(() => expect(result.current.orders).toHaveLength(orders.length));
  return result;
}

/** Runs one call with the clock frozen at NOW and puts the real clock back right after. */
function atNow(call) {
  // Jest 27 (Create React App) ignores the `now`/`doNotFake` options, so the clock is set explicitly.
  jest.useFakeTimers('modern');
  jest.setSystemTime(NOW);
  try {
    return call();
  } finally {
    jest.useRealTimers();
  }
}

const statsOf = (result, products, since) => atNow(() => result.current.getStats(products, since));

afterEach(() => {
  delete global.fetch;
});

describe('getStats', () => {
  const ORDERS = [
    { id: 1, created_at: at(11, 13, 9), total: 100.5, items: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }] },
    { id: 2, created_at: at(11, 13, 0, 0), total: 50, items: [{ id: 1, quantity: 1 }] },
    { id: 3, created_at: at(11, 12, 23, 59), total: 30, items: [{ id: 3, quantity: 4 }] },
    { id: 4, created_at: at(11, 6, 0, 0), total: 20, items: [{ id: 2, quantity: 1 }] },
    { id: 5, created_at: at(11, 5, 23, 59), total: 10, items: [] },
    { id: 6, created_at: at(11, 1, 0, 0), total: 5, items: null },
    { id: 7, created_at: at(10, 31, 23, 59), total: 1000.25, items: [{ id: 99, quantity: 3 }] },
  ];
  const PRODUCTS = [
    { id: 1, category: 'painting', in_stock: true },
    { id: 2, category: 'adhesives', in_stock: false },
    { id: 3, category: 'garden' },
    { id: 4, in_stock: false },
    { id: 5, category: 'tools', in_stock: undefined },
  ];

  test('counts today, the last 7 days and the month with inclusive start boundaries', async () => {
    const result = await setup(ORDERS);

    const stats = statsOf(result, PRODUCTS);

    expect(stats.todayOrders.map((o) => o.id)).toEqual([1, 2]);
    expect(stats.weekOrders.map((o) => o.id)).toEqual([1, 2, 3, 4]);
    expect(stats.monthOrders.map((o) => o.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stats.totalOrders).toBe(7);
  });

  test('revenue is summed per window, without floating-point drift', async () => {
    const result = await setup(ORDERS);

    const stats = statsOf(result, PRODUCTS);

    expect(stats.revenueToday).toBe(150.5);
    expect(stats.revenueWeek).toBe(200.5);
    expect(stats.revenueMonth).toBe(215.5);
    expect(stats.revenueTotal).toBe(1215.75);
  });

  test('the last 7 days are the six days before today and today, oldest first', async () => {
    const result = await setup(ORDERS);

    const { dailyOrders } = statsOf(result, PRODUCTS);

    expect(dailyOrders).toHaveLength(7);
    expect(dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 1, 2]);
    expect(dailyOrders.map((d) => d.day)).toEqual(
      [6, 5, 4, 3, 2, 1, 0].map((back) => new Date(2026, 10, 13 - back)
        .toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' }))
    );
  });

  test('top categories add the quantities of the ordered products, biggest first, with the category label', async () => {
    const result = await setup(ORDERS);

    const { topCategories } = statsOf(result, PRODUCTS);

    // garden 4 (product 3), painting 3 (product 1: 2 + 1), adhesives 2 (product 2: 1 + 1)
    expect(topCategories).toEqual([
      { id: 'garden', label: 'גינה', count: 4 },
      { id: 'painting', label: 'מוצרי צביעה', count: 3 },
      { id: 'adhesives', label: 'דבקים', count: 2 },
    ]);
  });

  test('at most five categories are listed, and a product without a category or an unknown product adds nothing', async () => {
    const orders = ['painting', 'kitchen', 'bathroom', 'tools', 'cleaning', 'garden', 'plumbing']
      .map((category, i) => ({ id: i + 1, created_at: at(11, 13, 9), total: 1, items: [{ id: i + 1, quantity: 10 - i }] }));
    const products = ['painting', 'kitchen', 'bathroom', 'tools', 'cleaning', 'garden', 'plumbing']
      .map((category, i) => ({ id: i + 1, category }));
    const result = await setup(orders);

    const { topCategories } = statsOf(result, products);

    expect(topCategories.map((c) => [c.id, c.count])).toEqual([
      ['painting', 10], ['kitchen', 9], ['bathroom', 8], ['tools', 7], ['cleaning', 6],
    ]);
  });

  test('out-of-stock products are exactly those whose in_stock is false', async () => {
    const result = await setup(ORDERS);

    const { outOfStock } = statsOf(result, PRODUCTS);

    expect(outOfStock.map((p) => p.id)).toEqual([2, 4]);
  });

  test('a counting start drops earlier orders from every number but not the out-of-stock list', async () => {
    const result = await setup(ORDERS);

    const stats = statsOf(result, PRODUCTS, at(11, 12, 0, 0));

    expect(stats.totalOrders).toBe(3);
    expect(stats.todayOrders.map((o) => o.id)).toEqual([1, 2]);
    expect(stats.weekOrders.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(stats.monthOrders.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(stats.revenueTotal).toBe(180.5);
    expect(stats.revenueMonth).toBe(180.5);
    expect(stats.dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 1, 2]);
    expect(stats.topCategories.map((c) => [c.id, c.count])).toEqual([['garden', 4], ['painting', 3], ['adhesives', 1]]);
    expect(stats.outOfStock.map((p) => p.id)).toEqual([2, 4]);
  });

  test('an order exactly at the counting start is counted', async () => {
    const result = await setup(ORDERS);

    const stats = statsOf(result, PRODUCTS, at(11, 13, 0, 0));

    expect(stats.totalOrders).toBe(2);
  });

  test('null and an empty since both mean "count everything"', async () => {
    const result = await setup(ORDERS);

    expect(statsOf(result, PRODUCTS, null).totalOrders).toBe(7);
    expect(statsOf(result, PRODUCTS, '').totalOrders).toBe(7);
  });

  test('with no orders every number is zero or empty', async () => {
    const result = await setup([]);

    const stats = statsOf(result, PRODUCTS);

    expect(stats.totalOrders).toBe(0);
    expect(stats.revenueTotal).toBe(0);
    expect(stats.todayOrders).toEqual([]);
    expect(stats.topCategories).toEqual([]);
    expect(stats.dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(stats.outOfStock.map((p) => p.id)).toEqual([2, 4]);
  });
});

describe('exportOrdersToExcel', () => {
  const ORDERS = [
    {
      id: 12, created_at: at(11, 13, 9), customer_name: 'דנה כהן', customer_phone: '0501234567',
      customer_email: 'dana@example.com', delivery_method: 'delivery', delivery_address: 'הרצל 1, פתח תקווה',
      items: [{ name: 'צבע לבן', quantity: 2 }, { name: 'מברשת', quantity: 1 }],
      subtotal: 230.5, delivery_fee: 20, total: 250.5, status: 'processing', notes: 'להתקשר "לפני" ההגעה',
    },
    {
      id: 13, created_at: at(11, 12, 8), customer_name: 'יוסי', customer_phone: '0527654321',
      customer_email: null, delivery_method: 'pickup', delivery_address: null,
      items: [], subtotal: 0, delivery_fee: 0, total: 0, status: 'mystery', notes: null,
    },
  ];

  let blobParts;
  let clicked;
  let revoked;
  let RealBlob;
  let realClick;

  beforeEach(() => {
    blobParts = [];
    clicked = [];
    RealBlob = global.Blob;
    global.Blob = class extends RealBlob {
      constructor(parts, options) {
        super(parts, options);
        blobParts.push({ parts, options });
      }
    };
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    URL.revokeObjectURL = jest.fn((url) => { revoked = url; });
    realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { clicked.push({ href: this.href, download: this.download }); };
  });

  afterEach(() => {
    global.Blob = RealBlob;
    HTMLAnchorElement.prototype.click = realClick;
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });

  test('builds a BOM-prefixed CSV: unquoted headers, quoted values with doubled quotes, items joined by " | "', async () => {
    const result = await setup(ORDERS);

    atNow(() => result.current.exportOrdersToExcel());

    expect(blobParts).toHaveLength(1);
    expect(blobParts[0].options).toEqual({ type: 'text/csv;charset=utf-8;' });
    expect(blobParts[0].parts).toHaveLength(1);
    const csv = blobParts[0].parts[0];
    expect(csv).toBe('﻿' + [
      'מספר הזמנה,תאריך,שם לקוח,טלפון,אימייל,אופן קבלה,כתובת,פריטים,סכום מוצרים,משלוח,סה"כ,סטטוס,הערות',
      [
        '"#12"', `"${formatDate(ORDERS[0].created_at)}"`, '"דנה כהן"', '"0501234567"', '"dana@example.com"',
        '"משלוח"', '"הרצל 1, פתח תקווה"', '"צבע לבן x2 | מברשת x1"', '"230.5"', '"20"', '"250.5"',
        `"${STATUS_CONFIG.processing.label}"`, '"להתקשר ""לפני"" ההגעה"',
      ].join(','),
      [
        '"#13"', `"${formatDate(ORDERS[1].created_at)}"`, '"יוסי"', '"0527654321"', '""',
        '"איסוף עצמי"', '""', '""', '"0"', '"0"', '"0"', '"mystery"', '""',
      ].join(','),
    ].join('\n'));
  });

  test('downloads it as tamburia-orders-<date>.csv and releases the object URL', async () => {
    const result = await setup(ORDERS);

    atNow(() => result.current.exportOrdersToExcel());

    expect(clicked).toEqual([{
      href: 'blob:fake',
      download: `tamburia-orders-${NOW.toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`,
    }]);
    expect(revoked).toBe('blob:fake');
  });

  test('with no orders the export throws (the button is not shown then)', async () => {
    const result = await setup([]);

    expect(() => atNow(() => result.current.exportOrdersToExcel())).toThrow(TypeError);
    expect(clicked).toEqual([]);
  });
});
