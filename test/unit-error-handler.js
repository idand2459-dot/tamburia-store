/**
 * The error handler (P8.1 step B), through the real middleware, without a network or a database.
 *
 * What it pins: the client is told only what this API wrote (an AppError, or a message defined in
 * server/middleware/errorHandler.js); the text of PostgreSQL, the body parser and any other library
 * is never sent, at any status; no response carries a stack trace. Failures of 500 and above are
 * logged as one line of safe fields (P8.2 part B): never the error object, its message or stack, never
 * the request URL, and never anything a customer typed. All data below is synthetic.
 */
const { errorHandler, rememberMount } = require('../server/middleware/errorHandler');
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
  const logged = { error: [], warn: [], log: [] };
  const original = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...args) => logged.error.push(args);
  console.warn = (...args) => logged.warn.push(args);
  console.log = (...args) => logged.log.push(args);

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
    console.log = original.log;
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
  check('ECONNREFUSED is logged as one safe line: method, status, category and code, not the address',
    out.logged.error.length === 1 && out.logged.error[0].length === 1
    && out.logged.error[0][0] === '✗ POST (no route) → 503 [database ECONNREFUSED]', out.logged.error);
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

console.log('\n── 5xx log line: no personal data, whatever the error and the request carry');
{
  const PHONE = '0501234567';
  const NAME = 'Dana Levi';
  const EMAIL = 'dana.levi@example.com';
  const ADDRESS = 'Herzl 12, Haifa';
  const NOTES = 'leave with the neighbour';
  const REQUEST_ID = '3f2b1c4e-8a9d-4e6f-b1a2-0c9d8e7f6a5b';
  const PERSONAL = [PHONE, NAME, EMAIL, ADDRESS, NOTES, 'dana', 'Levi', 'Herzl', 'neighbour'];
  const mentions = (text) => PERSONAL.filter((value) => String(text).includes(value));

  /** A request on a route whose URL, params, query and body all hold personal data. */
  const personalRequest = (extra = {}) => ({
    method: 'POST',
    originalUrl: `/api/orders/${PHONE}?email=${EMAIL}`,
    url: `/${PHONE}?email=${EMAIL}`,
    baseUrl: '/api/orders',
    path: `/${PHONE}`,
    params: { phone: PHONE },
    query: { email: EMAIL },
    body: {
      request_id: REQUEST_ID, customer_name: NAME, customer_phone: PHONE, customer_email: EMAIL,
      delivery_address: ADDRESS, notes: NOTES,
    },
    route: { path: '/' },
    ...extra,
  });

  // A PostgreSQL error whose every text field repeats the values of the failed statement.
  const pgWithValues = (code) => Object.assign(
    new Error(`invalid input syntax for type integer: "${NAME}" in row (${PHONE}, ${EMAIL})`),
    {
      code, severity: 'ERROR', routine: 'pg_strtoint32', table: 'orders', column: 'customer_name',
      detail: `Failing row contains (${NAME}, ${PHONE}, ${EMAIL}, ${ADDRESS}, ${NOTES}).`,
      where: `PL/pgSQL function f(${EMAIL})`, hint: NOTES, internalQuery: `SELECT '${PHONE}'`,
    },
  );

  {
    const out = run(pgWithValues('54000'), personalRequest());
    const text = JSON.stringify(out.logged);
    check('PostgreSQL 5xx → logged once, as one string', out.logged.error.length === 1
      && out.logged.error[0].length === 1 && typeof out.logged.error[0][0] === 'string', out.logged.error);
    check('PostgreSQL 5xx: the line has the method, the route template, the status, the category, the SQLSTATE and the request id',
      out.logged.error[0][0] === `✗ POST /api/orders/ → 500 [database 54000] request_id=${REQUEST_ID}`, out.logged.error);
    check('PostgreSQL 5xx: no message, detail, where, hint or query in the log',
      !/invalid input|Failing row|PL\/pgSQL|SELECT|pg_strtoint32|customer_name/.test(text), out.logged);
    check('PostgreSQL 5xx: no phone, name, email, address or notes in the log', mentions(text).length === 0, mentions(text));
    check('PostgreSQL 5xx: the URL, the params and the query are not in the log',
      !/originalUrl|email=/.test(text) && !text.includes(`/api/orders/${PHONE}`), text);
    check('PostgreSQL 5xx: the response is the unchanged generic 500',
      out.status === 500 && out.body.error === 'שגיאת שרת פנימית' && JSON.stringify(Object.keys(out.body)) === '["error"]'
      && mentions(out.text).length === 0, out.body);
    check('PostgreSQL 5xx: nothing else is written to the log', out.logged.warn.length === 0 && out.logged.log.length === 0, out.logged);
  }

  {
    const err = Object.assign(new TypeError(`Cannot read properties of null (reading '${NAME}') for ${EMAIL} at ${ADDRESS}`), {
      customer: { name: NAME, phone: PHONE }, details: { notes: NOTES },
    });
    const out = run(err, personalRequest({ method: 'PUT', route: { path: '/:id' } }));
    const text = JSON.stringify(out.logged);
    check('an unexpected error → one line with the class name, not the message',
      out.logged.error.length === 1 && out.logged.error[0].length === 1
      && out.logged.error[0][0] === `✗ PUT /api/orders/:id → 500 [unexpected TypeError] request_id=${REQUEST_ID}`, out.logged.error);
    check('an unexpected error: no personal data and no stack in the log',
      mentions(text).length === 0 && !/\n\s+at |\.js:\d+/.test(text), text);
    check('an unexpected error: the response is the unchanged generic 500',
      out.status === 500 && out.body.error === 'שגיאת שרת פנימית' && mentions(out.text).length === 0, out.body);
  }

  {
    const out = run(new AppError(500, `could not save the order of ${NAME} (${PHONE})`), personalRequest());
    check('an AppError of 500: the category is app and its message is not logged',
      out.logged.error.length === 1 && String(out.logged.error[0][0]).includes('[app]')
      && mentions(JSON.stringify(out.logged)).length === 0, out.logged.error);
    check('an AppError of 500: the response keeps its status and the generic text',
      out.status === 500 && out.body.error === 'שגיאת שרת פנימית', out.body);
  }

  {
    const out = run(Object.assign(new Error(`connect ECONNREFUSED 10.0.0.5:5432 for ${EMAIL}`), { code: 'ECONNREFUSED' }), personalRequest());
    check('a connection failure keeps its status and code and logs nothing else',
      out.status === 503 && out.logged.error[0][0] === `✗ POST /api/orders/ → 503 [database ECONNREFUSED] request_id=${REQUEST_ID}`
      && mentions(JSON.stringify(out.logged)).length === 0, out.logged.error);
  }

  {
    const out = run(Object.assign(new Error(`write ${NAME}`), { code: 'EPIPE' }), personalRequest());
    check('a system error is the system category with its code', String(out.logged.error[0][0]).includes('[system EPIPE]'), out.logged.error);
  }

  {
    const err = Object.assign(new Error('x'), { name: NAME, code: EMAIL });
    const out = run(err, personalRequest({ body: { request_id: `${NAME}-${PHONE}`, customer_phone: PHONE } }));
    check('a name or a code that is not a plain token is dropped, and so is a request id that is not a UUID',
      out.logged.error[0][0] === '✗ POST /api/orders/ → 500 [unexpected]'
      && mentions(JSON.stringify(out.logged)).length === 0, out.logged.error);
  }

  {
    const out = run(new Error('x'), { method: 'GET', originalUrl: `/api/orders/${PHONE}`, baseUrl: `/api/${NAME}`, route: { path: '/by/:phone' }, body: undefined });
    check('a mount path with unsafe characters is dropped, the route template stays',
      out.logged.error[0][0] === '✗ GET /by/:phone → 500 [unexpected Error]'
      && mentions(JSON.stringify(out.logged)).length === 0, out.logged.error);

    const unmatched = run(new Error('x'), { method: 'GET', originalUrl: `/api/orders/${PHONE}`, route: undefined });
    check('a request that matched no route is logged as (no route), never by its URL',
      unmatched.logged.error[0][0] === '✗ GET (no route) → 500 [unexpected Error]', unmatched.logged.error);

    const oddMethod = run(new Error('x'), { method: NAME, originalUrl: '/x' });
    check('a method that is not a plain verb is logged as UNKNOWN',
      String(oddMethod.logged.error[0][0]).startsWith('✗ UNKNOWN '), oddMethod.logged.error);
  }

  {
    // Below 500 nothing changes: an AppError is not logged, a database 4xx is one warning with the code.
    const four = run(pgWithValues('22P02'), personalRequest());
    check('a PostgreSQL 4xx: one warning with the method and the code, no error line',
      four.status === 400 && four.logged.error.length === 0 && four.logged.warn.length === 1
      && four.logged.warn[0][0] === '⚠ POST → PostgreSQL 22P02' && mentions(JSON.stringify(four.logged)).length === 0, four.logged);
    const app = run(badRequest('bad phone number'), personalRequest());
    check('an AppError 400 is answered with its own text and is not logged',
      app.status === 400 && app.body.error === 'bad phone number' && app.logged.error.length === 0 && app.logged.warn.length === 0, app);
  }
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

console.log('\n── Everything else: 500, generic, logged as safe fields');
{
  const err = new TypeError('Cannot read properties of undefined (reading \'secretField\')');
  const out = run(err);
  check('an unexpected error → 500 with the generic text', out.status === 500 && out.body.error === 'שגיאת שרת פנימית'
    && JSON.stringify(Object.keys(out.body)) === '["error"]' && !/secretField|properties/.test(out.text), out.body);
  check('it is logged once as a line of safe fields: method, status, category and the class name',
    out.logged.error.length === 1 && out.logged.error[0].length === 1
    && out.logged.error[0][0] === '✗ POST (no route) → 500 [unexpected TypeError]', out.logged.error);
  check('the log has neither the URL, nor the message, nor the stack',
    !/secret|secretField|properties|api\/test|\n\s+at /.test(JSON.stringify(out.logged)), out.logged.error);

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

console.log('\n── Through a real Express app: the route template, not the URL, reaches the log');
async function realApp() {
  const express = require('express');
  const PHONE = '0501234567';
  const EMAIL = 'dana.levi@example.com';
  const app = express();
  app.use(express.json());
  const orders = express.Router();
  orders.post('/:id', () => {
    throw Object.assign(new Error(`invalid input syntax: "${EMAIL}" (${PHONE})`), { code: '54000', severity: 'ERROR', detail: `(${PHONE})` });
  });
  app.use('/api/orders', rememberMount, orders);
  app.use(errorHandler);

  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const logged = [];
  const original = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...args) => logged.push(args);
  console.warn = (...args) => logged.push(args);
  console.log = (...args) => logged.push(args);
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${server.address().port}/api/orders/${PHONE}?email=${EMAIL}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: '3f2b1c4e-8a9d-4e6f-b1a2-0c9d8e7f6a5b', customer_phone: PHONE }),
    });
  } finally {
    Object.assign(console, original);
    await new Promise((resolve) => server.close(resolve));
  }
  const text = JSON.stringify(logged);
  check('a real route error: the line is the method, the mounted route template and the request id',
    logged.length === 1 && logged[0][0] === '✗ POST /api/orders/:id → 500 [database 54000] request_id=3f2b1c4e-8a9d-4e6f-b1a2-0c9d8e7f6a5b', logged);
  check('a real route error: the phone number and the email are not in the log', !text.includes(PHONE) && !text.includes(EMAIL), text);
  check('a real route error: the response is the generic 500', res.status === 500 && (await res.json()).error === 'שגיאת שרת פנימית', res.status);
}

realApp().then(() => {
  console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}, (err) => {
  console.log(`  ✗ the real-app check crashed — ${err.message}`);
  process.exitCode = 1;
});
