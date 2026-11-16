/**
 * A write forced by a read-only demo viewer (hidden controls are only presentation) is answered 403 by
 * the server. That is not an expired session: it must not log the viewer out, and the server's Hebrew
 * read-only message must reach the screen like any other server message.
 */
import { createAdminApi } from '../../services/adminService';
import { errorFrom } from '../../utils/apiErrors';

const READ_ONLY_MESSAGE = 'חשבון הצפייה בהדגמה הוא לקריאה בלבד';

afterEach(() => {
  delete global.fetch;
});

test('a 403 does not call onUnauthorized and the response is handed back', async () => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: false, status: 403, json: async () => ({ error: READ_ONLY_MESSAGE, details: { reason: 'demo_read_only' } }),
  }));
  const onUnauthorized = jest.fn();
  const api = createAdminApi(onUnauthorized);

  const res = await api.deleteOrder(5);

  expect(res.status).toBe(403);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('the screen can show the server message of a 403', async () => {
  const res = {
    ok: false, status: 403, json: async () => ({ error: READ_ONLY_MESSAGE, details: { reason: 'demo_read_only' } }),
  };

  const { message, details } = await errorFrom(res, 'הפעולה נכשלה');

  expect(message).toBe(READ_ONLY_MESSAGE);
  expect(details).toEqual({ reason: 'demo_read_only' });
});

test('a 401 still calls onUnauthorized', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'נדרשת התחברות כמנהל' }) }));
  const onUnauthorized = jest.fn();

  await createAdminApi(onUnauthorized).deleteOrder(5);

  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});
