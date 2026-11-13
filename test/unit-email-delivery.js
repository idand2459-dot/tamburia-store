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
function load(sendMail) {
  const created = [];
  injectFake(NODEMAILER_PATH, {
    createTransport: (options) => { created.push(options); return { sendMail }; },
  });
  injectFake(CONFIG_PATH, {
    mail: { enabled: true, user: 'u', pass: 'p', from: 'shop@example.com', to: 'shop@example.com' },
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
  check('a rejected send does not throw', result.sent === false && result.reason === 'boom', result);
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
  check('and reports sent: false', broken && broken.sent === false, broken);

  let customer;
  try { customer = await email.sendOrderConfirmationToCustomer({ ...order, customer_email: null }); } catch (err) { threw = err; }
  check('no customer address → sent: false, no throw', customer && customer.sent === false, customer);

  check('no pending timers are left behind', active.size === 0, active.size);
}

async function main() {
  await testSend();
  await testTimeout();
  await testIndex();

  console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('the suite crashed:', err);
  process.exit(1);
});
