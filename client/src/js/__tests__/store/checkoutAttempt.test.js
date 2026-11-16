/**
 * The stored checkout attempt (store/persistence.js): an order that was sent and not confirmed.
 * Reading validates it, writing says whether it really was kept, and nothing here ever throws.
 * Within 48 hours of the submission it is the exact body that was sent; from 48 hours on it is an
 * expired record with no personal details, and reading is what makes the change. All personal data
 * below is synthetic.
 */
import {
  CHECKOUT_ATTEMPT_STORAGE_KEY as KEY, CHECKOUT_ATTEMPT_RETENTION_MS as RETENTION,
  readCheckoutAttempt, writeCheckoutAttempt, clearCheckoutAttempt, expireCheckoutAttempt,
  isCheckoutAttemptDue,
} from '../../store/persistence';

const ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';
const SENT = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const BODY = {
  request_id: ID, customer_name: 'Dana Levi', customer_phone: '0501234567', customer_email: 'dana.levi@example.com',
  delivery_address: 'Herzl 12, Haifa', notes: 'leave with the neighbour',
  items: [{ id: 1, name: 'Brush', quantity: 2 }, { id: 2, name: 'Roller', quantity: 1 }], total: 10,
};
const ATTEMPT = { requestId: ID, body: BODY, submittedAt: SENT };
const PERSONAL = ['Dana', 'Levi', '0501234567', 'dana.levi@example.com', 'Herzl', 'neighbour', 'Brush', 'Roller'];
const EXPIRED = { requestId: ID, submittedAt: SENT, expired: true, itemCount: 3, total: 10 };

/** The raw stored text must hold none of the customer's details. */
const storedText = () => localStorage.getItem(KEY);

beforeEach(() => { localStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('writeCheckoutAttempt and readCheckoutAttempt', () => {
  test('what is written is read back, and the write reports success', () => {
    expect(writeCheckoutAttempt(ATTEMPT)).toBe(true);
    expect(readCheckoutAttempt(SENT + HOUR)).toEqual(ATTEMPT);
  });

  test('only the three fields are stored, even if the caller passes more', () => {
    writeCheckoutAttempt({ ...ATTEMPT, persisted: true, conflict: false, card: '4111' });
    expect(Object.keys(JSON.parse(localStorage.getItem(KEY))).sort()).toEqual(['body', 'requestId', 'submittedAt']);
  });

  test('nothing stored is null', () => {
    expect(readCheckoutAttempt()).toBeNull();
  });

  test.each([
    ['not JSON', '{broken'],
    ['null', 'null'],
    ['an array', '[]'],
    ['no request id', JSON.stringify({ body: BODY, submittedAt: SENT })],
    ['a request id that is not a v4 UUID', JSON.stringify({ ...ATTEMPT, requestId: 'abc' })],
  ])('%s cannot be said to be an attempt: it is removed, nothing is returned', (_label, stored) => {
    localStorage.setItem(KEY, stored);
    expect(readCheckoutAttempt(SENT + HOUR)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test.each([
    ['a body whose request_id is another id', { ...ATTEMPT, body: { ...BODY, request_id: ID.replace('3f', '4f') } }],
    ['a body without items', { ...ATTEMPT, body: { ...BODY, items: [] } }],
    ['a body that is not an object', { ...ATTEMPT, body: 'Dana Levi 0501234567' }],
  ])('%s: the request id is valid, so the attempt is expired and its details are removed', (_label, stored) => {
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(readCheckoutAttempt(SENT + HOUR)).toEqual({ requestId: ID, submittedAt: SENT, expired: true, itemCount: 0, total: null });
    PERSONAL.forEach((value) => expect(storedText()).not.toContain(value));
  });
});

describe('the 48-hour retention', () => {
  test('the retention is 48 hours', () => {
    expect(RETENTION).toBe(48 * HOUR);
  });

  test('at 47 hours the attempt is still active: the exact body, the same id and the same time', () => {
    writeCheckoutAttempt(ATTEMPT);
    expect(readCheckoutAttempt(SENT + 47 * HOUR)).toEqual(ATTEMPT);
    expect(JSON.parse(storedText())).toEqual(ATTEMPT);
  });

  test('one millisecond before 48 hours it is still active', () => {
    writeCheckoutAttempt(ATTEMPT);
    expect(readCheckoutAttempt(SENT + RETENTION - 1)).toEqual(ATTEMPT);
  });

  test('exactly at 48 hours it expires', () => {
    writeCheckoutAttempt(ATTEMPT);
    expect(readCheckoutAttempt(SENT + RETENTION)).toEqual(EXPIRED);
  });

  test('after 49 hours it is expired, and stays so however often it is read', () => {
    writeCheckoutAttempt(ATTEMPT);
    expect(readCheckoutAttempt(SENT + 49 * HOUR)).toEqual(EXPIRED);
    expect(readCheckoutAttempt(SENT + 49 * HOUR)).toEqual(EXPIRED);
    expect(readCheckoutAttempt(SENT + 30 * 24 * HOUR)).toEqual(EXPIRED);
  });

  test('reading an expired attempt removes the details from storage, leaving only the five fields', () => {
    writeCheckoutAttempt(ATTEMPT);
    readCheckoutAttempt(SENT + 49 * HOUR);

    expect(JSON.parse(storedText())).toEqual(EXPIRED);
    expect(Object.keys(JSON.parse(storedText())).sort()).toEqual(['expired', 'itemCount', 'requestId', 'submittedAt', 'total']);
    PERSONAL.forEach((value) => expect(storedText()).not.toContain(value));
  });

  test('the expired record is not copied anywhere else, and the cart is untouched', () => {
    localStorage.setItem('tamburia-cart', '[{"id":1,"name":"Brush","price":5}]');
    writeCheckoutAttempt(ATTEMPT);
    readCheckoutAttempt(SENT + 49 * HOUR);

    expect(Object.keys(localStorage)).toEqual(expect.arrayContaining([KEY, 'tamburia-cart']));
    expect(Object.keys(localStorage)).toHaveLength(2);
    expect(localStorage.getItem('tamburia-cart')).toBe('[{"id":1,"name":"Brush","price":5}]');
  });

  test('a retry stores the same time: writing the attempt again does not move it', () => {
    writeCheckoutAttempt(ATTEMPT);
    writeCheckoutAttempt({ requestId: ID, body: BODY, submittedAt: ATTEMPT.submittedAt });
    expect(JSON.parse(storedText()).submittedAt).toBe(SENT);
    // the clock of the retention is therefore still the original one
    expect(readCheckoutAttempt(SENT + RETENTION)).toEqual(EXPIRED);
  });

  test('a record written before this change (the same shape, any age) is expired by its time', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...ATTEMPT, submittedAt: Date.parse('2024-01-01T00:00:00Z') }));
    expect(readCheckoutAttempt()).toMatchObject({ expired: true, itemCount: 3, total: 10 });
    PERSONAL.forEach((value) => expect(storedText()).not.toContain(value));
  });

  test.each([
    ['no time', { requestId: ID, body: BODY }],
    ['a time that is not a number', { ...ATTEMPT, submittedAt: 'yesterday' }],
    ['a time that is a numeric string', { ...ATTEMPT, submittedAt: String(SENT) }],
    ['a time of zero', { ...ATTEMPT, submittedAt: 0 }],
    ['a negative time', { ...ATTEMPT, submittedAt: -5 }],
    ['a null time', { ...ATTEMPT, submittedAt: null }],
    ['a time far in the future', { ...ATTEMPT, submittedAt: SENT + 400 * 24 * HOUR }],
  ])('%s cannot be dated, so it is expired at once, with no date in the record', (_label, stored) => {
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(readCheckoutAttempt(SENT + HOUR)).toEqual({ requestId: ID, submittedAt: null, expired: true, itemCount: 3, total: 10 });
    PERSONAL.forEach((value) => expect(storedText()).not.toContain(value));
  });

  test('a time a few minutes ahead of the clock (a clock set back) is still trusted', () => {
    writeCheckoutAttempt({ ...ATTEMPT, submittedAt: SENT + 5 * 60 * 1000 });
    expect(readCheckoutAttempt(SENT)).toMatchObject({ submittedAt: SENT + 5 * 60 * 1000, body: BODY });
  });

  test('an expired record that carries a body is cut back to the five fields', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...EXPIRED, body: BODY, customer_name: 'Dana Levi', extra: 1 }));
    expect(readCheckoutAttempt(SENT + HOUR)).toEqual(EXPIRED);
    expect(JSON.parse(storedText())).toEqual(EXPIRED);
    PERSONAL.forEach((value) => expect(storedText()).not.toContain(value));
  });

  test('an expired record with damaged counts is repaired, not trusted', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...EXPIRED, itemCount: -4, total: 'a lot', submittedAt: 'x' }));
    expect(readCheckoutAttempt()).toEqual({ requestId: ID, submittedAt: null, expired: true, itemCount: 0, total: null });
  });

  test('item counts treat a missing quantity as one, and a body total that is not a number as none', () => {
    writeCheckoutAttempt({ ...ATTEMPT, body: { ...BODY, items: [{ id: 1 }, { id: 2, quantity: 3 }, { id: 3, quantity: -1 }], total: '10' } });
    expect(readCheckoutAttempt(SENT + RETENTION)).toMatchObject({ itemCount: 5, total: null });
  });

  test('expireCheckoutAttempt reduces an attempt that is in memory and stores the reduced record', () => {
    writeCheckoutAttempt(ATTEMPT);
    const { record, stored } = expireCheckoutAttempt({ ...ATTEMPT, persisted: true, conflict: true });
    expect(record).toEqual(EXPIRED);
    expect(stored).toBe(true);
    expect(JSON.parse(storedText())).toEqual(EXPIRED);
  });

  test('isCheckoutAttemptDue: false before 48 hours, true from then on, true when it cannot be dated', () => {
    expect(isCheckoutAttemptDue(SENT, SENT + RETENTION - 1)).toBe(false);
    expect(isCheckoutAttemptDue(SENT, SENT + RETENTION)).toBe(true);
    expect(isCheckoutAttemptDue(undefined, SENT)).toBe(true);
    expect(isCheckoutAttemptDue(NaN, SENT)).toBe(true);
    expect(isCheckoutAttemptDue(Infinity, SENT)).toBe(true);
    expect(isCheckoutAttemptDue('1700000000000', SENT)).toBe(true);
  });
});

describe('when localStorage fails', () => {
  test('a write that throws returns false', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(writeCheckoutAttempt(ATTEMPT)).toBe(false);
  });

  test('a write that is silently dropped returns false', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(writeCheckoutAttempt(ATTEMPT)).toBe(false);
  });

  test('a read that throws returns null', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(readCheckoutAttempt()).toBeNull();
  });

  test('if the expired record cannot be written, the key is removed instead, and the answer is still the expired record', () => {
    writeCheckoutAttempt(ATTEMPT);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });

    expect(readCheckoutAttempt(SENT + RETENTION)).toEqual(EXPIRED);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('if the key can neither be rewritten nor removed, reading still does not throw', () => {
    writeCheckoutAttempt(ATTEMPT);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });

    expect(() => readCheckoutAttempt(SENT + RETENTION)).not.toThrow();
    expect(readCheckoutAttempt(SENT + RETENTION)).toEqual(EXPIRED);
    expect(expireCheckoutAttempt(ATTEMPT)).toEqual({ record: EXPIRED, stored: false });
  });

  test('a removal that throws does not throw', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => clearCheckoutAttempt()).not.toThrow();
  });
});

describe('clearCheckoutAttempt', () => {
  test('removes the attempt and touches nothing else', () => {
    localStorage.setItem('tamburia-cart', '[]');
    writeCheckoutAttempt(ATTEMPT);

    clearCheckoutAttempt();

    expect(readCheckoutAttempt()).toBeNull();
    expect(localStorage.getItem('tamburia-cart')).toBe('[]');
  });
});
