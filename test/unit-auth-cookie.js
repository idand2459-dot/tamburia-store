/**
 * Cookie reading for admin authentication, through the real cookie-parser middleware and the
 * real requireAdmin / markAdmin, without a network or a database.
 *
 * The token itself (HMAC-SHA256, created and verified by api/auth/auth.service) is unchanged;
 * what this pins is how the cookie header reaches verifyToken: missing, wrong name, valid,
 * expired, tampered, URL-encoded, malformed, quoted, duplicated and JSON-prefixed cookies.
 *
 * Environment values below are fixed dummies for this process only; nothing connects anywhere.
 */
process.env.ADMIN_PASSWORD = 'unit-test-password';
process.env.SESSION_SECRET = 'unit-test-session-secret';
process.env.DB_PASSWORD = 'unused-in-this-suite';
process.env.MAIL_ENABLED = 'false';
delete process.env.NODE_ENV;

const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const config = require('../server/config/env');
const { createToken } = require('../server/api/auth/auth.service');
const { requireAdmin, requireAdminRead, markAdmin } = require('../server/middleware/requireAdmin');

const NAME = config.auth.cookieName;

let passed = 0;
let failed = 0;

/** Records the result of one check. */
function check(name, condition, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

const b64 = (value) => Buffer.from(value).toString('base64url');

/** Signs a payload the way auth.service does, so a token with any claims can be built. */
function signedToken(payload) {
  const part = b64(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', config.auth.sessionSecret).update(part).digest();
  return `${part}.${b64(signature)}`;
}

const now = () => Math.floor(Date.now() / 1000);

/** Runs a request carrying `cookieHeader` through cookie-parser and then `middleware`. */
function run(middleware, cookieHeader) {
  const req = { headers: cookieHeader === undefined ? {} : { cookie: cookieHeader } };
  let nextArg;
  cookieParser()(req, {}, () => {});
  middleware(req, {}, (arg) => { nextArg = arg; });
  return { req, error: nextArg };
}

/** Whether requireAdmin let the request through. */
const admitted = (cookieHeader) => {
  const { req, error } = run(requireAdmin, cookieHeader);
  return !error && Boolean(req.admin);
};

/** Whether requireAdmin answered 401. */
const rejected = (cookieHeader) => {
  const { error } = run(requireAdmin, cookieHeader);
  return Boolean(error) && error.status === 401 && error.message === 'נדרשת התחברות כמנהל';
};

const valid = createToken('owner');
const viewer = createToken('viewer');
const [validPayload, validSignature] = valid.split('.');
const expired = signedToken({ sub: 'admin', role: 'owner', iat: now() - 7200, exp: now() - 3600 });
const wrongSubject = signedToken({ sub: 'someone', role: 'owner', iat: now(), exp: now() + 3600 });
const forgedClaims = `${b64(JSON.stringify({ sub: 'admin', role: 'owner', iat: now(), exp: now() + 999999 }))}.${validSignature}`;
// a viewer token whose payload was edited to say owner, with the viewer's signature
const [viewerPayload, viewerSignature] = viewer.split('.');
const escalated = `${b64(JSON.stringify({ ...JSON.parse(Buffer.from(viewerPayload, 'base64url').toString()), role: 'owner' }))}.${viewerSignature}`;
const legacy = signedToken({ sub: 'admin', iat: now(), exp: now() + 3600 });
const unknownRole = signedToken({ sub: 'admin', role: 'superuser', iat: now(), exp: now() + 3600 });

console.log('\n── requireAdmin');
check('a valid token is admitted', admitted(`${NAME}=${valid}`), null);
check('the request carries the token payload as req.admin', run(requireAdmin, `${NAME}=${valid}`).req.admin.sub === 'admin', null);
check('the payload carries the role', run(requireAdmin, `${NAME}=${valid}`).req.admin.role === 'owner', null);
const asViewer = run(requireAdmin, `${NAME}=${viewer}`);
check('a viewer token on an owner-only route → 403 demo_read_only, nothing attached', !asViewer.req.admin
  && asViewer.error && asViewer.error.status === 403 && asViewer.error.details.reason === 'demo_read_only', asViewer.error);
check('a legacy token without a role → 401', rejected(`${NAME}=${legacy}`), null);
check('a token with an unknown role → 401', rejected(`${NAME}=${unknownRole}`), null);
check('a viewer token edited to say owner (old signature) → 401', rejected(`${NAME}=${escalated}`), null);
check('createToken refuses a missing or unknown role', (() => {
  try { createToken(); return false; } catch { /* expected */ }
  try { createToken('root'); return false; } catch { return true; }
})(), null);
check('a viewer token expires in 4 hours, an owner token by SESSION_TTL_HOURS', (() => {
  const v = JSON.parse(Buffer.from(viewerPayload, 'base64url').toString());
  const o = JSON.parse(Buffer.from(validPayload, 'base64url').toString());
  return v.exp - v.iat === 4 * 3600 && o.exp - o.iat === config.auth.ttlHours * 3600;
})(), null);
check('no Cookie header → 401', rejected(undefined), null);
check('an empty Cookie header → 401', rejected(''), null);
check('a cookie with another name only → 401', rejected(`other=${valid}`), null);
check('an empty value → 401', rejected(`${NAME}=`), null);
check('a random value → 401', rejected(`${NAME}=notatoken`), null);
check('an expired token (correctly signed) → 401', rejected(`${NAME}=${expired}`), null);
check('a correctly signed token for another subject → 401', rejected(`${NAME}=${wrongSubject}`), null);
check('a tampered signature → 401', rejected(`${NAME}=${validPayload}.${validSignature.slice(0, -2)}AA`), null);
check('a tampered payload with the old signature → 401', rejected(`${NAME}=${forgedClaims}`), null);
check('a payload without a signature → 401', rejected(`${NAME}=${validPayload}`), null);
check('an "alg: none" style token → 401', rejected(`${NAME}=${b64('{"alg":"none"}')}.${b64(JSON.stringify({ sub: 'admin', exp: now() + 999 }))}.`), null);

console.log('\n── requireAdminRead');
{
  /** Runs requireAdminRead for a method with a cookie, and returns the status of the error or 200. */
  const readStatus = (method, cookieHeader) => {
    const req = { method, headers: cookieHeader === undefined ? {} : { cookie: cookieHeader } };
    let nextArg;
    cookieParser()(req, {}, () => {});
    requireAdminRead(req, {}, (arg) => { nextArg = arg; });
    return nextArg ? nextArg.status : 200;
  };
  check('owner GET → admitted', readStatus('GET', `${NAME}=${valid}`) === 200);
  check('viewer GET → admitted', readStatus('GET', `${NAME}=${viewer}`) === 200);
  check('viewer HEAD → admitted', readStatus('HEAD', `${NAME}=${viewer}`) === 200);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    check(`viewer ${method} → 403`, readStatus(method, `${NAME}=${viewer}`) === 403);
    check(`owner ${method} → 403 (a second line of defence)`, readStatus(method, `${NAME}=${valid}`) === 403);
  }
  check('no cookie GET → 401', readStatus('GET', undefined) === 401);
  check('legacy token GET → 401', readStatus('GET', `${NAME}=${legacy}`) === 401);
}

console.log('\n── cookie encoding');
check('a URL-encoded token (%2E for the dot) is decoded and admitted', admitted(`${NAME}=${valid.replace('.', '%2E')}`), null);
check('a fully percent-encoded token is admitted', admitted(`${NAME}=${[...valid].map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`), null);
check('a malformed percent sequence → 401 (not a crash)', rejected(`${NAME}=%E0%A4%A`), null);
check('a lone % → 401', rejected(`${NAME}=%`), null);
check('the token among other cookies is found', admitted(`a=1; ${NAME}=${valid}; b=2`), null);
check('spaces around the pairs are ignored', admitted(`  a=1 ;   ${NAME}=${valid}  `), null);
check('a pair without "=" is skipped', admitted(`garbage; ${NAME}=${valid}`), null);
check('the first of two cookies with the same name wins (bad first → 401)', rejected(`${NAME}=bad; ${NAME}=${valid}`), null);
check('the first of two cookies with the same name wins (valid first → admitted)', admitted(`${NAME}=${valid}; ${NAME}=bad`), null);
check('a "j:" JSON cookie (cookie-parser parses it into an object) → 401', rejected(`${NAME}=j%3A%7B%22sub%22%3A%22admin%22%7D`), null);
check('an "s:" prefixed value is not treated as signed (no secret given) → 401', rejected(`${NAME}=s%3A${valid}.sig`), null);

console.log('\n── compatibility difference vs the former hand-written reader');
// cookie-parser follows RFC 6265 and strips one pair of surrounding double quotes from a value;
// the old reader kept the quotes, so a quoted token never verified. The token still has to be
// correctly signed, so this admits nothing that was not already a valid token.
check('KNOWN: a double-quoted valid token is now admitted (the quotes are stripped)', admitted(`${NAME}="${valid}"`), null);
check('a double-quoted invalid token is still rejected', rejected(`${NAME}="notatoken"`), null);

console.log('\n── markAdmin');
{
  const asAdmin = run(markAdmin, `${NAME}=${valid}`);
  check('valid token → isAdmin true and req.admin set', asAdmin.req.isAdmin === true && asAdmin.req.admin.sub === 'admin' && !asAdmin.error, asAdmin.req);
  const asViewerMark = run(markAdmin, `${NAME}=${viewer}`);
  check('a viewer token is recognised as admin (sees hidden demo products)', asViewerMark.req.isAdmin === true && asViewerMark.req.admin.role === 'viewer', asViewerMark.req);

  for (const [label, header] of [['no cookie', undefined], ['expired', `${NAME}=${expired}`], ['tampered', `${NAME}=${forgedClaims}`], ['malformed', `${NAME}=%E0%A4%A`], ['random', `${NAME}=x`]]) {
    const visitor = run(markAdmin, header);
    check(`${label} → isAdmin false, req.admin unset, and the request continues`,
      visitor.req.isAdmin === false && visitor.req.admin === undefined && visitor.error === undefined, visitor.req);
  }
}

console.log('\n── cookie-parser runs once');
{
  const req = { headers: { cookie: `${NAME}=${valid}` }, cookies: { [NAME]: 'already-parsed' } };
  cookieParser()(req, {}, () => {});
  check('an already parsed req.cookies is left alone', req.cookies[NAME] === 'already-parsed', req.cookies);
}

console.log(`
${failed === 0 ? '✓' : '✗'} עברו ${passed}, נכשלו ${failed}`);
process.exit(failed === 0 ? 0 : 1);
