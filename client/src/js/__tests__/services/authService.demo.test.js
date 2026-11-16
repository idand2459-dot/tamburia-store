/**
 * The session helpers of the portfolio demo: getSession reads the role from GET /api/auth/me (null when
 * not logged in, also on any failure), and demoLogin enters the public viewer session.
 */
import { getSession, demoLogin, ApiError } from '../../services/authService';

/** A fetch response. */
const reply = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

afterEach(() => {
  delete global.fetch;
});

describe('getSession', () => {
  test('returns the owner role', async () => {
    global.fetch = jest.fn(() => reply(200, { authenticated: true, role: 'owner', expiresAt: 1 }));

    await expect(getSession()).resolves.toEqual({ role: 'owner' });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me');
  });

  test('returns the viewer role', async () => {
    global.fetch = jest.fn(() => reply(200, { authenticated: true, role: 'viewer', expiresAt: 1 }));

    await expect(getSession()).resolves.toEqual({ role: 'viewer' });
  });

  test('an answer without a known role is not given extra rights: it is the owner view only because the server let it in', async () => {
    global.fetch = jest.fn(() => reply(200, { authenticated: true }));

    await expect(getSession()).resolves.toEqual({ role: 'owner' });
  });

  test('401, a server error and a network failure are all "not logged in"', async () => {
    global.fetch = jest.fn(() => reply(401, {}));
    await expect(getSession()).resolves.toBeNull();

    global.fetch = jest.fn(() => reply(500, {}));
    await expect(getSession()).resolves.toBeNull();

    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(getSession()).resolves.toBeNull();
  });
});

describe('demoLogin', () => {
  test('posts to the viewer entry with no password', async () => {
    global.fetch = jest.fn(() => reply(200, { authenticated: true, role: 'viewer' }));

    await expect(demoLogin()).resolves.toMatchObject({ role: 'viewer' });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/auth/demo-login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({});
  });

  test('a refusal (404 outside the demo, 429 too many attempts) is an ApiError with the server message', async () => {
    global.fetch = jest.fn(() => reply(429, { error: 'יותר מדי ניסיונות התחברות' }));

    const error = await demoLogin().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.message).toBe('יותר מדי ניסיונות התחברות');
  });
});
