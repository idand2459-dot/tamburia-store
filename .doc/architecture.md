# System Architecture

## Purpose
- Provide a concise architecture reference for component boundaries, ownership, and major flows.
- The full description of the layers, a request traced end to end, and the design decisions is [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md). This file adds configuration, limits, and test coverage, and links to it instead of copying it.

## System Overview
- One Node process (`server/server.js:19`) serves the API under `/api` and, with `SERVE_CLIENT` on, the React build from `client/build` (`server/config/env.js:175-176`).
- State lives in PostgreSQL (`server/config/db.js`, migrations run by `server/db/migrate.js`); uploaded images live on disk in `uploads/` and `uploads-originals/`; the cart lives in the browser's `localStorage` (`README.md:58`).
- The admin finds new orders by polling `GET /api/orders` every 30 seconds while the tab is visible (`client/src/js/hooks/useAdminOrders.js`).
- Layers and folders: [docs/ARCHITECTURE.md — Folder structure](../docs/ARCHITECTURE.md).

## Primary Components
| Path | Responsibility |
|---|---|
| `server/server.js` | Starts the server on the configured port. |
| `server/app.js` | Builds the Express app (`createApp`), also used by the HTTP test suites (`test/lib/testServer.js`). |
| `server/config/env.js` | Reads and validates every server setting; refuses an invalid or unsafe configuration (rules in [docs/security.md](../docs/security.md)). |
| `server/middleware/rateLimit.js` | The per-client-address limiter used by login, order creation and review creation; also the address key (`clientKey`). |
| `server/api/index.js` | Mounts the API domains under `/api` (`server/api/index.js:19-25`). |
| `server/middleware/errorHandler.js` | Turns every error into the JSON error response. |
| `client/src/js/App.js` | The React app's root; loads `client/src/css/app.css`. |
| `client/src/js/services/` | The client's calls to the server (`authService.js`, `orderService.js`, `productService.js`, and others). |

The other layers (controllers, services, repositories, validators) are described in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Data Flow
- Placing an order, from the click to the database and back: [docs/ARCHITECTURE.md — A request, end to end: placing an order](../docs/ARCHITECTURE.md).

## Configuration
Server settings, read in `server/config/env.js`. Names only; `.env.example` lists them with placeholder values.

| Setting | Default in code | Secret | Evidence |
|---|---|---|---|
| `NODE_ENV` | `development`; only `development`, `test`, `production` | no | `server/config/env.js:65-77` |
| `PORT` | `3000`, 1 to 65535 | no | `server/config/env.js:117` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` | `localhost`, `5432` (1 to 65535), `tamburia`, `postgres` | no | `server/config/env.js:120-123` |
| `DB_PASSWORD` | none, required | yes | `server/config/env.js:124` |
| `DB_LOG_QUERIES` | on outside production | no | `server/config/env.js:125` |
| `MAIL_ENABLED` | on unless set to `false` | no | `server/config/env.js:108` |
| `MAIL_USER`, `MAIL_PASS` | required only when mail is on | yes | `server/config/env.js:129-130` |
| `MAIL_TO` | `MAIL_USER` | no | `server/config/env.js:131` |
| `ADMIN_URL` | `http://localhost:3000/admin`; production: required, `https` | no | `server/config/env.js:136`, `:231-234` |
| `DELIVERY_FEE` | `20` | no | `server/config/env.js:139` |
| `ADMIN_PASSWORD` | none, required; production: at least 12 characters | yes | `server/config/env.js:143`, `:227` |
| `SESSION_SECRET` | a random value per start (with a warning); production: required, at least 32 characters | yes | `server/config/env.js:144`, `:219-225`, `:240-241` |
| `SESSION_TTL_HOURS` | `12`, 1 to 168 | no | `server/config/env.js:145` |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` | `10`, 15 minutes (window at most 24 hours) | no | `server/config/env.js:147-148` |
| `ORDER_RATE_MAX`, `ORDER_RATE_WINDOW_MS` | `10`, 15 minutes (window at most 24 hours) | no | `server/config/env.js:155-156` |
| `REVIEW_RATE_MAX`, `REVIEW_RATE_WINDOW_MS` | `5`, 1 hour (window at most 24 hours) | no | `server/config/env.js:159-160` |
| `TRUST_PROXY_HOPS` | `1` in production, `0` elsewhere, 0 to 5 | no | `server/config/env.js:167` |
| `CSP_ENABLED`, `HSTS_ENABLED` | off, on | no | `server/config/env.js:170-171` |
| `SERVE_CLIENT`, `CLIENT_BUILD_DIR` | on, `client/build` | no | `server/config/env.js:175-176` |
| `CORS_ORIGINS` | empty; each entry exactly `scheme://host[:port]` | no | `server/config/env.js:179`, `:209-216` |

`NODE_ENV` not set together with a `DB_HOST` that is not on this machine also stops the server (`server/config/env.js:200`). That is a safety net and does not replace setting `NODE_ENV=production` on a host.

Store details shown on the site (address, hours, the store landline) live in `client/src/js/utils/storeInfo.js`. WhatsApp is off while `WHATSAPP_NUMBER` there is `null`: every button or link that messages the shop is then absent, and setting that one value turns them all on. The shop's private mobile number is not shown anywhere public; `test/unit-no-private-phone.js` fails if it appears in the client source, the server (email templates) or the built bundle.

Tool settings: `TEST_DATABASE_URL` (a separate local database for `npm test` and `npm run a11y`, required, `test/lib/testDatabase.js`); `A11Y_PORT` (default `3200`) and `CHROME_PATH` (`scripts/a11y-audit.js:25`, `:36`). The React dev server's port is set in `client/.env.development` (`README.md:431`).

## Testing
- Server tests live in `test/` and run with `npm test`; client tests live in `client/src/js/__tests__/`, mirroring the code folders (`__tests__/utils/pickList.test.js` covers `utils/pickList.js`), and run with `npm run test:client`. The accessibility gate is `npm run a11y`, after `npm run build:client`. The browser end-to-end suite is `npm run test:e2e` (`test/e2e/`, plan `.plan/005-2026-11-14-p9-end-to-end-testing.md`), also after `npm run build:client`; it uses the same guarded test database and server (`test/lib/testServer.js`) and the installed Chrome through puppeteer-core.
- `npm test` creates temporary records and deletes them (`test/run-all.js:2-5`). It runs only against `TEST_DATABASE_URL`, a separate local database made with `createdb`: the variable is required, and the guard refuses `NODE_ENV=production`, a malformed URL, a remote host, the development database itself and a database whose name does not contain "test". The URL is translated into `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`, and the configuration that `server/config/env.js` loads is checked against it before any connection (`test/lib/testDatabase.js`). Each HTTP suite starts its own server (`test/lib/testServer.js`, a port chosen by the operating system, `NEW_URL` ignored), and after connecting checks the identity PostgreSQL reports (database, user, port, address) before running migrations; `test/run-all.js` only runs the suites and opens no connection. The suites and what each covers: [docs/ARCHITECTURE.md — Tests](../docs/ARCHITECTURE.md).
- AC01 has no automated test yet (see Open Questions in [product-definition.md](product-definition.md)).

## External Dependencies
- PostgreSQL, the only data store.
- Gmail SMTP through Nodemailer, only with `MAIL_ENABLED` on; with it off, emails are written to the log (`README.md:91`).
- The installed Chrome, through puppeteer-core, for the accessibility gate (`scripts/a11y-audit.js:11-12`) and the end-to-end suite (`test/e2e/lib/browser.js`).
- Timeouts: the SMTP transport has 5 s connection, greeting and DNS timeouts and an 8 s socket timeout, with a 10 s deadline over each send (`server/services/email/transporter.js`); the storefront gives an order request 20 s (`client/src/js/services/orderService.js`). A timed-out send is an unknown outcome, not a failure. There is no queue or retry for emails; PostgreSQL has only the pool's 5 s connection timeout. A retry of an order is safe through its `request_id` (see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)).

## Operational Concerns
- Logging: the error handler logs every 5xx as one line of safe fields: method, route template, status, category, SQLSTATE or system code, and an order attempt's request id; never the URL, the error object, its message or its stack (`server/middleware/errorHandler.js`, `describeFailure`). A database error answered as a 4xx is one warning with the method and the PostgreSQL code. The mail sender logs a fixed label and the outcome, never the recipient, the subject or an error text (`server/services/email/`). `DB_LOG_QUERIES` logs the first line of every query, without parameters. Details and what is still logged: [docs/security.md](../docs/security.md).
- Failure handling: errors are mapped centrally to a status and a message (`server/middleware/errorHandler.js`): the client gets only text this API wrote, never PostgreSQL's or the parser's, and never a stack trace; the server retries nothing, and sends `Retry-After` with `429` (`server/middleware/rateLimit.js:99`); see the [error-handling skill](../.claude/skills/error-handling/SKILL.md).
- Limits: an order has at most 50 lines, at most 999 units per line, a total of at most 99,999,999.99 (`NUMERIC(10,2)`), notes up to 1000 characters, a delivery address up to 200 and an item name up to 255 (`server/api/order/order.validator.js`, `pricing.service.js`); a request body up to 200 KB (`server/app.js:80`); ids and offsets up to 2147483647 (`server/utils/ids.js`); uploads up to 15 MB per file and 5 files (`server/services/image.service.js:22`, `server/middleware/upload.js:25`); per client address, in the process's memory: login `LOGIN_MAX_ATTEMPTS` per `LOGIN_WINDOW_MS`, orders `ORDER_RATE_MAX` per `ORDER_RATE_WINDOW_MS`, reviews `REVIEW_RATE_MAX` per `REVIEW_RATE_WINDOW_MS`, and order lookup 20 per 15 minutes (fixed, `server/api/order/order.routes.js:25-26`); sessions expire after `SESSION_TTL_HOURS`.
- Rate limits and checkout: every request counts, a retry of the same order included, and a `429` is answered before the order code runs, so it never creates or changes an order. The checkout keeps the attempt (same body, same `request_id`) and the customer sends it again by hand ([docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [docs/security.md](../docs/security.md)). Behind a proxy the counted address depends on `TRUST_PROXY_HOPS`, which must match the hosting.
- Known limitations: the store runs locally only and is not live; there is no online payment (`client/src/js/features/home/FAQ.js:23`); the tests run against a separate local database (`TEST_DATABASE_URL`); the rate-limit counters are not shared between instances; the CSP, uploads and database TLS are not hardened. The deployment checklist and the full list: [docs/security.md](../docs/security.md).

## API Contract
- Base URL in development: `http://localhost:3000/api`.
- Every non-2xx response uses the error shape from the [error-handling skill](../.claude/skills/error-handling/SKILL.md): `{ "error": "<message>" }`, with optional `details`.
- The endpoints, by domain, are listed in the API table of [README.md](../README.md) (`README.md:439-458`), not copied here.
