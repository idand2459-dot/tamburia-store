/**
 * The stored checkout attempt (store/persistence.js): an order that was sent and not confirmed.
 * Reading validates it, writing says whether it really was kept, and nothing here ever throws.
 */
import {
  CHECKOUT_ATTEMPT_STORAGE_KEY as KEY,
  readCheckoutAttempt, writeCheckoutAttempt, clearCheckoutAttempt,
} from '../../store/persistence';

const ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';
const BODY = { request_id: ID, customer_name: 'דנה', items: [{ id: 1, quantity: 1 }], total: 10 };
const ATTEMPT = { requestId: ID, body: BODY, submittedAt: 1_700_000_000_000 };

beforeEach(() => { localStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('writeCheckoutAttempt and readCheckoutAttempt', () => {
  test('what is written is read back, and the write reports success', () => {
    expect(writeCheckoutAttempt(ATTEMPT)).toBe(true);
    expect(readCheckoutAttempt()).toEqual(ATTEMPT);
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
    ['a request id that is not a v4 UUID', JSON.stringify({ ...ATTEMPT, requestId: 'abc' })],
    ['a body whose request_id is another id', JSON.stringify({ ...ATTEMPT, body: { ...BODY, request_id: ID.replace('3f', '4f') } })],
    ['a body without items', JSON.stringify({ ...ATTEMPT, body: { request_id: ID, items: [] } })],
    ['a body that is not an object', JSON.stringify({ ...ATTEMPT, body: 'x' })],
    ['a time that is not a number', JSON.stringify({ ...ATTEMPT, submittedAt: 'yesterday' })],
  ])('%s is ignored', (_label, stored) => {
    localStorage.setItem(KEY, stored);
    expect(readCheckoutAttempt()).toBeNull();
  });

  test('reading never writes: an invalid value stays as it was', () => {
    localStorage.setItem(KEY, '{broken');
    readCheckoutAttempt();
    expect(localStorage.getItem(KEY)).toBe('{broken');
  });

  test('an old attempt is still valid: there is no expiry', () => {
    writeCheckoutAttempt({ ...ATTEMPT, submittedAt: 1 });
    expect(readCheckoutAttempt()).toMatchObject({ submittedAt: 1 });
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
