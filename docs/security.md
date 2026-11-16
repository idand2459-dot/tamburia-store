# Security

What the server protects today, how to deploy it, and what is **not** solved yet. Everything in
the first two sections is checked against the code and has tests; the section on gaps lists what
has none, and is the part to read before putting the store in front of real traffic.

This is a portfolio project that runs locally. It is not deployed, and nothing here is a claim
that it is ready for a live shop. It has a **portfolio demo mode** (below) that is meant to be put
online with fictional data only; that is not a commercial launch, and the commercial checkout is
not assumed safe to expose.

## The portfolio demo model

`DEMO_MODE=true` (plan `.plan/006-2026-11-16-p10-portfolio-demo.md`, runbook in
[demo-deployment.md](demo-deployment.md)). The protections are enforced by the server and the database,
and are tested (`smoke-demo-*`, `smoke-admin-roles`, `unit-admin-routes-covered`, `unit-config`):

| Area | Protection | Where |
|---|---|---|
| Startup | The server refuses to start in demo mode unless `NODE_ENV=production`, `MAIL_ENABLED=false` is set explicitly, `DEMO_DATABASE_ID` is a UUID, `ADMIN_PASSWORD` has 20 or more characters, `SERVE_CLIENT` is true and `CORS_ORIGINS` is empty; the messages name the variable and never a value | `server/config/env.js` |
| Which database | A demo server starts only on a database with the `demo_database_marker` table whose id equals `DEMO_DATABASE_ID` and whose state is `ready`; a normal server exits when the table exists. The check runs before any write. Only `npm run demo:bootstrap` creates the marker, only on a pristine database, with the host and database name typed again by the owner; the development and test databases and a local host (without `--allow-local`) are refused | `server/api/demo/demo.service.js`, `scripts/demo-bootstrap.js`, `scripts/lib/demoTarget.js` |
| Roles | The signed token carries `role`: `owner` or `viewer`. A token without a role is invalid. `requireAdmin` is owner-only, so every write and every route nobody opened to a viewer is 403 for a viewer (reason `demo_read_only`). `requireAdminRead` accepts both roles for `GET` and `HEAD` only, on seven routes. `POST /api/auth/demo-login` issues a 4-hour viewer session and is mounted only in demo mode (404 otherwise); it shares the login limiter and does not reset it | `server/middleware/requireAdmin.js`, `server/api/auth/` |
| What a viewer sees | Orders, reviews, hidden products, statistics and one timestamp setting, all from `SELECT`s with explicit column lists. `request_id` and `request_hash` are never returned. This is safe only because a demo database holds only fictional values, which the checkout rules and the data-invariant check guarantee | `test/smoke-admin-roles.js` |
| Stored data | An order is accepted only when name, phone, email and (for delivery) address together equal one of three fixed fictional identities, and `notes` is empty or one fixed text; the owner's edit follows the same rule on the merged state. Seeded orders carry `request_id = demo-seed:NN`, which the public API cannot produce (it accepts only a UUID v4) | `server/api/demo/demo.rules.js` |
| Switched off | `POST /api/upload-multiple` (it would write to the host's ephemeral disk) and `POST /api/reviews` answer 403 `demo_disabled` for every caller, the owner included | `server/middleware/demoDisabled.js`, `review.service.js` |
| Cleanup and abuse | Visitor orders (an identity phone and not a seed tag) older than `DEMO_ORDER_TTL_HOURS` are deleted in batches of 200 on wake, on an order at the cap and on an admin read (once per 5 minutes); at most `DEMO_MAX_VISITOR_ORDERS` are kept (429 `demo_order_cap`); cleanup does nothing unless the marker is present, matching and `ready` | `demo.service.js` |
| Mail | None: `MAIL_ENABLED=false` is mandatory, and the transporter then only logs a label | `server/services/email/transporter.js` |
| Database link | `DB_SSL=true` passes `ssl: { rejectUnauthorized: true }`; nothing in `server/`, `scripts/` or `test/` may disable verification (`unit-repo-hygiene`) | `server/config/db.js` |

Residual risks: a viewer or owner token cannot be revoked (rotate `SESSION_SECRET`); the seed-tag
convention is enforced by tests and not by a constraint; the rate limits are per process, so run one
instance. A real database must never run in demo mode: the marker, the pristine rule and the typed
confirmations are what prevent it.

## What is in place

| Area | Protection | Where |
|---|---|---|
| Admin login | Password compared in constant time over SHA-256 digests; session is an HMAC-SHA256 token (algorithm fixed in code) in an `httpOnly`, `SameSite=Strict` cookie, `Secure` in production | `server/api/auth/auth.service.js` |
| CSRF | No token needed: every write is JSON or multipart and the session cookie is `SameSite=Strict`, so a request from another site does not carry it | `auth.service.js`, `server/app.js` |
| Login limit | 10 attempts per 15 minutes per client address; a good login resets the counter | `server/api/auth/auth.routes.js` |
| Order creation limit | 10 requests per 15 minutes per client address (`ORDER_RATE_*`) | `server/api/order/order.routes.js` |
| Review creation limit | 5 requests per hour per client address (`REVIEW_RATE_*`) | `server/api/review/review.routes.js` |
| No public order read | There is no public route that returns an order. The lookup by phone number (`GET /api/orders/by-phone/:phone`) was removed in P8.2 and answers 404; every other order route needs the admin session. `POST /api/orders` only creates | `server/api/order/order.routes.js` |
| Errors | The client sees only text this API wrote. PostgreSQL text, the JSON parser's text and the message of any unexpected error are never sent, at any status; no response has a stack trace in any environment; a 5xx is logged as one line of safe fields (method, route template, status, category, SQLSTATE or system code, order request id), never the error object, its message, its stack or the URL | `server/middleware/errorHandler.js` |
| Numbers | An id or an offset above 2147483647 (the largest PostgreSQL `INTEGER`) is a 400 and never reaches a query; the same check backs `sort_order` and the item ids of an order | `server/utils/ids.js`, the validators |
| Input size | JSON body up to 200 KB; order `notes` up to 1000 characters, `delivery_address` 200, an item name 255, customer name 30 | `server/app.js`, `order.validator.js` |
| Configuration | Invalid values stop the server at start, with a message that names the variable and never a secret (table below) | `server/config/env.js` |
| Uploads | Admin only; image types only; 15 MB and 5 files per request; decoded and re-encoded to WebP (metadata and GPS removed) under a content hash; originals kept outside the served folder | `server/middleware/upload.js`, `server/services/image.service.js` |
| Queries and emails | Every query is parameterised; user text in emails is HTML-escaped | the repositories, `server/services/email/templates/shared.js` |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on every response; HSTS (180 days, `includeSubDomains`) in production when `HSTS_ENABLED` is on | `server/middleware/securityHeaders.js` |

### Rate limits and the checkout

The limiters are the existing `rateLimit()` middleware, one instance per route, each with its own
counters. A client is counted by its address as Express reports it (`req.ip`): an IPv4-mapped IPv6
address counts as the IPv4 address, and any other IPv6 address counts by its `/64` prefix, because
one connection owns a whole `/64`. Over the limit the answer is `429`, a Hebrew `{ "error": "…
(עוד N שניות)" }`, and the headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset`.

- **Every request counts**, also one that fails validation and also a retry of an order with the
  same `request_id`. A replayed order (`200`, `Idempotent-Replayed: true`) uses a request of the
  window like any other.
- **A 429 never touches an order.** It is sent before the controller runs, so it creates nothing,
  reads nothing and changes nothing. A `request_id` that was refused is unused and a `request_id`
  that already has an order still has it.
- **The checkout keeps the attempt on a 429.** A 429 says nothing about an earlier send of the
  same order (one that timed out may have been saved), so `useCheckoutForm` keeps the stored
  attempt exactly as it was: the same body and the same `request_id`. It shows the server's text
  and a line saying the same order can be sent again in a few minutes without a duplicate. It
  never retries by itself and never makes a new `request_id`; the customer presses *send again*
  on the unresolved-order notice. That sends the same body, the server answers `200` with the
  original order if the first send had been saved (or `201` if it had not), and either way there is
  one order.
- **Cancelling still warns** that an order that was in fact received will be duplicated.
- **A first send that is limited** also leaves an unresolved-order notice, which says the order
  *may* have been received. That wording is cautious for this case and is not changed.

The counters live in the memory of the Node process. A restart clears them and two instances
would not share them. That suits one server; running several needs a shared store, which does
not exist yet.

### Environment rules

Checked in `server/config/env.js` when the server starts. A value outside its rule stops the
server with a message that names the variable.

| Variable | Default | Rule |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production`; anything else stops the server. Not set, with a `DB_HOST` that is not `localhost`, `127.0.0.1`, `::1` or a socket path, also stops it. That check is a safety net only; a deployment sets `NODE_ENV=production` itself. `NODE_ENV=development` set on purpose skips that one check |
| `PORT`, `DB_PORT` | `3000`, `5432` | 1 to 65535 |
| `DB_PASSWORD`, `ADMIN_PASSWORD` | none | Required; `ADMIN_PASSWORD` at least 12 characters in production |
| `SESSION_SECRET` | random per start | Production: required, at least 32 characters |
| `SESSION_TTL_HOURS` | `12` | 1 to 168 |
| `ADMIN_URL` | `http://localhost:3000/admin` | Production: required, an `https` URL |
| `CORS_ORIGINS` | empty | Each entry exactly `scheme://host[:port]` as a browser sends it: lower case, no path, no trailing `/`, no `*`, no default port. Checked in every environment |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` | `10`, 15 minutes | Window 1 ms to 24 hours |
| `ORDER_RATE_MAX`, `ORDER_RATE_WINDOW_MS` | `10`, 15 minutes | Window 1 ms to 24 hours |
| `REVIEW_RATE_MAX`, `REVIEW_RATE_WINDOW_MS` | `5`, 1 hour | Window 1 ms to 24 hours |
| `TRUST_PROXY_HOPS` | `1` in production, `0` elsewhere | 0 to 5 |

A window is capped at 24 hours because a limiter sweeps its counters with a timer of the window's
length, and Node runs a timer above about 24.8 days as if it were 1 ms.

## Deployment checklist

Tick these on the host, not in the repository. The first block is what the server enforces; the
second is what only a person on the deployed site can check.

**Configuration**

- [ ] `NODE_ENV=production` is set explicitly in the host's settings. The startup line shows
  `(production)`. Do not rely on the `DB_HOST` safety net.
- [ ] `SESSION_SECRET` is random, at least 32 characters, made with the command in
  `.env.example`, kept in the host's secret store, and the same on every instance. Changing it
  ends every admin session at once, which is the way to revoke a stolen token.
- [ ] `ADMIN_PASSWORD` is random and at least 12 characters.
- [ ] `ADMIN_URL` is the real `https` admin address.
- [ ] `CORS_ORIGINS` is empty (same origin) or the exact origins that call the API.
- [ ] `TRUST_PROXY_HOPS` equals the number of proxies in front of the server (a CDN counts, and the
  platform's own router counts). Set it explicitly and do not rely on the default of `1`.
- [ ] Mail: `MAIL_ENABLED`, a Gmail app password in the secret store, and `MAIL_TO`. There is no
  outbox: a lost notification is not retried.

**Transport and data**

- [ ] The site is served over HTTPS and plain HTTP redirects to it. The app does not terminate TLS.
- [ ] HSTS is on only after HTTPS works: it is sent for 180 days with `includeSubDomains`.
- [ ] The database connection is encrypted where the host requires it: set `DB_SSL=true`, which
  verifies the certificate chain and host name. If a provider's chain does not verify, the answer is a
  documented CA path, never switching verification off. A managed host's **direct** (not pooled)
  address is needed for the migration lock (see [demo-deployment.md](demo-deployment.md)).
- [ ] `uploads/` and `uploads-originals/` are on persistent storage and backed up.
- [ ] The reverse proxy accepts bodies of at least 200 KB, and its timeouts exceed the 20 s the
  checkout waits for an order.
- [ ] `npm audit --omit=dev` was run online for the server and for `client/`. P8.1 did not do
  this (an offline run is not conclusive).
- [ ] The log retention is decided: the logs hold personal data (see the gaps).

**Client IP handling and rate limits behind the real proxy**

The limits count `req.ip`. If `TRUST_PROXY_HOPS` is too low, every visitor is counted under the
proxy's address and they all share one counter. If it is too high, or the server is not behind a
proxy at all, a visitor can choose their own counter with an `X-Forwarded-For` header. Check it on
the deployed site, with a request that counts but creates nothing (an empty JSON body is a 400):

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -D - -X POST https://<host>/api/orders \
    -H 'Content-Type: application/json' -d '{}' | grep -i '^ratelimit-remaining'
done
```

- [ ] `RateLimit-Remaining` falls by one on each call (9, 8, 7 with the defaults). If it stays at
  the same value, each request is counted under a different key: see the forwarded-address checks
  below.
- [ ] A second client on another network starts from a full count, so visitors are not sharing
  the proxy's address.
- [ ] Add `-H 'X-Forwarded-For: 203.0.113.9'` to the calls: the count must still fall by one, not
  restart. A restart means a visitor can choose their own key.
- [ ] Look at what the proxy puts in `X-Forwarded-For`. Some platforms append the client's port
  (`203.0.113.9:51234`). The key is used as it arrives, so an address with a port changes with every
  connection and the limits stop working. The first check above shows it. Fixing it means removing
  the port from the key in `clientKey()`; that is not done yet.
- [ ] Send the 11th order request within 15 minutes (defaults) and see a `429` with `Retry-After`,
  then see the checkout screen keep the order and offer *send again*.
- [ ] After the proxy hop count is confirmed, wait for the window to pass and check that the same
  client can order again.

## Not solved yet

None of these is fixed by P8.1. They are listed so that nobody assumes otherwise. The backlog
(`.plan/000-backlog.md`) tracks them.

**Customer data**

- **Closed in P8.2: the public order lookup.** It returned the name, address, email, notes, items
  and totals of every order under a phone number. It was removed completely (no replacement): a
  customer who needs to know about an order phones the store, using the order number from the
  confirmation screen or email.
- **Closed in P8.2: personal data in the error and mail logs.** A 5xx is logged as one line:
  method, route template (`/api/orders/:id`, never the URL), status, a category (`app`, `database`,
  `system`, `unexpected`), the SQLSTATE or system code, the class name of an unexpected error, and
  the request id of an order attempt. The error object, its message, its stack, the query and
  the parameters are not logged. A PostgreSQL 4xx is one warning with the method and the code. A
  mail is logged by a fixed label (`new-order store #12`) and its outcome, with the SMTP codes of a
  failure: never the recipient, the subject, or the text of an error. The cost is that a log no
  longer holds a stack trace; a failure that needs one is reproduced with a test order.
  What is still logged and is not customer data: the migration and start-up messages, the
  connection pool's error message, the image service's file names, and the first line of each SQL
  statement (never its parameters) when `DB_LOG_QUERIES` is on. How long the host keeps logs is
  still the host's decision.
- **Closed in P8.2: personal data in the browser, with a limit.** An unresolved order (name,
  phone, email, address, notes and items) stays in `localStorage` for 48 hours after it was first
  submitted, so that the same body can be sent again with the same `request_id`; a resend does not
  move that time. After that the details are removed and only `{ requestId, submittedAt, expired,
  itemCount, total }` stays, until the customer cancels it. It is never sent again, and it does not
  say the order failed: it says the outcome is unknown and points to the store. On a shared device
  the details can still be read for up to 48 hours after an order whose outcome was unknown (a
  confirmed or refused order removes them at once). The cart and the wishlist are stored in
  `localStorage` too and have no expiry; they hold products, not personal details.

**Server**

- **Rate-limit counters are in memory.** They reset on restart and are not shared between
  instances.
- **Client IP edge cases.** A forwarded address with a port, an address in brackets, or an IPv4
  address written with leading zeros is used as it arrives, so it can be counted under more than
  one key. An empty address maps to an empty key. The address a Node socket reports is not affected.
- **No server-side logout.** A token stays valid until it expires (at most 168 hours). Changing
  `SESSION_SECRET` ends all sessions.
- **Content Security Policy is off.** Written, but not enabled. As written it would also block the
  Google Fonts stylesheet and font files that `client/public/index.html` loads, and the comment in
  `securityHeaders.js` about the JSON-LD block has not been verified in a browser. There is no
  `Cache-Control: no-store` on the API responses either.
- **Uploads.** Admin only and re-encoded, but there is no explicit pixel limit for decoding (the
  library default applies), no check of the real image format beyond the decoder accepting it, no
  check of the contents of a product's `images` list, and no quota.
- **Database TLS.** Closed by P10: `DB_SSL=true` encrypts and verifies the connection. It is off by
  default, so a deployment has to set it; the first live proof is the owner-run bootstrap against the
  managed database (the Neon certificate must verify with Node's default trust).
- **Dependencies.** No CI runs `npm audit`.

**Outside this document**

- The privacy policy, the terms, the shipping, cancellation and refund pages, and the other legal
  content found in the P8 audit do not exist yet and are not part of P8.1.

## Testing it

`npm test` covers the rules above: `unit-config` (every environment rule), `unit-rate-limit` (the
address keys and the limiter), `smoke-rate-limits` (the real routes with low limits, the 429
headers, separate counters, and that a refused or replayed order never creates a second one),
`unit-error-handler` and `smoke-contract` (no database or parser text, no stack trace),
`unit-numeric-ids` (ids and offsets) and `unit-order-limits` (field lengths). The client side of a
429 is in `client/src/js/__tests__/hooks/useCheckoutForm.test.js`. The demo model is covered by
`unit-demo-target` and `smoke-demo-bootstrap` (which database may be claimed), `smoke-demo-database`
(which database each server may run on), `smoke-admin-roles` and `unit-admin-routes-covered` (the
role table, escalation attempts, no writes), `smoke-demo-checkout` (only fictional identities, nothing
real stored), `smoke-demo-cleanup` (what cleanup deletes and never deletes) and `unit-deploy-config`
(the runbook against `.env.example`). None of these can check the real
hosting: the checklist above can.
