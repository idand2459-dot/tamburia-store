/**
 * Tests for utils/requestId: the id has the shape the server requires (a version-4 UUID), comes
 * from the cryptographic source, and is built by hand where randomUUID does not exist (insecure
 * contexts).
 */
import { newRequestId, REQUEST_ID_PATTERN } from '../../utils/requestId';

const realCrypto = globalThis.crypto;

afterEach(() => {
  globalThis.crypto = realCrypto;
});

describe('newRequestId', () => {
  test('is a lowercase version-4 UUID and differs every time', () => {
    const ids = Array.from({ length: 200 }, () => newRequestId());

    expect(ids.every((id) => REQUEST_ID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(200);
  });

  test('without randomUUID it builds the same shape from getRandomValues', () => {
    const calls = [];
    globalThis.crypto = {
      getRandomValues: (bytes) => {
        calls.push(bytes.length);
        return realCrypto.getRandomValues(bytes);
      },
    };

    const ids = Array.from({ length: 200 }, () => newRequestId());

    expect(calls).toEqual(Array(200).fill(16));
    expect(ids.every((id) => REQUEST_ID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(200);
  });

  test('the version and variant bits are forced whatever the random bytes are', () => {
    globalThis.crypto = { getRandomValues: (bytes) => bytes.fill(0xff) };
    expect(newRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');

    globalThis.crypto = { getRandomValues: (bytes) => bytes.fill(0) };
    expect(newRequestId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  test('with no cryptographic source it throws instead of making a guessable id', () => {
    globalThis.crypto = undefined;
    expect(() => newRequestId()).toThrow();
  });
});

describe('REQUEST_ID_PATTERN', () => {
  test.each(['1', '', 'abc', '3f2b8c1e-5d4a-1b6e-9a7c-1d2e3f4a5b6c', '3F2B8C1E-5D4A-4B6E-9A7C-1D2E3F4A5B6C'])(
    'refuses %p',
    (value) => { expect(REQUEST_ID_PATTERN.test(value)).toBe(false); },
  );
});
