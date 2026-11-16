/**
 * Whether this server is the portfolio demo (plan 006). One public GET; the answer decides whether the
 * storefront shows the demo banner and the demo checkout, and the admin its read-only viewer entry.
 */
import { getJson } from './http';

/** The message when the server answered the demo question with an error. */
const DEMO_INFO_FAILED = 'לא ניתן לבדוק אם זה אתר הדגמה';

/**
 * GET /api/demo — { demo: false } on the real store, or { demo: true, identities } in the demo, where
 * `identities` are the three fictional customers the checkout accepts.
 */
export async function getDemoInfo({ signal } = {}) {
  return getJson('/api/demo', { signal, fallback: DEMO_INFO_FAILED });
}
