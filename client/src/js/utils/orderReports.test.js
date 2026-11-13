/**
 * Unit tests for utils/orderReports.js, called directly. The full behavior (windows, boundaries,
 * revenue, categories, the export text) is pinned through the hook in
 * hooks/useAdminOrders.reports.test.js; these cover the functions on their own, including that
 * they do not touch their inputs.
 *
 * Run with `npm run test:client` from the root.
 */
import { computeOrderStats, ordersToCsv } from './orderReports';

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const at = (month, day, hour = 12) => new Date(2026, month - 1, day, hour).toISOString();
const ALL_BUT_DATE = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
  'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
  'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
];

beforeEach(() => { jest.useFakeTimers({ now: NOW, doNotFake: ALL_BUT_DATE }); });
afterEach(() => { jest.useRealTimers(); });

describe('computeOrderStats', () => {
  const ORDERS = [
    { id: 1, created_at: at(11, 13, 9), total: 10.1, items: [{ id: 1, quantity: 2 }] },
    { id: 2, created_at: at(11, 12, 9), total: 20.2, items: [{ id: 1, quantity: 1 }, { id: 2, quantity: 5 }] },
    { id: 3, created_at: at(10, 1, 9), total: 5, items: [{ id: 2, quantity: 1 }] },
  ];
  const PRODUCTS = [{ id: 1, category: 'painting' }, { id: 2, category: 'tools', in_stock: false }];

  test('returns the windows, revenue, chart, categories and stock list for the given orders', () => {
    const stats = computeOrderStats(ORDERS, PRODUCTS);

    expect(stats.totalOrders).toBe(3);
    expect(stats.todayOrders.map((o) => o.id)).toEqual([1]);
    expect(stats.weekOrders.map((o) => o.id)).toEqual([1, 2]);
    expect(stats.monthOrders.map((o) => o.id)).toEqual([1, 2]);
    expect(stats.revenueToday).toBe(10.1);
    expect(stats.revenueMonth).toBe(30.3);
    expect(stats.revenueTotal).toBe(35.3);
    expect(stats.dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(stats.topCategories.map((c) => [c.id, c.label, c.count])).toEqual([
      ['tools', 'כלי עבודה', 6],
      ['painting', 'מוצרי צביעה', 3],
    ]);
    expect(stats.outOfStock.map((p) => p.id)).toEqual([2]);
  });

  test('since filters the orders; omitting it counts everything', () => {
    expect(computeOrderStats(ORDERS, PRODUCTS, at(11, 12, 0)).totalOrders).toBe(2);
    expect(computeOrderStats(ORDERS, PRODUCTS, null).totalOrders).toBe(3);
    expect(computeOrderStats(ORDERS, PRODUCTS, undefined).totalOrders).toBe(3);
  });

  test('does not change its inputs', () => {
    const orders = JSON.parse(JSON.stringify(ORDERS));
    const products = JSON.parse(JSON.stringify(PRODUCTS));

    computeOrderStats(orders, products, at(11, 12, 0));

    expect(orders).toEqual(ORDERS);
    expect(products).toEqual(PRODUCTS);
  });

  test('reads the clock at call time: the same orders give different windows on another day', () => {
    expect(computeOrderStats(ORDERS, PRODUCTS).dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 1, 1]);

    jest.setSystemTime(new Date(2026, 10, 12, 12, 0, 0));

    // the chart now ends on the 12th, so the order of the 13th is outside it
    expect(computeOrderStats(ORDERS, PRODUCTS).dailyOrders.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('ordersToCsv', () => {
  const ORDER = {
    id: 7, created_at: at(11, 13, 9), customer_name: 'דנה', customer_phone: '050',
    customer_email: '', delivery_method: 'pickup', delivery_address: null,
    items: [{ name: 'א', quantity: 1 }], subtotal: 10, delivery_fee: 0, total: 10, status: 'new', notes: 'ab"c',
  };

  test('starts with a BOM and a header line, then one quoted line per order', () => {
    const csv = ordersToCsv([ORDER, { ...ORDER, id: 8 }]);

    const lines = csv.split('\n');
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(lines).toHaveLength(3);
    expect(lines[0].replace('﻿', '')).toBe(
      'מספר הזמנה,תאריך,שם לקוח,טלפון,אימייל,אופן קבלה,כתובת,פריטים,סכום מוצרים,משלוח,סה"כ,סטטוס,הערות'
    );
    expect(lines[1].startsWith('"#7","')).toBe(true);
    expect(lines[2].startsWith('"#8","')).toBe(true);
    expect(lines[1].endsWith('"חדשה","ab""c"')).toBe(true);
  });

  test('throws for an empty list: there is no first row to take the headers from', () => {
    expect(() => ordersToCsv([])).toThrow(TypeError);
  });
});
