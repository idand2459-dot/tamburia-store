/**
 * Numeric ids and PostgreSQL numeric overflow (P8.1 step A), without a network or a database.
 *
 * A value above INT4 (2147483647) cannot match a row, and PostgreSQL answers it with "value out
 * of range" (22003), which used to surface as a 500. This pins that the validators refuse such a
 * value with a 400 before any query, that the values just inside the limit still pass, and that
 * the error handler maps the PostgreSQL range errors to 400 if one ever reaches it.
 *
 * Environment values below are fixed dummies for this process only; nothing connects anywhere.
 */
process.env.ADMIN_PASSWORD = 'unit-test-password';
process.env.SESSION_SECRET = 'unit-test-session-secret';
process.env.DB_PASSWORD = 'unused-in-this-suite';
process.env.MAIL_ENABLED = 'false';
delete process.env.NODE_ENV;

const { MAX_INT4, isInt4Id } = require('../server/utils/ids');
const { idParam } = require('../server/middleware/validate');
const { errorHandler } = require('../server/middleware/errorHandler');
const reviewValidator = require('../server/api/review/review.validator');
const productValidator = require('../server/api/product/product.validator');
const orderValidator = require('../server/api/order/order.validator');
const pigmentValidator = require('../server/api/pigmentFormula/pigmentFormula.validator');

let passed = 0;
let failed = 0;

/** Records the result of one check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — got: ${JSON.stringify(actual)}`);
  }
}

/** Runs fn; returns the error it threw, or null. */
function thrown(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

/** True when fn throws a 400 AppError. */
function isBadRequest(fn) {
  const err = thrown(fn);
  return Boolean(err) && err.status === 400;
}

const OVER = String(MAX_INT4 + 1);
const HUGE = '99999999999';

/** A valid product review whose product_id is the given value. */
const reviewBody = (productId) => ({
  reviewer_name: 'Dana', text: 'Great', rating: 5, type: 'product', product_id: productId,
});

console.log('\n── isInt4Id');
check('MAX_INT4 is 2147483647', MAX_INT4 === 2147483647, MAX_INT4);
for (const [value, expected] of [
  [1, true], [MAX_INT4, true], [MAX_INT4 + 1, false], [0, false], [-1, false],
  [1.5, false], [1e21, false], [NaN, false], [Infinity, false], ['5', false], [null, false],
  // Unsafe JavaScript integers are far above INT4.
  [2 ** 53, false], [Number.MAX_SAFE_INTEGER, false], [2 ** 53 + 2, false],
]) {
  check(`isInt4Id(${String(value)}) is ${expected}`, isInt4Id(value) === expected, isInt4Id(value));
}

console.log('\n── idParam');
/** Runs the middleware and returns what it passed to next, plus req.id. */
function runIdParam(raw) {
  const req = { params: { id: raw } };
  let error;
  idParam(req, {}, (err) => { error = err; });
  return { error, id: req.id };
}
for (const raw of ['1', '42', String(MAX_INT4)]) {
  const { error, id } = runIdParam(raw);
  check(`id ${raw} passes`, !error && id === Number(raw), { error: error && error.message, id });
}
for (const raw of [OVER, HUGE, '1e21', 'abc', '0', '-5', '1.5', '']) {
  const { error } = runIdParam(raw);
  check(`id "${raw}" is a 400 with the usual message`,
    Boolean(error) && error.status === 400 && error.message === `מזהה לא תקין: "${raw}"`,
    error && { status: error.status, message: error.message });
}

/*
 * The validators convert raw input with Number() before checking it, and that conversion is kept
 * as it was: strings Number() reads as a whole number (hex, exponent, padded) are still accepted.
 * These pin the existing behaviour at the entry points so a later change to it is deliberate.
 */
console.log('\n── Number() conversion of strings (existing behaviour, unchanged)');
{
  const hex = runIdParam('0x10');
  check('idParam "0x10" is accepted as 16', !hex.error && hex.id === 16, { error: hex.error && hex.error.message, id: hex.id });
  const exp = runIdParam('1e3');
  check('idParam "1e3" is accepted as 1000', !exp.error && exp.id === 1000, { error: exp.error && exp.error.message, id: exp.id });
  for (const raw of [String(2 ** 53), String(Number.MAX_SAFE_INTEGER)]) {
    const { error } = runIdParam(raw);
    check(`idParam "${raw}" is a 400`, Boolean(error) && error.status === 400, error && error.message);
  }
  check('idParam "0x80000000" (2147483648) is a 400', Boolean(runIdParam('0x80000000').error));

  check('product ids "0x10" and "1e3" are accepted as 16 and 1000',
    JSON.stringify(productValidator.parseListQuery({ ids: '0x10,1e3' }).ids) === JSON.stringify([16, 1000]));
  check('product ids "9007199254740992" → 400', isBadRequest(() => productValidator.parseListQuery({ ids: String(2 ** 53) })));
  check('review product_id "0x10" is accepted as 16', reviewValidator.parseCreate(reviewBody('0x10')).product_id === 16);
  check('review product_id "1e3" is accepted as 1000', reviewValidator.parseCreate(reviewBody('1e3')).product_id === 1000);
  check('review product_id "9007199254740992" → 400', isBadRequest(() => reviewValidator.parseCreate(reviewBody(String(2 ** 53)))));
  check('list offset "0x10" and "1e3" are accepted',
    productValidator.parseListQuery({ offset: '0x10' }).offset === 16
    && productValidator.parseListQuery({ offset: '1e3' }).offset === 1000);
  check('list offset "9007199254740992" → 400', isBadRequest(() => productValidator.parseListQuery({ offset: String(2 ** 53) })));

  const itemIds = orderValidator.parseCreate({
    delivery_method: 'pickup', customer_name: 'Dana', customer_phone: '0501234567',
    items: ['0x10', '1e3', String(2 ** 53), 2 ** 53, Number.MAX_SAFE_INTEGER]
      .map((id) => ({ id, name: 'Brush', price: 10, quantity: 1 })),
  }).items.map((item) => item.id);
  check('order item ids: "0x10" → 16, "1e3" → 1000, unsafe integers → null',
    JSON.stringify(itemIds) === JSON.stringify([16, 1000, null, null, null]), itemIds);
}

console.log('\n── reviews');
check('product_id at INT4 max passes',
  reviewValidator.parseCreate(reviewBody(MAX_INT4)).product_id === MAX_INT4);
check('product_id above INT4 → 400', isBadRequest(() => reviewValidator.parseCreate(reviewBody(MAX_INT4 + 1))));
check('product_id 99999999999 → 400', isBadRequest(() => reviewValidator.parseCreate(reviewBody(99999999999))));
check('product_id 1e21 → 400', isBadRequest(() => reviewValidator.parseCreate(reviewBody(1e21))));
check('list filter product_id above INT4 → 400',
  isBadRequest(() => reviewValidator.parseListQuery({ product_id: OVER })));
check('list filter product_id at INT4 max passes',
  reviewValidator.parseListQuery({ product_id: String(MAX_INT4) }).productId === MAX_INT4);
check('offset at INT4 max passes', reviewValidator.parseListQuery({ offset: String(MAX_INT4) }).offset === MAX_INT4);
check('offset above INT4 → 400', isBadRequest(() => reviewValidator.parseListQuery({ offset: OVER })));
check('offset 1e21 → 400', isBadRequest(() => reviewValidator.parseListQuery({ offset: '1e21' })));
check('negative offset keeps its message',
  (thrown(() => reviewValidator.parseListQuery({ offset: '-1' })) || {}).message === 'offset חייב להיות מספר שלם אי-שלילי');

console.log('\n── products');
check('ids at INT4 max pass',
  JSON.stringify(productValidator.parseListQuery({ ids: `1,${MAX_INT4}` }).ids) === JSON.stringify([1, MAX_INT4]));
const badIds = thrown(() => productValidator.parseListQuery({ ids: `1,${OVER}` }));
check('ids with a value above INT4 → 400 with the usual message',
  Boolean(badIds) && badIds.status === 400 && badIds.message === `ids מכיל מזהה לא תקין: "${OVER}"`,
  badIds && badIds.message);
check('ids 99999999999 → 400', isBadRequest(() => productValidator.parseListQuery({ ids: HUGE })));
check('ids 0 still → 400', isBadRequest(() => productValidator.parseListQuery({ ids: '0' })));
check('offset at INT4 max passes', productValidator.parseListQuery({ offset: String(MAX_INT4) }).offset === MAX_INT4);
check('offset above INT4 → 400', isBadRequest(() => productValidator.parseListQuery({ offset: OVER })));
check('negative offset keeps its message',
  (thrown(() => productValidator.parseListQuery({ offset: '-1' })) || {}).message === 'offset חייב להיות מספר שלם אי-שלילי');

console.log('\n── orders');
const orderBody = (items) => ({
  delivery_method: 'pickup', customer_name: 'Dana', customer_phone: '0501234567', items,
});
const line = (id) => ({ id, name: 'Brush', price: 10, quantity: 1 });
const parsedIds = orderValidator.parseCreate(orderBody([
  line(5), line(MAX_INT4), line(MAX_INT4 + 1), line(99999999999), line(1e21), line(0), line('abc'),
])).items.map((item) => item.id);
check('item ids: valid ones kept, ones above INT4 or invalid become null (priceOrder refuses them)',
  JSON.stringify(parsedIds) === JSON.stringify([5, MAX_INT4, null, null, null, null, null]), parsedIds);
check('offset at INT4 max passes', orderValidator.parseListQuery({ offset: String(MAX_INT4) }).offset === MAX_INT4);
check('offset above INT4 → 400', isBadRequest(() => orderValidator.parseListQuery({ offset: OVER })));
check('negative offset keeps its message',
  (thrown(() => orderValidator.parseListQuery({ offset: '-1' })) || {}).message === 'offset חייב להיות מספר שלם אי-שלילי');

console.log('\n── pigment formulas');
const formulaBody = (sortOrder) => ({
  color_code: 'sky_blue', color_name_he: 'Sky', hex: '#87CEEB',
  ml_per_liter_light: 10, ml_per_liter_medium: 20, ml_per_liter_dark: 30, sort_order: sortOrder,
});
check('sort_order at INT4 max passes', pigmentValidator.parseCreate(formulaBody(MAX_INT4)).sort_order === MAX_INT4);
check('sort_order above INT4 → 400', isBadRequest(() => pigmentValidator.parseCreate(formulaBody(MAX_INT4 + 1))));
check('offset at INT4 max passes', pigmentValidator.parseListQuery({ offset: String(MAX_INT4) }).offset === MAX_INT4);
check('offset above INT4 → 400', isBadRequest(() => pigmentValidator.parseListQuery({ offset: OVER })));

console.log('\n── PostgreSQL error mapping');
/** Sends an error through the real error handler and returns the status it chose. */
function statusFor(code) {
  const err = new Error(`pg error ${code}`);
  err.code = code;
  let status;
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  errorHandler(err, { method: 'GET', originalUrl: '/api/test' }, res, () => {});
  return status;
}
for (const [code, expected] of [
  ['22003', 400], ['22001', 400], ['22007', 400], ['22008', 400],
  ['22P02', 400], ['23505', 409], ['23503', 409],
]) {
  check(`PostgreSQL ${code} → ${expected}`, statusFor(code) === expected, statusFor(code));
}

console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
