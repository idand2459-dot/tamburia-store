/**
 * Tests services/email in isolation: no SMTP, no network, no database.
 *
 * What is pinned here is the contract the order flow depends on, since an order waits for its two
 * emails before it answers the customer: a send never throws and never waits forever, a send that
 * timed out is reported as an unknown outcome (sent: false, reason 'timeout'), its timer is
 * always cleared, and a late rejection of the send that lost the race cannot become an unhandled
 * rejection. `nodemailer` and the configuration are replaced through require.cache, so the real
 * environment is never read.
 */
const path = require('path');
const Module = require('module');

let passed = 0;
let failed = 0;

/** Records the result of a single check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — got: ${JSON.stringify(actual)}`);
  }
}

const TRANSPORTER_PATH = path.resolve(__dirname, '../server/services/email/transporter.js');
const INDEX_PATH = path.resolve(__dirname, '../server/services/email/index.js');
const CONFIG_PATH = path.resolve(__dirname, '../server/config/env.js');
const NODEMAILER_PATH = require.resolve('nodemailer');

/** Puts a fake module in require.cache under an absolute path. */
function injectFake(resolvedPath, fakeExports) {
  const fake = new Module(resolvedPath);
  fake.exports = fakeExports;
  fake.loaded = true;
  require.cache[resolvedPath] = fake;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* The timers the module under test creates, so that "always cleared" can be asserted. */
const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;
const active = new Set();
global.setTimeout = (fn, ms, ...rest) => {
  const timer = realSetTimeout((...args) => { active.delete(timer); fn(...args); }, ms, ...rest);
  active.add(timer);
  return timer;
};
global.clearTimeout = (timer) => {
  active.delete(timer);
  return realClearTimeout(timer);
};

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));

/** Loads the email modules over a fake transport whose sendMail is `sendMail`. */
function load(sendMail, { enabled = true } = {}) {
  const created = [];
  injectFake(NODEMAILER_PATH, {
    createTransport: (options) => { created.push(options); return { sendMail }; },
  });
  injectFake(CONFIG_PATH, {
    mail: { enabled, user: 'u', pass: 'p', from: 'shop@example.com', to: 'store.owner@example.com' },
  });
  delete require.cache[TRANSPORTER_PATH];
  delete require.cache[INDEX_PATH];
  return { transporter: require(TRANSPORTER_PATH), email: require(INDEX_PATH), created };
}

const message = { to: 'a@example.com', subject: 'נושא', html: '<p>x</p>' };

async function testSend() {
  console.log('\n── send');

  const ok = load(async () => ({ accepted: ['a@example.com'] }));
  check('a successful send is sent: true', (await ok.transporter.send(message)).sent === true, null);
  check('its timer is cleared', active.size === 0, active.size);

  const options = ok.created[0];
  check('the transport has bounded connection, greeting, dns and socket timeouts',
    options.connectionTimeout > 0 && options.greetingTimeout > 0 && options.dnsTimeout > 0
      && options.socketTimeout > 0 && options.socketTimeout <= 10_000, options);

  const failing = load(async () => { throw new Error('boom'); });
  const result = await failing.transporter.send(message);
  check('a rejected send does not throw', result.sent === false && result.reason === 'delivery_failed', result);
  check('its timer is cleared too', active.size === 0, active.size);

  const none = await ok.transporter.send({ ...message, to: '' });
  check('no recipient → sent: false', none.sent === false, none);
}

async function testTimeout() {
  console.log('\n── deadline');

  const hung = load(() => new Promise(() => {}));
  const started = Date.now();
  const result = await hung.transporter.send(message, { deadlineMs: 40 });
  check('a send that never answers resolves with an unknown outcome',
    result.sent === false && result.reason === 'timeout', result);
  check('and does so near the deadline, not forever', Date.now() - started < 1000, Date.now() - started);
  check('the deadline timer is cleared', active.size === 0, active.size);

  // The send that lost the race rejects afterwards: nobody awaits it any more.
  const late = load(() => new Promise((_, reject) => { realSetTimeout(() => reject(new Error('late')), 80); }));
  const lateResult = await late.transporter.send(message, { deadlineMs: 20 });
  await wait(200);
  check('a late rejection is still reported as the timeout', lateResult.reason === 'timeout', lateResult);
  check('and is not an unhandled rejection', unhandled.length === 0, unhandled.map(String));

  // The send that lost the race succeeds afterwards: the outcome stays "unknown", not "sent".
  const slowOk = load(() => new Promise((resolve) => { realSetTimeout(() => resolve({}), 80); }));
  const slowResult = await slowOk.transporter.send(message, { deadlineMs: 20 });
  check('a send that finishes after the deadline is not reported as sent', slowResult.sent === false, slowResult);
  await wait(150);
}

async function testIndex() {
  console.log('\n── services/email');

  const { email } = load(async () => ({}));
  const order = { id: 1, customer_name: 'ישראל', customer_email: 'a@example.com', items: [], total: 1 };

  let threw = null;
  let broken;
  try { broken = await email.sendNewOrderToStore(null); } catch (err) { threw = err; }
  check('a template that throws does not throw out of the sender', threw === null, threw && threw.message);
  check('and reports sent: false with the fixed reason build_failed', broken && broken.sent === false && broken.reason === 'build_failed', broken);

  let customer;
  try { customer = await email.sendOrderConfirmationToCustomer({ ...order, customer_email: null }); } catch (err) { threw = err; }
  check('no customer address → sent: false, no throw', customer && customer.sent === false, customer);

  check('no pending timers are left behind', active.size === 0, active.size);
}

/** Runs `fn` and returns what it wrote to the console, one string per call, with the result. */
async function captureLogs(fn) {
  const lines = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const record = (...args) => lines.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' '));
  console.log = record; console.error = record; console.warn = record; console.info = record;
  try {
    const result = await fn();
    return { result, lines, text: lines.join('\n') };
  } finally {
    Object.assign(console, original);
  }
}

/** Mail logs: the outcome and a fixed label, never the recipient, the subject or the text of an error. (Synthetic data.) */
async function testLogs() {
  console.log('\n── mail logs hold no personal data');

  const NAME = 'Dana Levi';
  const EMAIL = 'dana.levi@example.com';
  const PHONE = '0501234567';
  const ADDRESS = 'Herzl 12, Haifa';
  const NOTES = 'leave with the neighbour';
  const PERSONAL = [NAME, 'Dana', 'Levi', EMAIL, 'dana.levi', PHONE, ADDRESS, 'Herzl', NOTES, 'neighbour', 'store.owner@example.com'];
  const leaks = (text) => PERSONAL.filter((value) => text.includes(value));
  const order = {
    id: 7, customer_name: NAME, customer_phone: PHONE, customer_email: EMAIL, delivery_method: 'delivery',
    delivery_address: ADDRESS, notes: NOTES, items: [], subtotal: 10, delivery_fee: 0, total: 10, status: 'new',
  };
  const subject = `📦 הזמנה חדשה #7 — ${NAME}`;

  // success
  const ok = load(async () => ({ accepted: [EMAIL] }));
  const sent = await captureLogs(() => ok.email.sendNewOrderToStore(order));
  check('a successful send is still sent: true', sent.result.sent === true, sent.result);
  check('the success line has the label and the outcome', sent.lines.length === 1
    && sent.lines[0] === 'mail sent | new-order store #7 ✓', sent.lines);
  check('the success line has no recipient, name or subject', leaks(sent.text).length === 0, leaks(sent.text));

  const customer = await captureLogs(() => ok.email.sendOrderConfirmationToCustomer(order));
  check('the customer confirmation is logged by label only', customer.result.sent === true
    && customer.lines[0] === 'mail sent | order-confirmation customer #7 ✓' && leaks(customer.text).length === 0, customer.lines);

  const status = await captureLogs(() => ok.email.sendStatusUpdateToCustomer(order, 'shipped'));
  check('a status update is logged by label only', status.result.sent === true
    && status.lines[0] === 'mail sent | status-update customer #7 ✓' && leaks(status.text).length === 0, status.lines);

  // failure whose message repeats the recipient, the name and the subject
  const unsafe = Object.assign(new Error(`Can't send mail - all recipients were rejected: 550 <${EMAIL}> unknown user, subject "${subject}"`), {
    code: 'EENVELOPE', responseCode: 550, command: `RCPT TO:<${EMAIL}>`, response: `550 ${EMAIL}`,
  });
  const failing = load(async () => { throw unsafe; });
  const failed = await captureLogs(() => failing.email.sendNewOrderToStore(order));
  check('a failed send still reports sent: false with its reason', failed.result.sent === false && failed.result.reason === 'delivery_failed' && !failed.result.reason.includes('@'), failed.result);
  check('the failure line has the label and the SMTP codes', failed.lines.length === 1
    && failed.lines[0] === '✗ mail failed | new-order store #7 | EENVELOPE 550', failed.lines);
  check('the failure line has no recipient, name, subject or error text', leaks(failed.text).length === 0
    && !/rejected|unknown user|RCPT/.test(failed.text), failed.text);

  const codeless = load(async () => { throw new Error(`boom for ${EMAIL}`); });
  const noCode = await captureLogs(() => codeless.email.sendNewOrderToStore(order));
  check('an error without a code is logged as "no code", not by its message',
    noCode.lines[0] === '✗ mail failed | new-order store #7 | no code' && leaks(noCode.text).length === 0, noCode.lines);

  // timeout
  const hung = load(() => new Promise(() => {}));
  const timedOut = await captureLogs(() => hung.transporter.send({ to: EMAIL, subject, html: '<p>x</p>' }, { deadlineMs: 30, label: 'new-order store #7' }));
  check('a timeout is still sent: false with reason timeout', timedOut.result.sent === false && timedOut.result.reason === 'timeout', timedOut.result);
  check('the timeout line has the deadline and the label only', timedOut.lines.length === 1
    && timedOut.lines[0] === '✗ mail not confirmed within 30ms, outcome unknown | new-order store #7'
    && leaks(timedOut.text).length === 0, timedOut.lines);

  // mail switched off (the development default)
  const off = load(async () => ({}), { enabled: false });
  const disabled = await captureLogs(() => off.email.sendNewOrderToStore(order));
  check('with mail off the answer is unchanged', disabled.result.sent === false && disabled.result.reason === 'MAIL_ENABLED=false', disabled.result);
  check('with mail off the line has the label only', disabled.lines.length === 1
    && disabled.lines[0] === '[mail disabled] new-order store #7' && leaks(disabled.text).length === 0, disabled.lines);

  // a template that throws with the order's data in its message
  const brokenOrder = { ...order, get items() { throw new Error(`cannot render the order of ${NAME}, ${PHONE}, ${ADDRESS}`); } };
  const broken = await captureLogs(() => ok.email.sendNewOrderToStore(brokenOrder));
  check('a template failure is sent: false with the fixed reason build_failed, and does not throw', broken.result.sent === false && broken.result.reason === 'build_failed', broken.result);
  check('the build failure line has the label and the error class only',
    broken.lines.length === 1 && broken.lines[0] === '✗ mail build failed | new-order store #7 | Error' && leaks(broken.text).length === 0, broken.lines);

  // an order that has no number yet, and no stack or error object anywhere
  const nullOrder = await captureLogs(() => ok.email.sendNewOrderToStore(null));
  check('a missing order is logged by the kind only', nullOrder.lines[0] === '✗ mail build failed | new-order store | TypeError'
    && !/\n\s+at /.test(nullOrder.text), nullOrder.lines);
  check('no mail log line carries a stack', ![sent, customer, status, failed, noCode, timedOut, disabled, broken].some((c) => /\n\s+at /.test(c.text)), null);

  // a label cannot forge or flood a line
  const forged = await captureLogs(() => ok.transporter.send({ to: EMAIL, subject, html: '<p>x</p>' }, { label: `x\n✗ forged line <${EMAIL}>`.padEnd(200, 'a') }));
  check('a label is reduced to plain characters on one line and a short length',
    forged.lines.length === 1 && !forged.text.includes('\n') && !forged.text.includes('@') && forged.text.length < 100, forged.lines);
  const unlabelled = await captureLogs(() => ok.transporter.send({ to: EMAIL, subject, html: '<p>x</p>' }));
  check('a send without a label is logged as "mail"', unlabelled.lines[0] === 'mail sent | mail ✓', unlabelled.lines);

  // no recipient: nothing is sent and nothing is logged
  const none = await captureLogs(() => ok.email.sendOrderConfirmationToCustomer({ ...order, customer_email: null }));
  check('no recipient → sent: false and no log line', none.result.sent === false && none.lines.length === 0, none);
  check('no pending timers are left behind', active.size === 0, active.size);
}

async function main() {
  await testSend();
  await testTimeout();
  await testIndex();
  await testLogs();

  console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('the suite crashed:', err);
  process.exit(1);
});
