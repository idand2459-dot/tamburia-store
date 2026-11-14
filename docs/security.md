# Security

What the server protects today, how to deploy it, and what is **not** solved yet. Everything in
the first two sections is checked against the code and has tests; the section on gaps lists what
has none, and is the part to read before putting the store in front of real traffic.

This is a portfolio project that runs locally. It is not deployed, and nothing here is a claim
that it is ready for a live shop.

## What is in place

| Area | Protection | Where |
|---|---|---|
| Admin login | Password compared in constant time over SHA-256 digests; session is an HMAC-SHA256 token (algorithm fixed in code) in an `httpOnly`, `SameSite=Strict` cookie, `Secure` in production | `server/api/auth/auth.service.js` |
| CSRF | No token needed: every write is JSON or multipart and the session cookie is `SameSite=Strict`, so a request from another site does not carry it | `auth.service.js`, `server/app.js` |
| Login limit | 10 attempts per 15 minutes per client address; a good login resets the counter | `server/api/auth/auth.routes.js` |
| Order creation limit | 10 requests per 15 minutes per client address (`ORDER_RATE_*`) | `server/api/order/order.routes.js` |
| Review creation limit | 5 requests per hour per client address (`REVIEW_RATE_*`) | `server/api/review/review.routes.js` |
| Order lookup limit | 20 requests per 15 minutes per client address; fixed in code, not configurable | `order.routes.js` |
| Errors | The client sees only text this API wrote. PostgreSQL text, the JSON parser's text and the message of any unexpected error are never sent, at any status; no response has a stack trace in any environment; 5xx errors are logged in full on the server | `server/middleware/errorHandler.js` |
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
- [ ] The database connection is encrypted where the host requires it. **The app has no setting for
  this yet** (see the gaps), so use a private network, or add one before deploying.
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

- **The public order lookup exposes customer information.** `GET /api/orders/by-phone/:phone`
  needs only a phone number and returns the name, delivery address, email, notes, items and
  totals of every order under it. The limit of 20 requests per 15 minutes makes scanning
  expensive, not impossible, and does not protect a number someone already knows. Closing it
  needs a product decision (return less, ask for the order number as well, or verify the number).
- **Personal data in logs.** The 5xx log line contains the request URL, and the lookup URL
  contains the phone number; the logged error object can include the fields of a PostgreSQL error,
  which can include values. The email sender logs the recipient address and the subject, and the
  new-order subject contains the customer's name. The PostgreSQL 4xx warning added in P8.1 logs
  only the method and the error code.
- **Personal data in the browser.** The unresolved order stays in `localStorage` (name, phone,
  email, address, notes and items) with no expiry until the customer settles it. On a shared device
  it stays after the customer leaves. The cart and the wishlist are stored there too.

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
- **WebSocket.** The upgrade checks the admin cookie, but not the `Origin`, uses the library's
  default maximum message size, and does not recheck the token while the socket is open (a logout or
  an expiry does not close it).
- **Uploads.** Admin only and re-encoded, but there is no explicit pixel limit for decoding (the
  library default applies), no check of the real image format beyond the decoder accepting it, no
  check of the contents of a product's `images` list, and no quota.
- **Database TLS.** The connection pool has no `ssl` option and there is no `DB_SSL` variable. A
  database that requires TLS cannot be reached, and one that does not require it is reached
  unencrypted.
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
429 is in `client/src/js/__tests__/hooks/useCheckoutForm.test.js`. None of these can check the real
hosting: the checklist above can.
