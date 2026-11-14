/**
 * The error handler (P8.1 step B), through the real middleware, without a network or a database.
 *
 * What it pins: the client is told only what this API wrote (an AppError, or a message defined in
 * server/middleware/errorHandler.js); the text of PostgreSQL, the body parser and any other library
 * is never sent, at any status; no response carries a stack trace; failures of 500 and above are
 * still logged with the full error.
 */
const { errorHandler } = require('../server/middleware/errorHandler');
const { AppError, badRequest, notFound, conflict, unprocessable } = require('../server/utils/AppError');

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

/** Sends an error through the real handler; returns the answer and what was logged. */
function run(err, req = { method: 'POST', originalUrl: '/api/test?secret=1' }) {
  const logged = { error: [], warn: [] };
  const original = { error: console.error, warn: console.warn };
  console.error = (...args) => logged.error.push(args);
  console.warn = (...args) => logged.warn.push(args);

  let status;
  let body;
  const res = {
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  };
  try {
    errorHandler(err, req, res, () => {});
  } finally {
    console.error = original.error;
    console.warn = original.warn;
  }
  return { status, body, text: JSON.stringify(body), logged };
}

/** A PostgreSQL-style error: code, an English message that names schema objects, and a detail with values. */
function pgError(code, message) {
  const err = new Error(message || `insert or update on table "reviews" violates foreign key constraint "reviews_product_id_fkey" (${code})`);
  err.code = code;
  err.detail = 'Key (customer_email)=(dana@example.com) is not present in table "products".';
  err.table = 'reviews';
  err.constraint = 'reviews_product_id_fkey';
  return err;
}

/** An error as body-parser raises it: an http-errors error with a status and a type. */
function parserError(type, status, message, extra = {}) {
  return Object.assign(new Error(message), { status, statusCode: status, type, expose: true, ...extra });
}

const RAW_PG = /violates|constraint|foreign key|insert or update|invalid input|out of range|too long|reviews|fkey|dana@example\.com|customer_email/i;

console.log('\n── PostgreSQL errors: the status stays, the text is the API\'s');
for (const [code, status, message] of [
  ['23505', 409, 'הערך כבר קיים במערכת'],
  ['23503', 409, 'הפעולה מפרה קישור לרשומה אחרת'],
  ['23514', 400, 'הערך לא עומד בכללי המערכת'],
  ['23502', 400, 'חסר שדה חובה'],
  ['22P02', 400, 'פורמט הערך שגוי'],
  ['22003', 400, 'ערך מספרי חורג מהטווח המותר'],
  ['22001', 400, 'הערך ארוך מדי'],
  ['22007', 400, 'תאריך לא תקין'],
  ['22008', 400, 'תאריך לא תקין'],
]) {
  const out = run(pgError(code));
  check(`${code} → ${status} with the mapped text`, out.status === status && out.body.error === message, out.body);
  check(`${code}: the body is { error } only, with no database text`,
    JSON.stringify(Object.keys(out.body)) === '["error"]' && !RAW_PG.test(out.text), out.text);
  check(`${code}: logged as one warning line with the code, not the detail, and not as an error`,
    out.logged.error.length === 0 && out.logged.warn.length === 1
    && out.logged.warn[0].length === 1 && String(out.logged.warn[0][0]).includes(code)
    && !RAW_PG.test(String(out.logged.warn[0][0])) && !String(out.logged.warn[0][0]).includes('secret=1'), out.logged.warn);
}
{
  const out = run(pgError('ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.5:5432'));
  check('ECONNREFUSED → 503 with the mapped text, nothing from the connection', out.status === 503
    && out.body.error === 'אין חיבור למסד הנתונים' && !/10\.0\.0\.5|5432/.test(out.text), out.body);
  check('ECONNREFUSED is logged as an error with the full error object',
    out.logged.error.length === 1 && out.logged.error[0][1] instanceof Error, out.logged.error.length);
}

console.log('\n── The PostgreSQL 4xx warning never logs the URL or the request');
{
  const PHONE = '0501234567';
  const NAME = 'Dana Levi';
  const EMAIL = 'dana.levi@example.com';
  // A request on a route whose path carries a customer's phone number, with every place the
  // phone (or other personal data) could be read from.
  const req = {
    method: 'GET',
    originalUrl: `/api/orders/by-phone/${PHONE}?search=${EMAIL}`,
    url: `/by-phone/${PHONE}?search=${EMAIL}`,
    baseUrl: '/api/orders',
    path: `/by-phone/${PHONE}`,
    params: { phone: PHONE },
    query: { search: EMAIL },
    body: { customer_name: NAME, customer_phone: PHONE, customer_email: EMAIL },
    route: { path: '/by-phone/:phone' },
  };
  const detailed = pgError('22P02', `invalid input syntax for type integer: "${PHONE}" (${NAME}, ${EMAIL})`);
  const out = run(detailed, req);

  const warned = JSON.stringify(out.logged.warn);
  check('one warning line, no error line', out.logged.warn.length === 1 && out.logged.error.length === 0, out.logged);
  check('the warning is the method and the PostgreSQL code only',
    out.logged.warn[0].length === 1 && out.logged.warn[0][0] === '⚠ GET → PostgreSQL 22P02', out.logged.warn);
  check('the phone number is not in the warning', !warned.includes(PHONE) && !warned.includes('0501234567'), warned);
  check('the name and the email are not in the warning', !warned.includes(NAME) && !warned.includes(EMAIL) && !warned.includes('dana'), warned);
  check('no URL, path, query or detail in the warning', !/by-phone|\/api|search=|customer_|Key \(|invalid input/.test(warned), warned);
  check('nothing is written to the error log',
    JSON.stringify(out.logged.error) === '[]', out.logged.error);

  check('the response is unchanged and safe: 400 with the mapped text, { error } only',
    out.status === 400 && out.body.error === 'פורמט הערך שגוי' && JSON.stringify(Object.keys(out.body)) === '["error"]', out.body);
  check('the response does not contain the phone, the name, the email or the database text',
    !out.text.includes(PHONE) && !out.text.includes(NAME) && !out.text.includes(EMAIL) && !RAW_PG.test(out.text), out.text);

  // The same for a 409, on a write route that carries personal data in the body.
  const conflictOut = run(pgError('23505'), { ...req, method: 'POST', originalUrl: `/api/orders/${PHONE}` });
  check('a 409 warning is also only the method and the code',
    conflictOut.status === 409 && conflictOut.logged.warn.length === 1
    && conflictOut.logged.warn[0][0] === '⚠ POST → PostgreSQL 23505' && !JSON.stringify(conflictOut.logged.warn).includes(PHONE),
    conflictOut.logged.warn);
}

console.log('\n── The body parser: Hebrew text, never its own');
for (const [type, status, message, text] of [
  ['entity.parse.failed', 400, 'Unexpected token } in JSON at position 5', 'גוף הבקשה אינו JSON תקין'],
  ['entity.too.large', 413, 'request entity too large', 'גוף הבקשה גדול מדי'],
  ['encoding.unsupported', 415, 'unsupported content encoding "br"', 'קידוד הבקשה אינו נתמך'],
  ['charset.unsupported', 415, 'unsupported charset "LATIN1"', 'קידוד הבקשה אינו נתמך'],
  ['request.aborted', 400, 'request aborted', 'הבקשה נקטעה לפני שהתקבלה במלואה'],
  ['request.size.invalid', 400, 'request size did not match content length', 'גודל הבקשה אינו תואם לתוכן שנשלח'],
]) {
  const out = run(parserError(type, status, message, { body: '{"customer_name":"Dana' }));
  check(`${type} → ${status} with the Hebrew text`, out.status === status && out.body.error === text, out.body);
  check(`${type}: the parser's text and the request body are not sent`,
    !/Unexpected|position|entity|unsupported|aborted|did not match|Dana|customer_name/.test(out.text), out.text);
  check(`${type}: not logged (a bad request is not a server failure)`, out.logged.error.length === 0 && out.logged.warn.length === 0, out.logged);
}

console.log('\n── AppError: message and details exactly as written');
{
  const details = { reason: 'out_of_stock', unavailable: [{ id: 1, name: 'Brush' }], prices: [{ id: 2, price: 12.9 }] };
  const out = run(conflict('המוצר "מברשת" אינו זמין כרגע', details));
  check('409 keeps its text and its details', out.status === 409 && out.body.error === 'המוצר "מברשת" אינו זמין כרגע'
    && JSON.stringify(out.body.details) === JSON.stringify(details), out.body);
  check('an AppError is not logged', out.logged.error.length === 0 && out.logged.warn.length === 0, out.logged);

  for (const [name, err, status] of [
    ['badRequest', badRequest('שדה חסר'), 400],
    ['notFound', notFound('הזמנה 5 לא נמצאה'), 404],
    ['unprocessable', unprocessable('מזהה בשימוש', { reason: 'request_id_reused' }), 422],
    ['AppError 401', new AppError(401, 'נדרשת התחברות כמנהל'), 401],
    ['AppError 429', new AppError(429, 'יותר מדי ניסיונות התחברות (עוד 30 שניות)'), 429],
  ]) {
    const result = run(err);
    check(`${name} → ${status} with its own message`, result.status === status && result.body.error === err.message, result.body);
  }
  check('an AppError without details has no details key', !('details' in run(badRequest('x')).body), run(badRequest('x')).body);
  const unprocessableOut = run(unprocessable('מזהה בשימוש', { reason: 'request_id_reused' }));
  check('422 keeps details.reason', unprocessableOut.body.details.reason === 'request_id_reused', unprocessableOut.body);

  const serverSide = run(new AppError(500, 'internal detail that must not leave'));
  check('an AppError of 500 answers with the generic text, and is logged',
    serverSide.status === 500 && serverSide.body.error === 'שגיאת שרת פנימית' && !/internal detail/.test(serverSide.text)
    && serverSide.logged.error.length === 1, serverSide);
}

console.log('\n── Any other error with a 4xx status: a generic text by status');
for (const [status, text] of [
  [400, 'הבקשה אינה תקינה'], [403, 'אין הרשאה לפעולה הזו'], [404, 'המשאב לא נמצא'],
  [416, 'טווח הבקשה אינו תקין'], [418, 'הבקשה נדחתה'],
]) {
  const err = Object.assign(new Error('ENOENT: no such file or directory, open \'C:\\app\\secret.txt\''), { status });
  const out = run(err);
  check(`${status} → the generic text, not the error's own`, out.status === status && out.body.error === text
    && !/ENOENT|secret|C:/.test(out.text), out.body);
}
{
  const onlyStatusCode = run(Object.assign(new Error('Failed to decode param \'%E0%A4%A\''), { statusCode: 400 }));
  check('statusCode alone is honoured', onlyStatusCode.status === 400 && onlyStatusCode.body.error === 'הבקשה אינה תקינה'
    && !/decode|param/.test(onlyStatusCode.text), onlyStatusCode.body);
  const withDetails = run(Object.assign(new Error('x'), { status: 400, details: { leaked: true } }));
  check('details from an error that is not an AppError are not sent', !('details' in withDetails.body), withDetails.body);
}

console.log('\n── Everything else: 500, generic, logged with the stack');
{
  const err = new TypeError('Cannot read properties of undefined (reading \'secretField\')');
  const out = run(err);
  check('an unexpected error → 500 with the generic text', out.status === 500 && out.body.error === 'שגיאת שרת פנימית'
    && JSON.stringify(Object.keys(out.body)) === '["error"]' && !/secretField|properties/.test(out.text), out.body);
  check('it is logged once with the route and the error object (stack kept in the log)',
    out.logged.error.length === 1 && String(out.logged.error[0][0]).includes('POST /api/test?secret=1')
    && out.logged.error[0][1] === err && typeof err.stack === 'string' && err.stack.length > 0, out.logged.error);

  const unavailable = run(Object.assign(new Error('upstream said: secret'), { status: 503 }));
  check('a 503 from elsewhere keeps 503 with the generic text', unavailable.status === 503
    && unavailable.body.error === 'שגיאת שרת פנימית' && !/secret/.test(unavailable.text), unavailable.body);
}

console.log('\n── multer: unchanged');
{
  const limit = run(Object.assign(new Error('File too large'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' }));
  check('LIMIT_FILE_SIZE → 413', limit.status === 413 && /MB/.test(limit.body.error), limit.body);
  const count = run(Object.assign(new Error('Too many files'), { name: 'MulterError', code: 'LIMIT_FILE_COUNT' }));
  check('LIMIT_FILE_COUNT → 400', count.status === 400 && count.body.error === 'נשלחו יותר קבצים מהמותר', count.body);
}

console.log('\n── No stack in any response, whatever the environment');
{
  const noStack = (err) => {
    const out = run(err);
    return !('stack' in out.body) && !/\n\s+at |\.js:\d+/.test(out.text);
  };
  for (const [name, err] of [
    ['unexpected error', new Error('boom')],
    ['PostgreSQL 4xx', pgError('23505')],
    ['PostgreSQL 503', pgError('57P01', 'terminating connection due to administrator command')],
    ['AppError 400', badRequest('x')],
    ['AppError 500', new AppError(500, 'x')],
    ['parser error', parserError('entity.parse.failed', 400, 'bad json')],
    ['4xx from elsewhere', Object.assign(new Error('x'), { status: 404 })],
    ['5xx from elsewhere', Object.assign(new Error('x'), { status: 502 })],
  ]) {
    check(`${name}: no stack in the body`, noStack(err));
  }
  for (const env of ['development', 'production', undefined]) {
    if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    check(`NODE_ENV=${env}: no stack in the body`, noStack(new Error('boom')));
  }
  delete process.env.NODE_ENV;
  check('the handler does not read the environment configuration',
    !Object.keys(require.cache).some((file) => /server[\\/]config[\\/]env\.js$/.test(file)));
}

console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
