# 002 — P8.1 backend security hardening

Status: active
Owner: Idan
Last updated: 2026-11-14

Branch: `fix/p8-1-backend-hardening` (created from `1380a01`, the P7.4 commit, which `main` does not contain yet).
Approved by the owner on 2026-11-14 with the refinements marked **[refinement]** below. Implementation has not started and needs a separate explicit go-ahead.

## Goal
Close the P8 audit findings S-01, S-04, S-05, S-12 and S-02/S-08, plus the part of S-06 that rate limiting needs to be correct (IPv6 keys and the proxy hop count). The API keeps its status codes and its `{ error, details? }` shape; only error texts change. Order idempotency, the checkout retry flow and the stateless HMAC admin authentication stay as they are.

## Scope
In scope:
- `server/app.js`, `server/config/env.js`
- `server/middleware/errorHandler.js`, `server/middleware/rateLimit.js`, `server/middleware/validate.js`
- `server/utils/ids.js` (new, tiny)
- `server/api/{order,review,product,pigmentFormula}/*.validator.js`
- `server/api/{order,review}/*.routes.js`
- `client/src/js/hooks/useCheckoutForm.js` (429 handling) and `client/src/js/features/cart/CheckoutFormView.js` (`maxLength`)
- tests, `.env.example`, `README.md`, `docs/ARCHITECTURE.md`, `.doc/architecture.md`, `.plan/000-backlog.md`

Out of scope (and why):
- P8.2 and later phases (phone lookup, CSP, logging policy, uploads, token revocation, legal pages): separate plans.
- A global `/api` rate limit, and a shared store for several server instances: not needed for a single instance.
- `DB_SSL`: deployment-dependent (decision 10).
- Automatic retries or a countdown UI after a 429: not approved.
- No new dependencies, no migrations, no ORM, no change to the HMAC token or cookie.

## Assumptions
- One server process; an in-memory limiter is enough (as the login limiter already is).
- The project is a portfolio project without real traffic; defaults are conservative and configurable.
- `express.json` (200kb) still runs before the route limiter, so an oversized body is read before it is counted. The 200kb cap bounds the cost.
- The hop count behind the host's proxy is unknown until deployment.
- `test/lib/testServer.js` and `test/run-all.js` keep starting one server per suite process, so counters are isolated per suite.

## Open Questions
All twelve questions of the first plan review were answered on 2026-11-14:
1. `NODE_ENV` stays default `development`; an invalid value is rejected; an unset `NODE_ENV` with a non-local `DB_HOST` is rejected. **Approved.**
2. Production requires `ADMIN_URL` (https) and a `SESSION_SECRET` of at least 32 characters. **Approved.**
3. No stack trace in any 5xx response; the server log keeps it. **Approved.**
4. Defaults: 10 orders per 15 minutes and 5 reviews per hour, per IP, configurable. **Approved.**
5. Every request counts, idempotent retries included. **Approved.**
6. A 429 keeps the checkout attempt. **Approved.**
7. A numeric id above INT4 gives 400. **Approved.**
8. Field limits: `notes` 1000, `delivery_address` 200, `items[].name` 255. **Approved.**
9. `SESSION_TTL_HOURS` is capped at 168. **Approved.**
10. `DB_SSL` is deferred to deployment. **Approved.**
11. A review for a missing product keeps its current 409 status; the text must not expose database internals. **Approved.**
12. Branch name and this plan file name. **Approved.**

No open question remains. A new one goes here before the work continues.

## Steps
Execution order. Each step is one commit (the owner runs the commits; proposed messages are in Rollout Order).

0. Branch `fix/p8-1-backend-hardening` already exists. Confirm it is checked out before starting.

1. **Numeric ids and overflow (S-05).**
   - New `server/utils/ids.js`: `MAX_INT4 = 2147483647` and `isInt4Id(value)` (a positive integer not above `MAX_INT4`).
   - `server/middleware/validate.js` `idParam`: a value above `MAX_INT4` gives 400 "מזהה לא תקין" without touching the database. Today it reaches PostgreSQL and fails with code 22003, which is a 500.
   - `server/api/review/review.validator.js` `asProductId`: same limit (create and list filter).
   - `server/api/product/product.validator.js` `parseListQuery`, the `ids` parser: same limit per id (today `?ids=99999999999` is a 500 from `ANY($1::int[])`).
   - `server/api/order/order.validator.js` `asItems`: an `id` above `MAX_INT4` becomes `null`, so `priceOrder` refuses it with the existing 400 "no longer in the catalogue" (today it is a 500 on a public route).
   - `parseListQuery` of the order, review, product and pigment validators: `offset` is limited to `MAX_INT4`. `pigmentFormula.validator.js` `asSortOrder`: same limit (the column is `INTEGER`).
   - Contract impact: 500 becomes 400 for these inputs; valid requests are unchanged. Breaking: none.

2. **Errors without internals (S-04, S-12, stack trace).**
   - `server/middleware/errorHandler.js`: `mapPgError` gains 22003 (400, numeric out of range), 22001 (400, value too long), 22007 and 22008 (400, invalid date). New `mapParserError(err)` by `err.type`: `entity.parse.failed` 400 (Hebrew "body is not valid JSON"), `entity.too.large` 413, `encoding.unsupported` and `charset.unsupported` 415, `request.aborted` and `request.size.invalid` 400.
   - `errorHandler` resolves in this order: multer, parser, `AppError` (message and `details` as they are), a known PostgreSQL error (its status and its translated message, **also below 500**), any other error with a 4xx `status` (a generic Hebrew text by status, never `err.message`), and finally 500 with "שגיאת שרת פנימית". `details` is returned only from an `AppError`.
   - The `stack` field is removed from every response. 5xx errors are still logged with the stack. A PostgreSQL error below 500 gets one log line with the code and the route only (no `detail`, which can hold column values).
   - Contract impact: statuses unchanged; texts change for PostgreSQL 4xx, parser errors and non-`AppError` 4xx. A review for a missing product stays 409 with "הפעולה מפרה קישור לרשומה אחרת".
   - Breaking: a developer who read `stack` from the response now reads the server log.

3. **Rate limits and length limits (S-01) with IPv6 and proxy handling (S-06, minimum).**
   - `server/config/env.js`: new `rateLimits.orders` and `rateLimits.reviews` read `ORDER_RATE_MAX` (10), `ORDER_RATE_WINDOW_MS` (900000), `REVIEW_RATE_MAX` (5), `REVIEW_RATE_WINDOW_MS` (3600000), in the style of `LOGIN_*`. New `trustProxyHops` reads `TRUST_PROXY_HOPS` (default 1 in production and 0 elsewhere; zero allowed; at most 5).
   - `server/app.js`: `trust proxy` is `config.trustProxyHops > 0 ? config.trustProxyHops : false`. The defaults keep today's behaviour.
   - `server/middleware/rateLimit.js` `keyOf`: an IPv4-mapped address (`::ffff:1.2.3.4`) is keyed as its IPv4 address, and an IPv6 address is keyed by its /64 prefix (zone id stripped, `::` expanded). A small private helper, no library.
   - `server/api/order/order.routes.js`: `router.post('/', orderLimiter, controller.create)`. `server/api/review/review.routes.js`: `router.post('/', reviewLimiter, controller.create)`. Both limiters are built with the existing `rateLimit()` and the Hebrew messages "יותר מדי הזמנות בזמן קצר" and "יותר מדי חוות דעת בזמן קצר". The 429 already carries `Retry-After` and `RateLimit-*`.
   - `server/api/order/order.validator.js`: `MAX.notes = 1000`, `MAX.delivery_address = 200`, `items[].name` up to 255. They also apply to the admin edit path (`parseEditableField`).
   - Thresholds and reasons: orders 10 per 15 minutes (a real customer sends one to three; corrections after a 400 or 409 and manual retries with the same `request_id` fit with room; the ceiling is 20 emails per 15 minutes per IP). Reviews 5 per hour (rare, moderated, no email).
   - Contract impact: a new 429 (`{ error }`) on both routes; a new 400 on over-long `notes`, `delivery_address` or item name.
   - Breaking: an old order whose note is longer than 1000 characters must be shortened before an admin edit.
   - **[refinement]** The production configuration documents that the hop count must be checked against the real hosting topology before launch: a wrong count either keys every client on the proxy address or lets a client choose its own key.

4. **Configuration validation (S-02, S-08).** In `server/config/env.js`, collected into the existing `problems` list; messages name the variable and never print a secret.
   - `NODE_ENV` is `development` when unset (unchanged). A value other than `development`, `test` or `production` is rejected.
   - An unset `NODE_ENV` together with a `DB_HOST` that is not `localhost`, `127.0.0.1` or `::1` is rejected, and the message says to set `NODE_ENV` explicitly. **[refinement]** This is an extra safety net only. It never replaces setting `NODE_ENV=production` explicitly in the deployment, and the documentation says so. An explicit `NODE_ENV=development` skips this one check, so local work, `npm test` and `npm run a11y` (which use a local database) behave as before.
   - Production: `SESSION_SECRET` of at least 32 characters; `ADMIN_URL` must start with `https://` (so it must be set, because the default is a localhost address).
   - `CORS_ORIGINS`: every entry must equal its own `new URL(entry).origin` (no `*`, no path, no trailing slash); checked in every environment.
   - `number()` gets an optional `max`: `PORT` and `DB_PORT` up to 65535, `SESSION_TTL_HOURS` up to 168, `TRUST_PROXY_HOPS` up to 5.
   - Contract impact on the API: none. Breaking: a production start without `ADMIN_URL` or with a short secret now fails on purpose.

5. **Client: keep the attempt on 429 and bound the fields.**
   - `client/src/js/hooks/useCheckoutForm.js` `sendAttempt`: `refused` also excludes status 429, like 408. A 429 keeps the stored attempt (same body, same `request_id`), shows the server's message, and leaves "send again" available through the existing `retryPendingOrder`. No automatic retry and no countdown.
   - `client/src/js/features/cart/CheckoutFormView.js`: `maxLength={1000}` on the notes field and `maxLength={200}` on the address field.
   - Breaking: none.

6. **Tests** (details under Validation).

7. **Docs and backlog.** `.env.example` (five new variables, in Hebrew like the rest, with the note that `DB_HOST` is only a safety net and `ADMIN_URL` is required in production), `README.md`, `docs/ARCHITECTURE.md` and `.doc/architecture.md` (environment variables, rate limits, new suites). Tick backlog line 11 (stack trace) and the parts of line 25 (raw PostgreSQL text, English parser errors, SEC-01, stack trace) and line 32 that this plan closes; move them under `## DONE`.

## Validation
`agent-run` commands do not need the test database. `owner-run` commands do (`TEST_DATABASE_URL`), or name an env file. Owner-run commands are for Windows PowerShell 5.1.

Unit (no database):
- `node test/unit-config.js` (agent-run). New cases: `NODE_ENV=prod` is rejected; an unset `NODE_ENV` with `DB_HOST=db.example.com` is rejected and with `NODE_ENV=development` it starts; production rejects a 31-character secret, an `http://` or missing `ADMIN_URL`; `CORS_ORIGINS` of `*`, `https://a.com/` and `a.com` are rejected and `https://a.com` passes; `PORT=70000` and `SESSION_TTL_HOURS=169` are rejected; no message contains a secret value; the existing production, development and mail cases still pass.
- `node test/unit-rate-limit.js` (agent-run, new). **[refinement]** It loads the real `server/middleware/rateLimit.js` and the real route modules' limiter settings from `config`, with isolated counters (one `rateLimit()` instance per test) and small configurable thresholds and windows. It checks `Retry-After` (a positive integer that does not exceed the window), `RateLimit-Limit/Remaining/Reset`, the 429 after the threshold, the reset after the window, and that two instances never share counters. Key cases for `keyOf`: IPv4 (`203.0.113.5`), IPv4-mapped (`::ffff:203.0.113.5` equals the IPv4 key), compressed IPv6 (`2001:db8::1`), expanded IPv6, zone id (`fe80::1%eth0`), two different addresses in the same /64 share a key, and two addresses in different /64s do not.
- `node test/unit-error-handler.js` (agent-run, new). Synthetic errors through the real `errorHandler`: PostgreSQL 23503, 23505, 22P02, 22003, 22001, 22008 give a translated message and never contain `constraint`, `violates`, `invalid input` or a column name; `entity.parse.failed` gives 400 and `entity.too.large` gives 413, both in Hebrew; an unknown error with `status: 400` gives a generic text; an `AppError` keeps its message and `details`; an unknown error gives 500 with the generic text; no response has a `stack` key, also for a 5xx; the log call for a 5xx still receives the error with its stack.
- `node test/unit-ids.js` (agent-run, new, may be folded into the error handler suite): `MAX_INT4` and `isInt4Id` boundaries (0, 1, 2147483647, 2147483648, 1e21, `NaN`).

HTTP (owner-run, against the test database):
- `npm test` (owner-run). It must stay green, with these additions.
- `smoke-rate-limits` (new, added to the list in `test/run-all.js`). **[refinement]** It sets `ORDER_RATE_MAX=3` and `REVIEW_RATE_MAX=2` in its own process before the server starts, so it exercises the production middleware on the real routes through `runHttpSuite`. It uses bodies that fail validation, so no order, review or email is created. It checks: the fourth `POST /orders` is 429 with `Retry-After` and a Hebrew `{ error }`; the third `POST /reviews` likewise; a request with the same `request_id` counts; `GET /orders/by-phone/...` and the admin routes are not affected by these limiters. Counters are per process, so no other suite sees them.
- `test/lib/testServer.js`: add high default thresholds for the new variables with "only if not already set" semantics (not the current `Object.assign` overwrite), so `smoke-orders` (about 66 requests) and `smoke-contract` are not limited while `smoke-rate-limits` keeps its low values. `smoke-auth` keeps running last.
- `smoke-contract`: a review with a non-existent `product_id` gives 409 and its text contains neither `constraint` nor `violates`; malformed JSON gives 400 and an oversized body 413, both in Hebrew (the `KNOWN` comment at the malformed-JSON case is updated); `GET /api/products/99999999999` gives 400; `GET /api/products?ids=99999999999` gives 400; `POST /orders` with `items[0].id = 99999999999` gives 400, not 500; `notes` of 1001 characters gives 400; no error response contains `stack`.

Client (agent-run): `npm run test:client` with these additions in `client/src/js/__tests__/hooks/useCheckoutForm.test.js` (and `checkoutAttempt.test.js` where it already covers storage). **[refinement]** Explicit regression coverage that:
- a 429 keeps the stored attempt with the exact original body and the same `request_id`, and does not clear or replace it;
- the screen shows an understandable rate-limit message (the server's Hebrew text), and "send again" stays available;
- a later manual `retryPendingOrder` sends the same `request_id` and the same body (no new id, no changed body);
- when that later retry succeeds, the attempt is cleared once and the success state is set, and the server-side replay (200 with `Idempotent-Replayed`, as already pinned in `smoke-orders`) returns the original order, so the number of created orders stays one;
- a 429 never triggers an automatic retry (the request count stays at one until the user acts);
- the existing cases (408, 422, 4xx clears, 5xx and timeout keep) are unchanged.

Static checks (agent-run):
- `node test/unit-repo-hygiene.js` (no secret value in the example env file or in the repository).
- `Select-String -Path server\middleware\errorHandler.js -Pattern 'stack'` shows no `stack` in a response body (the log call may still mention the error object). owner-run.

## Risks
- A shared network is limited as one client (an office, a household): the thresholds are generous and configurable.
- A wrong proxy hop count keys everyone on the proxy address or lets a client pick its key: the default keeps today's value, the documentation requires checking it against the hosting before launch, and it is a deployment decision.
- The /64 key groups clients inside one IPv6 network: a home connection is one /64, so the grouping is correct for the normal case.
- A 429 on a retry of an order that was created: handled by step 5 (the attempt is kept) and covered by the client tests above.
- The in-memory limiter resets on restart and is per instance: accepted for a single instance, listed for deployment.
- The new startup rules can stop a deployment with an incomplete configuration: intended, and the messages name the variable.
- Tests that need many orders are limited by mistake: prevented by the `testServer.js` defaults.

## Rollout Order
1. Approval is done (Status `active`, 2026-11-14). Implementation waits for a separate explicit go-ahead.
2. Implementation sequence, one commit each (the owner runs the commits):
   1. `fix(server): validate numeric ids and map numeric overflow` (step 1)
   2. `fix(server): never return raw database or parser errors` (step 2)
   3. `feat(server): rate limit order and review creation` (steps 3 and 5, because the client change depends on the 429)
   4. `feat(server): stricter environment validation` (step 4)
   5. `docs: P8.1 settings, env example and backlog` (step 7)
   Tests are added in the commit of the code they cover; the new suites are registered in `test/run-all.js` in the same commit.
3. Validate with the Validation list.
4. Merge through a pull request from the branch (the owner), after a review pass.

Deployment-dependent, not part of this plan: the real `TRUST_PROXY_HOPS`, tuning the thresholds to real traffic, a shared limiter store for several instances, `DB_SSL`, the real `ADMIN_URL` and `CORS_ORIGINS`, setting `NODE_ENV=production` explicitly, proxy body limits and timeouts.

## Rollback
- No migration and no data change, so there is nothing to undo in the database.
- Each commit reverts on its own (`git revert <commit>`); the branch can be deleted before merging with no effect on `main`.
- Without reverting: raise `ORDER_RATE_MAX` and `REVIEW_RATE_MAX` to switch the limits off in practice; set `TRUST_PROXY_HOPS` to restore any earlier proxy setting.
- The new variables are additive; removing them from the environment returns the defaults.
- Safe to delete after a revert: `server/utils/ids.js`, `test/unit-rate-limit.js`, `test/unit-error-handler.js`, `test/unit-ids.js`, `test/smoke-rate-limits.js` and their entries in `test/run-all.js`.
