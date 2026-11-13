/**
 * The request id of an order attempt: a version-4 UUID, the shape the server requires
 * (server/api/order/order.validator.js). It comes from the browser's cryptographic random
 * source only; a guessable id would let someone replay another customer's attempt.
 */

/** The shape of a request id: lowercase version-4 UUID. */
export const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A new request id. Throws when the browser has no cryptographic random source. */
export function newRequestId() {
  const webCrypto = typeof window === 'undefined' ? undefined : window.crypto;
  if (!webCrypto) throw new Error('no cryptographic random source');

  // randomUUID exists only in secure contexts (https or localhost), so build one when it is missing.
  if (typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
