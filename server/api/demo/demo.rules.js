/**
 * The fixed fictional data of the portfolio demo: the three customer identities a demo order may
 * carry, the one note it may carry, the reviewers of the curated reviews, and the tag that marks a
 * seeded order. One source for the server, the seed and the tests (plan 006, Phases 3 to 6).
 *
 * Everything here is invented: the names are placeholders, the phones are in the unassigned
 * 050-00000xx block the earlier demo seed used, the emails are on the reserved example.invalid
 * domain, and the addresses are on fictional streets in the three delivery cities. A demo database
 * never holds a value outside these sets, which is what makes a read-only viewer safe.
 */
const { badRequest } = require('../../utils/AppError');

/** The three identities. Each field fits the existing order limits (name at most 30 characters). */
const IDENTITIES = [
  {
    key: 'demo-1',
    customer_name: 'דנה דמו',
    customer_phone: '050-0000011',
    customer_email: 'dana.demo@example.invalid',
    delivery_address: 'רחוב הדגמה 1, פתח תקווה',
  },
  {
    key: 'demo-2',
    customer_name: 'יוסי דוגמה',
    customer_phone: '050-0000012',
    customer_email: 'yossi.example@example.invalid',
    delivery_address: 'שדרות לדוגמה 2, קריית אונו',
  },
  {
    key: 'demo-3',
    customer_name: 'מיכל מדומה',
    customer_phone: '050-0000013',
    customer_email: 'michal.fictional@example.invalid',
    delivery_address: 'סמטת הניסוי 3, גני תקווה',
  },
];

/** The only note a demo order may carry (besides none). */
const DEMO_NOTE = 'הזמנת הדגמה — לא תטופל ולא תישלח';

/** The reviewers of the curated demo reviews: the only reviewer names a demo database holds. */
const REVIEWER_NAMES = ['לקוח לדוגמה', 'לקוחה לדוגמה', 'קבלן לדוגמה', 'דיירת לדוגמה', 'בעל בית לדוגמה'];

/** A seeded order carries request_id = `demo-seed:NN`; the public API accepts only a UUID v4. */
const SEED_TAG_PREFIX = 'demo-seed:';

/** The phones of the three identities. */
const IDENTITY_PHONES = IDENTITIES.map((identity) => identity.customer_phone);

/** The identity that matches the customer fields exactly, or undefined. */
function findIdentity({ customer_name, customer_phone, customer_email }) {
  return IDENTITIES.find((identity) => identity.customer_name === customer_name
    && identity.customer_phone === customer_phone
    && identity.customer_email === customer_email);
}

/**
 * Throws a 400 unless the order's customer fields are exactly one of the three identities. A pickup
 * order carries no address and a delivery order carries that identity's address; notes are empty or
 * DEMO_NOTE. The messages are Hebrew and never repeat what the visitor typed.
 */
function assertDemoOrder({ customer_name, customer_phone, customer_email, delivery_method, delivery_address, notes }) {
  const identity = findIdentity({ customer_name, customer_phone, customer_email });
  if (!identity) {
    throw badRequest(
      'באתר ההדגמה אפשר להזמין רק עם פרטי ההדגמה. השתמשו בכפתור "מילוי פרטי הדגמה" ואל תכניסו פרטים אמיתיים',
      { reason: 'demo_identity_only' }
    );
  }

  if (delivery_method === 'delivery' && delivery_address !== identity.delivery_address) {
    throw badRequest('באתר ההדגמה כתובת המשלוח היא כתובת ההדגמה בלבד', { reason: 'demo_identity_only' });
  }
  if (delivery_method !== 'delivery' && delivery_address) {
    throw badRequest('הזמנת איסוף עצמי אינה כוללת כתובת', { reason: 'demo_identity_only' });
  }

  if (notes !== null && notes !== undefined && notes !== '' && notes !== DEMO_NOTE) {
    throw badRequest('באתר ההדגמה אי אפשר להוסיף הערות להזמנה', { reason: 'demo_identity_only' });
  }
}

module.exports = {
  IDENTITIES, IDENTITY_PHONES, DEMO_NOTE, REVIEWER_NAMES, SEED_TAG_PREFIX, findIdentity, assertDemoOrder,
};
