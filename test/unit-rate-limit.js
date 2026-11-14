/**
 * The rate limiter (P8.1 step C), through the real middleware, without a network or a database.
 *
 * Two things are pinned. How a client address becomes a key (clientKey): an IPv4-mapped IPv6 address
 * is the IPv4 address, any other IPv6 address is counted by its /64 prefix, a zone id is dropped.
 * And what rateLimit() does with the key: 429 above the maximum with Retry-After and an AppError the
 * error handler turns into { error }, a counter that resets after the window, counters that are
 * never shared between two limiters or two clients.
 *
 * The limiters that guard POST /api/orders and POST /api/reviews are this same middleware with the
 * thresholds from config.rateLimits; smoke-rate-limits.js exercises those two on real requests.
 *
 * Environment values below are fixed dummies for this process only; nothing connects anywhere.
 */
process.env.ADMIN_PASSWORD = 'unit-test-password';
process.env.SESSION_SECRET = 'unit-test-session-secret';
process.env.DB_PASSWORD = 'unused-in-this-suite';
process.env.MAIL_ENABLED = 'false';
delete process.env.NODE_ENV;

const { rateLimit, clientKey } = require('../server/middleware/rateLimit');
const { AppError } = require('../server/utils/AppError');

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\n── clientKey: IPv4');
check('an IPv4 address is its own key', clientKey('203.0.113.5') === '203.0.113.5', clientKey('203.0.113.5'));
check('different IPv4 addresses have different keys', clientKey('203.0.113.5') !== clientKey('203.0.113.6'));
check('no address → "unknown"', clientKey(undefined) === 'unknown' && clientKey('') === 'unknown' && clientKey(null) === 'unknown');

console.log('\n── clientKey: IPv4-mapped IPv6');
for (const mapped of ['::ffff:203.0.113.5', '::FFFF:203.0.113.5', '0:0:0:0:0:ffff:203.0.113.5', '::ffff:cb00:7105']) {
  check(`${mapped} is the IPv4 key`, clientKey(mapped) === '203.0.113.5', clientKey(mapped));
}
check('the mapped form and the plain form share one counter', clientKey('::ffff:127.0.0.1') === clientKey('127.0.0.1'));
check('a mapped address is not confused with another IPv4', clientKey('::ffff:203.0.113.5') !== clientKey('203.0.113.6'));

console.log('\n── clientKey: IPv6 is counted by its /64');
const PREFIX = '2001:0db8:0001:0002/64';
check('a compressed address (::) → its /64', clientKey('2001:db8:1:2::1') === PREFIX, clientKey('2001:db8:1:2::1'));
check('the same address written in full → the same key', clientKey('2001:0db8:0001:0002:0000:0000:0000:0001') === PREFIX);
check('upper case is the same key', clientKey('2001:DB8:1:2::1') === PREFIX);
check('another address in the same /64 → the same key', clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd') === PREFIX);
check('many addresses in one /64 → one key', new Set([
  '2001:db8:1:2::1', '2001:db8:1:2::2', '2001:db8:1:2:1:2:3:4', '2001:db8:1:2:ffff:ffff:ffff:ffff',
].map(clientKey)).size === 1);
check('a neighbouring /64 → another key', clientKey('2001:db8:1:3::1') !== PREFIX, clientKey('2001:db8:1:3::1'));
check('another /48 → another key', clientKey('2001:db8:2:2::1') !== PREFIX);
check('a zone id is dropped', clientKey('fe80::1%eth0') === clientKey('fe80::1'), clientKey('fe80::1%eth0'));
check('"::" in the middle of a long address', clientKey('2001:db8:1:2:3::4') === PREFIX, clientKey('2001:db8:1:2:3::4'));
check('loopback (::1) has a key', clientKey('::1') === '0000:0000:0000:0000/64', clientKey('::1'));
check('an IPv6 address is not the IPv4 key of anything', !/^\d+\.\d+\.\d+\.\d+$/.test(clientKey('2001:db8:1:2::1')));
check('a string that does not parse is used as it is',
  clientKey('not:an:address') === 'not:an:address' && clientKey('1:2:3:4:5:6:7:8:9') === '1:2:3:4:5:6:7:8:9'
  && clientKey('2001:db8::1::2') === '2001:db8::1::2', [clientKey('not:an:address'), clientKey('2001:db8::1::2')]);

/** Runs the middleware once for a client; returns what it did. */
function hit(limiter, ip) {
  const headers = {};
  const res = { setHeader(name, value) { headers[name] = value; } };
  let error;
  let proceeded = false;
  limiter({ ip, socket: { remoteAddress: ip } }, res, (err) => { if (err) error = err; else proceeded = true; });
  return { headers, error, proceeded };
}

console.log('\n── rateLimit: the 429');
{
  const limiter = rateLimit({ windowMs: 5000, max: 3, message: 'יותר מדי הזמנות בזמן קצר' });
  const first = [hit(limiter, '203.0.113.5'), hit(limiter, '203.0.113.5'), hit(limiter, '203.0.113.5')];
  check('the requests up to the maximum go through', first.every((r) => r.proceeded && !r.error));
  check('RateLimit-Limit and a falling RateLimit-Remaining',
    first.map((r) => r.headers['RateLimit-Limit']).every((v) => v === 3)
    && JSON.stringify(first.map((r) => r.headers['RateLimit-Remaining'])) === '[2,1,0]',
    first.map((r) => [r.headers['RateLimit-Limit'], r.headers['RateLimit-Remaining']]));

  const over = hit(limiter, '203.0.113.5');
  check('the request above the maximum is refused with an AppError 429',
    !over.proceeded && over.error instanceof AppError && over.error.status === 429, over.error && over.error.status);
  check('the message is the limiter\'s, in Hebrew, with the seconds to wait',
    /^יותר מדי הזמנות בזמן קצר \(עוד \d+ שניות\)$/.test(over.error.message), over.error.message);
  const retryAfter = Number(over.headers['Retry-After']);
  check('Retry-After is a whole number of seconds, at least 1 and not above the window',
    Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 5, over.headers['Retry-After']);
  check('RateLimit-Reset agrees with Retry-After', Number(over.headers['RateLimit-Reset']) === retryAfter, over.headers);
  check('RateLimit-Remaining stays at 0', over.headers['RateLimit-Remaining'] === 0, over.headers['RateLimit-Remaining']);
  check('the seconds in the message are the Retry-After', over.error.message.includes(`(עוד ${retryAfter} שניות)`), over.error.message);
  check('a request that is refused still counts and is refused again', hit(limiter, '203.0.113.5').error?.status === 429);
}

console.log('\n── rateLimit: counters are separate');
{
  const orders = rateLimit({ windowMs: 5000, max: 2 });
  const reviews = rateLimit({ windowMs: 5000, max: 2 });
  hit(orders, '203.0.113.5'); hit(orders, '203.0.113.5');
  check('one limiter exhausted', hit(orders, '203.0.113.5').error?.status === 429);
  check('another limiter, same client: a fresh counter', hit(reviews, '203.0.113.5').proceeded);
  check('the same limiter, another client: a fresh counter', hit(orders, '203.0.113.6').proceeded);

  const limiter = rateLimit({ windowMs: 5000, max: 1 });
  hit(limiter, '203.0.113.5');
  check('an IPv4-mapped address is the same client', hit(limiter, '::ffff:203.0.113.5').error?.status === 429);

  const v6 = rateLimit({ windowMs: 5000, max: 1 });
  hit(v6, '2001:db8:1:2::1');
  check('another address in the same /64 is the same client', hit(v6, '2001:db8:1:2:aaaa:bbbb:cccc:dddd').error?.status === 429);
  check('a different /64 is another client', hit(v6, '2001:db8:1:3::1').proceeded);
}

console.log('\n── rateLimit: the window');
(async () => {
  const limiter = rateLimit({ windowMs: 300, max: 1 });
  hit(limiter, '203.0.113.5');
  const blocked = hit(limiter, '203.0.113.5');
  check('refused inside the window, Retry-After of one second', blocked.error?.status === 429 && blocked.headers['Retry-After'] === 1, blocked.headers);
  await sleep(350);
  const again = hit(limiter, '203.0.113.5');
  check('the counter starts again after the window', again.proceeded && again.headers['RateLimit-Remaining'] === 0, again);

  console.log('\n── rateLimit: reset');
  const login = rateLimit({ windowMs: 5000, max: 1 });
  hit(login, '203.0.113.5');
  login.reset({ ip: '203.0.113.5', socket: {} });
  check('reset() gives the client a fresh counter', hit(login, '203.0.113.5').proceeded);
  hit(login, '2001:db8:1:2::1');
  login.reset({ ip: '2001:db8:1:2:5::9', socket: {} });
  check('reset() works on the /64 key too', hit(login, '2001:db8:1:2::1').proceeded);
  check('a request with no ip falls back to the socket address',
    (() => { const l = rateLimit({ windowMs: 5000, max: 1 }); l({ socket: { remoteAddress: '203.0.113.9' } }, { setHeader() {} }, () => {});
      let error; l({ socket: { remoteAddress: '203.0.113.9' } }, { setHeader() {} }, (e) => { error = e; }); return error?.status === 429; })());

  console.log(`\n${failed === 0 ? '✓' : '✗'} passed ${passed}, failed ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
