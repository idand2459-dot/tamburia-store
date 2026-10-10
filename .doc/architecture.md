# System Architecture

## Purpose
- Provide a concise architecture reference for component boundaries, ownership, and major flows.
- The full description of the layers, a request traced end to end, and the design decisions is [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md). This file adds configuration, limits, and test coverage, and links to it instead of copying it.

## System Overview
- One Node process (`server/server.js:19`) serves the API under `/api` and, with `SERVE_CLIENT` on, the React build from `client/build` (`server/config/env.js:99-100`).
- State lives in PostgreSQL (`server/config/db.js`, migrations run by `server/db/migrate.js`); uploaded images live on disk in `uploads/` and `uploads-originals/`; the cart lives in the browser's `localStorage` (`README.md:58`).
- The admin's live order feed runs over WebSocket (`ws`, `README.md:76`).
- Layers and folders: [docs/ARCHITECTURE.md — Folder structure](../docs/ARCHITECTURE.md).

## Primary Components
| Path | Responsibility |
|---|---|
| `server/server.js` | Starts the server on the configured port. |
| `server/app.js` | Builds the Express app (`createApp`), also used by the test runner (`test/run-all.js:39`). |
| `server/config/env.js` | Reads and validates every server setting; refuses unsafe production config. |
| `server/routes/index.js` | Mounts the API domains under `/api` (`server/routes/index.js:19-25`). |
| `server/middleware/errorHandler.js` | Turns every error into the JSON error response. |
| `client/src/js/App.js` | The React app's root; loads `client/src/css/app.css`. |
| `client/src/js/services/` | The client's calls to the server (`authService.js`, `orderService.js`, `productService.js`, and others). |

The other layers (controllers, services, models, validators) are described in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Data Flow
- Placing an order, from the click to the database and back: [docs/ARCHITECTURE.md — A request, end to end: placing an order](../docs/ARCHITECTURE.md).

## Configuration
Server settings, read in `server/config/env.js`. Names only; `.env.example` lists them with placeholder values.

| Setting | Default in code | Secret | Evidence |
|---|---|---|---|
| `NODE_ENV` | `development` | no | `server/config/env.js:45` |
| `PORT` | `3000` | no | `server/config/env.js:59` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` | `localhost`, `5432`, `tamburia`, `postgres` | no | `server/config/env.js:62-65` |
| `DB_PASSWORD` | none, required | yes | `server/config/env.js:66` |
| `DB_LOG_QUERIES` | on outside production | no | `server/config/env.js:67` |
| `MAIL_ENABLED` | on unless set to `false` | no | `server/config/env.js:50` |
| `MAIL_USER`, `MAIL_PASS` | required only when mail is on | yes | `server/config/env.js:51`, `:71-72` |
| `MAIL_TO` | `MAIL_USER` | no | `server/config/env.js:73` |
| `ADMIN_URL` | `http://localhost:3000/admin` | no | `server/config/env.js:78` |
| `DELIVERY_FEE` | `20` | no | `server/config/env.js:81` |
| `ADMIN_PASSWORD` | none, required | yes | `server/config/env.js:85` |
| `SESSION_SECRET` | a random value per start (with a warning) | yes | `server/config/env.js:86`, `:132-133` |
| `SESSION_TTL_HOURS` | `12` | no | `server/config/env.js:87` |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` | `10`, 15 minutes | no | `server/config/env.js:89-90` |
| `CSP_ENABLED`, `HSTS_ENABLED` | off, on | no | `server/config/env.js:94-95` |
| `SERVE_CLIENT`, `CLIENT_BUILD_DIR` | on, `client/build` | no | `server/config/env.js:99-100` |
| `CORS_ORIGINS` | empty | no | `server/config/env.js:103` |

Tool settings: `TEST_PORT` (default `3100`, `test/run-all.js:13`); `A11Y_PORT` (default `3200`) and `CHROME_PATH` (`scripts/a11y-audit.js:25`, `:36`). The React dev server's port is set in `client/.env.development` (`README.md:431`).

## Testing
- Server tests live in `test/` and run with `npm test`; client tests sit next to the code as `client/src/js/**/*.test.js` and run with `npm run test:client`. The accessibility gate is `npm run a11y`, after `npm run build:client`.
- `npm test` runs against the real local database: it creates temporary records and deletes them (`test/run-all.js:2-5`). The suites and what each covers: [docs/ARCHITECTURE.md — Tests](../docs/ARCHITECTURE.md).
- AC01 has no automated test yet (see Open Questions in [product-definition.md](product-definition.md)).

## External Dependencies
- PostgreSQL, the only data store.
- Gmail SMTP through Nodemailer, only with `MAIL_ENABLED` on; with it off, emails are written to the log (`README.md:91`).
- The installed Chrome, through puppeteer-core, for the accessibility gate only (`scripts/a11y-audit.js:11-12`).
- Timeouts and retry behavior of these dependencies: not checked yet.

## Operational Concerns
- Logging: the error handler logs every 5xx with `console.error`, the method, and the URL (`server/middleware/errorHandler.js:52`); `DB_LOG_QUERIES` logs every query. What is never logged: not checked yet.
- Failure handling: errors are mapped centrally to a status and a message (`server/middleware/errorHandler.js:17-38`); the server retries nothing, and sends `Retry-After` with `429` (`server/middleware/rateLimit.js:41`); see the [error-handling skill](../.claude/skills/error-handling/SKILL.md).
- Limits: uploads up to 15 MB per file and 5 files (`server/middleware/upload.js:26-27`); login attempts per window from `LOGIN_MAX_ATTEMPTS` and `LOGIN_WINDOW_MS`; sessions expire after `SESSION_TTL_HOURS`.
- Known limitations: the store runs locally only and is not live; there is no online payment (`client/src/js/features/home/FAQ.js:23`); the tests use the real local database.

## API Contract
- Base URL in development: `http://localhost:3000/api`.
- Every non-2xx response uses the error shape from the [error-handling skill](../.claude/skills/error-handling/SKILL.md): `{ "error": "<message>" }`, with optional `details`.
- The endpoints, by domain, are listed in the API table of [README.md](../README.md) (`README.md:439-458`), not copied here.
