# Technik Tambour — Online Store

A full-stack e-commerce application for a hardware and building-supplies store in Petah
Tikva, Israel: a catalogue of about 400 products in 12 categories, a cart and checkout flow
with email notifications, moderated customer reviews, and two calculators that turn a job
into a shopping list. A paint calculator works out coverage and pigment quantities, and a
project calculator handles jobs like a bathroom renovation. Behind it is a password-protected
admin panel where the owner manages products, orders and reviews, with a live feed of new
orders. The storefront is Hebrew and right-to-left, and meets IS 5568 / WCAG 2.1 AA. One
Node process serves both the API and the React app.

**How it is built, and why:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It covers the
layers, a request traced from a click to the database and back, and the design decisions.

---

## Screenshots

Screenshots use seeded demo data, not real customer records. The site is not deployed
yet; everything below runs locally.

<table>
  <tr>
    <td colspan="2">
      <img src="docs/images/01-homepage.png" width="100%" alt="Home page" /><br/>
      <sub><b>Home page</b> — the header, the info ticker and the hero with the store's key facts.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/images/02-paint-calculator.png" width="100%" alt="Paint calculator" /><br/>
      <sub><b>Paint calculator</b> — wall area, openings and coats become litres, a pigment recipe and a one-click cart bundle.</sub>
    </td>
    <td width="50%">
      <img src="docs/images/03-admin-orders.png" width="100%" alt="Admin orders" /><br/>
      <sub><b>Admin — orders</b> — status breakdown, filters, CSV export, and one order expanded with its line items.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/images/05-cart-checkout.png" width="100%" alt="Cart" /><br/>
      <sub><b>Cart</b> — quantities, pickup or delivery, and a total the server recalculates on submit.</sub>
    </td>
    <td width="50%">
      <img src="docs/images/06-admin-stats.png" width="100%" alt="Admin statistics" /><br/>
      <sub><b>Admin — statistics</b> — revenue by period, a 7-day order chart and best-selling categories.</sub>
    </td>
  </tr>
</table>

---

## Features

### Storefront
- Catalogue browsing by category and subcategory, with search, sorting and stock status
- Product pages with an image gallery, colour, size and variant selection, and product reviews
- Cart persisted in `localStorage`, pickup or delivery, with a delivery-area check
- Wishlist, recently viewed products, and order lookup by phone number
- Reviews for the store and for individual products. The home page rating is computed
  from approved reviews and hides itself when there are none
- Real URLs throughout: every page, filter and modal is linkable and survives a refresh
- An accessibility statement at `/accessibility`

### Paint and project calculators
- Paint calculator: wall area from any number of walls, minus windows and doors, times
  coats, converted to litres and containers
- 20 pigment shades stored in the database, each with millilitres per litre at three
  depths, with a live colour preview
- Project calculator: four job types that expand into a checklist of the products the job needs
- Both add every product the job requires to the cart in one action

### Admin panel
- Six tabs, each with its own URL: statistics, orders, products, add/edit, CSV import,
  review moderation
- A live order feed over WebSocket, with a chime for each new order
- Product management with multi-image upload (up to 5 per product); every image is
  squared, resized and saved as content-hashed WebP
- Hide instead of delete: products with orders are taken off the shelf, not out of the database
- Bulk product import from CSV, with a preview and per-row validation before committing
- Order tracking with status changes that email the customer automatically
- A pick list in every order: each line is a large checkbox row with the product's
  thumbnail and quantity, saved per line on the server. Progress ("3/5 הוכנו") shows on the
  closed card, and the next step is highlighted once everything is picked
- Review moderation: nothing is published until it is approved
- Lazy-loaded: shoppers never download the admin code

### Email
Three templates, sent through Nodemailer: a new-order notification to the store, an
order confirmation to the customer, and an update on every status change. All
user-supplied values are HTML-escaped. `MAIL_ENABLED=false` logs instead of sending.

---

## Tech stack

| Layer | Technology |
|---|---|
| Server | Node.js ≥ 18, Express 5 |
| Database | PostgreSQL via `pg`, no ORM |
| Client | React 19 (Create React App), react-router 7 |
| Real time | `ws` (admin order feed) |
| Images | Multer for uploads, sharp for processing |
| Authentication | Hand-written HMAC-SHA256 session tokens in an httpOnly cookie |
| Email | Nodemailer |
| Tests | Server: plain Node scripts against a real server and database. Client: Jest + Testing Library. Accessibility: axe-core via Puppeteer |

There is no ORM and no third-party auth library. The data-access layer and the session
handling were written directly, so every query and every security decision is visible in
the repository rather than delegated to a dependency.

---

## Architecture

```mermaid
flowchart LR
    B["Browser<br/>React 19 SPA<br/>react-router"]

    subgraph S["Node process — single port"]
        H["Security headers<br/>CORS · JSON body limit"]
        U["/uploads<br/>static + 404"]
        A["/api<br/>routes → validators → controllers<br/>→ services → repositories"]
        W["/ws<br/>admin order feed"]
        C["Client static<br/>+ SPA fallback"]
    end

    DB[("PostgreSQL<br/>products · orders · reviews<br/>pigment_formulas · settings")]
    M["SMTP<br/>Nodemailer"]

    B -->|"HTTP"| H
    H --> U
    H --> A
    H --> C
    B <-->|"WebSocket"| W
    A -->|"parameterised SQL"| DB
    A -->|"order + status mail"| M
    C -->|"index.html"| B
```

One process serves the API, the uploaded images and the React build from the same
origin, so there is no CORS setup in production and no second deployment target.

### Folder structure

```
server/
  config/        env loading and validation, the one shared database pool
  db/            SQL migrations (000–012) and the runner
  api/           one folder per domain (product, order, review, pigmentFormula, setting, auth, upload):
                 routes, validator, controller, service, repository — plus api/index.js
                 - routes mark what is public and what is guarded; validators check and bound input
                 - controllers: HTTP in, service call, HTTP out — no SQL, no repositories, no try/catch
                 - services hold the business rules; repositories hold all SQL (explicit columns, never SELECT *)
  services/      shared infrastructure: email, realtime, image processing
  middleware/    error handling, uploads, security headers, admin guard, rate limiting
  utils/         errors, money in agorot, the pagination envelope, the category tree

client/src/
  index.js       entry point — CRA requires it at exactly this path
  css/           app.css imports every partial: base / layout / components / features
  js/pages/      route screens (and pages/admin/, the admin screen and its tabs)
  js/components/ reusable UI
  js/features/   feature UI by domain: home, catalog, cart, calculators
  js/store/      the Redux store: cart, wishlist, availability (actions, reducers, selectors)
  js/hooks/      state and effects (checkout form, admin data, recently viewed availability)
  js/services/   every server call the storefront makes
  js/utils/      pure helpers (pricing, store info, palette, icons)

test/            15 server suites, 671 checks
scripts/         catalogue import, demo data, the product-photo pipeline, the a11y audit
docs/            ARCHITECTURE.md, the product-photo runbook, the accessibility audit, screenshots
photos/          raw phone photos in, processed store images out — contents gitignored
uploads/         admin image uploads — contents gitignored
```

The full map, one line per folder, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Design decisions

**Layered server, the same in every domain.** A request goes route → validator →
controller → service → repository. SQL exists only in repositories, validation only in validators,
business rules only in services, and controllers contain no `try/catch`. Errors are thrown
as `AppError` and a single error handler turns them into responses. "Where does this
belong?" almost always has one answer.

**Prices come from the server.** The order total is computed from the database, never from
the request: the price the customer saw is compared, and a change returns 409 with the
current prices so the cart can correct itself. Money is integer agorot in code and
`NUMERIC(10,2)` in the database. See the worked example in
[ARCHITECTURE.md](docs/ARCHITECTURE.md#a-request-end-to-end-placing-an-order).

**Routing: real URLs, not component state.** react-router with `/`, `/category/:slug`,
`/product/:id`, `/about`, `/contact`, `/returns`, `/accessibility`, `/cart`, `/checkout`,
`/orders/lookup`, `/wishlist` and `/admin/:tab`.

- **Deep links load their own data.** `/product/:id` fetches the product by id, showing a
  skeleton while loading and a 404 for an unknown one.
- **Modal as route.** The cart, wishlist and order lookup are overlays whose open state
  is the URL. `/cart` renders the cart over the storefront, and `/checkout` renders the
  same drawer one step further on. They get shareable URLs, and the browser back button
  closes them.
- **Nested admin routes over query parameters.** Each admin tab is `/admin/:tab`, so a
  tab can be linked directly and back moves between tabs.
- **Shared state lives above the routes.** Cart, wishlist and the availability of cart products sit in
  one classic Redux store (`redux`, `react-redux`, `redux-thunk`) provided at the app root, because
  the cart has to survive navigation between screens. The checkout form and the menu state are
  React state of the store frame (`StoreLayout`), which outlives the cart drawer.
- **Filters that belong in the URL are in the URL.** The subcategory filter is a query
  parameter so a filtered page can be shared. Search text and sort order stay local,
  because they change on every keystroke and would flood the history.

**Middleware ordering keeps the SPA fallback honest.** Unknown paths must return
`index.html` (otherwise a refresh on `/product/216` would 404), but that catch-all is
dangerous if reached too early, so two routes terminate before it:

```
security headers → CORS → JSON body limit
  → /uploads   static, then 404          ← stops here, never falls through
  → /api       routes, then 404 JSON     ← stops here, never falls through
  → client static assets
  → GET *      index.html                 (the SPA fallback)
```

Without the `/uploads` terminator a missing image returned `index.html` with HTTP **200**,
a broken link that looked like a success. Both terminators are covered by tests.

**Migrations run on startup, before the port opens.** Schema changes are plain `.sql`
files applied in order and recorded in `schema_migrations`. Migration `000` creates the
`products` table that the early migrations assume, so a fresh database reaches the full
schema. `smoke-fresh-db` proves it on every test run. Demo data is deliberately *not* part
of this: the runner only reads `.sql` files.

**Hide instead of delete.** `products.active` is how a product leaves the shop without
leaving the database, because orders, reviews and the calculators reference products by id.
A hidden product does not exist for a customer: it's absent from lists, search and
category counts, and `GET /api/products/:id` returns the same 404 as an id that never
existed. An admin sees hidden products only when asking for them (`?active=all|false`),
except by id, so the edit form can restore one. The rule lives in `product.service`, and
checkout rejects hidden products again. A product that has orders cannot be deleted
(409); the admin is offered "hide" instead.

**The pick list is its own column.** Picked lines are `orders.picked_items`, a set of line
indexes (migration 011), and not a flag inside the `items` JSONB. That keeps the record of
the sale untouched and keeps warehouse state out of the customer's order lookup. Each toggle
is one atomic `UPDATE`. See [ARCHITECTURE.md](docs/ARCHITECTURE.md#main-design-decisions).

**Content-hashed images, long cache.** Every uploaded image is named after a hash of its
processed bytes, so a changed image is a new URL. `/uploads` is cached for a week and
`/static` for a year as `immutable`, while `index.html` is never cached.

**The admin is lazy-loaded.** `React.lazy` + `Suspense` on `/admin/:tab`: the main bundle
went from 149.25 kB to 132.13 kB (gzipped), and the admin is a separate chunk (21.1 kB when
it was split out).

**CSS: ITCSS, one component per partial.** `client/src/css/app.css` imports
`base → layout → components → features/<domain>`, and its import order is the cascade.
The rules are in [client/src/css/CONVENTIONS.md](client/src/css/CONVENTIONS.md).

---

## Security

- **The admin password is only ever checked on the server**, with a constant-time
  comparison over SHA-256 digests.
- **Sessions are hand-rolled HMAC tokens:** `base64url(payload).base64url(HMAC-SHA256(payload))`.
  The algorithm is fixed in code and not read from the token, so the `alg: none` class of
  JWT attack does not apply. Signatures are compared with `crypto.timingSafeEqual`.
- **The token is delivered in an `httpOnly`, `SameSite=Strict` cookie**, never in the
  response body. `Secure` is set automatically in production.
- **The server refuses unsafe configuration.** It will not start with an invalid `NODE_ENV`
  (only `development`, `test` and `production` are allowed), with `NODE_ENV` unset next to a
  database that is not on this machine, or with a malformed `CORS_ORIGINS`, `PORT`,
  `DB_PORT`, `SESSION_TTL_HOURS` (above 168) or limiter window (above 24 hours). In production it
  also needs a `SESSION_SECRET` of at least 32 characters, an `ADMIN_PASSWORD` of at least 12,
  and an `https` `ADMIN_URL`. Each error names the variable, never its value. The `NODE_ENV`
  check is a safety net: a deployment still has to set `NODE_ENV=production` itself.
- **Secrets live only in the environment.** `.env` is gitignored, `.env.example` holds
  placeholders only, and `test/unit-repo-hygiene.js` fails the suite if `.env` is tracked
  or any secret value from it appears in a tracked file.
- **Login, order lookup and public writes are rate limited**, per client address, with
  `RateLimit-*` and `Retry-After` headers on a `429`:

  | Route | Default limit | Variables |
  |---|---|---|
  | `POST /auth/login` | 10 per 15 minutes (a good login resets the counter) | `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` |
  | `POST /orders` | 10 per 15 minutes | `ORDER_RATE_MAX`, `ORDER_RATE_WINDOW_MS` |
  | `POST /reviews` | 5 per hour | `REVIEW_RATE_MAX`, `REVIEW_RATE_WINDOW_MS` |
  | `GET /orders/by-phone/:phone` | 20 per 15 minutes (fixed in code) | none |

  Every request counts, a retry of the same order included. The counters live in the memory of
  the Node process, so a restart clears them and several instances would not share them. A `429`
  never creates or changes an order: the checkout keeps the order it was sending, with the same
  `request_id`, and the customer sends it again by hand a few minutes later (the server then
  returns the original, never a second order). `TRUST_PROXY_HOPS` decides which address is
  counted behind a proxy and must match the hosting; see [docs/security.md](docs/security.md).
- **Errors say only what this API wrote.** PostgreSQL's text, the JSON parser's text and the
  message of an unexpected error are never sent, and no response carries a stack trace in any
  environment (5xx errors are logged in full on the server). Ids and offsets above
  2147483647 are a `400`; an order's notes, delivery address and item names are length-limited.
- **Order totals are computed server-side**; see Design decisions. Editing `total` or
  `items` on an existing order is rejected with a 400.
- **Reviews are always stored unapproved**, and the public endpoints always return approved
  reviews only, whatever the query asks.
- **Every query is parameterised**, and **every input is validated and bounded**.
- **Uploads are restricted** to an allowlist of image types, capped at 15 MB and 5 files,
  re-encoded (which strips metadata, GPS included) and stored under a content hash.
- **User-supplied values in emails are HTML-escaped.**
- **Security headers on every response:** `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in
  production. `X-Powered-By` is disabled. CORS is open in development and restricted to
  configured origins in production.

A Content Security Policy is written but **off by default** (`CSP_ENABLED=true` turns it on).
It is not ready to enable: as written it would also block the Google Fonts stylesheet and font
files that `client/public/index.html` loads, and the note in `securityHeaders.js` about the
`application/ld+json` block has not been checked in a browser.

**What is not solved yet** (public order lookup that returns customer details, personal data in
logs and in `localStorage`, in-memory counters, WebSocket and upload hardening, database TLS), and
the checklist to go through before deploying, are in [docs/security.md](docs/security.md).

---

## Accessibility

The storefront targets **IS 5568 / WCAG 2.1 AA**. `npm run a11y` audits 12 storefront
pages and the admin's orders screen (logged in, pick list open) at desktop, mobile and
dark-mode settings with axe-core, plus heading-structure, language,
skip-link and zoom-reflow checks, and must report zero findings. The audit and its fixes are
written up in [docs/a11y-audit.md](docs/a11y-audit.md); the public statement is at
`/accessibility`. There is no third-party accessibility overlay.

---

## Testing

```bash
npm test               # server: unit and smoke suites
npm run test:client    # client: 40 suites, 736 tests
npm run a11y           # accessibility: serves client/build, so run npm run build:client first
```

Each HTTP suite starts its own server on a port the operating system picks, so the suites can run while the real
server is on 3000. They create temporary records and delete them afterwards.

They run only against a separate local database, so they never touch your development
data. `TEST_DATABASE_URL` is required for `npm test` and `npm run a11y`: without it, with
`NODE_ENV=production`, with a malformed URL, with a remote host, or pointing at the
development database (`DB_*`), they refuse to start (`test/lib/testDatabase.js`). Create the
database once and set the variable in your local environment file (it carries the
password, so it never goes in `.env.example`):

```bash
createdb tamburia_test
# then set TEST_DATABASE_URL=postgresql://<user>:<password>@localhost:5432/tamburia_test
```

The database name must contain the word `test`, so a name such as `postgres` or `tamburia` is refused.

The same rules hold when a suite is started by hand (`node test/smoke-orders.js`). An HTTP suite
never talks to a server somebody else started and ignores `NEW_URL`: it runs the whole guard,
checks the configuration it loaded, asks PostgreSQL itself for its identity (database, user,
port and address) before the first migration, and only then starts its own server
(`test/lib/testServer.js`). `npm test` only runs the suites one after the other.

| Suite | Checks | Covers |
|---|---|---|
| `unit-repo-hygiene` | 8 | `.env` not tracked, `.env.example` placeholders only, no secret value in any tracked file |
| `unit-config` | 186 | Every startup rule of `server/config/env.js` (`NODE_ENV`, `DB_HOST` with `NODE_ENV` unset, session secret and password length, `ADMIN_URL`, `CORS_ORIGINS`, ports, session lifetime, limiter windows, rate-limit defaults and `TRUST_PROXY_HOPS`), no secret in any message, optional mail credentials, and the delivery fee agreeing across client, server default and `.env.example` |
| `unit-test-database-guard` | 168 | The guard that keeps `npm test` and `npm run a11y` on a separate local database |
| `unit-no-private-phone` | 5 | The shop owner's private number appears nowhere public |
| `unit-numeric-ids` | 71 | Ids, offsets and `sort_order` above the PostgreSQL `INTEGER` maximum are a 400; the error handler maps numeric-range errors |
| `unit-error-handler` | 90 | The client sees only this API's text: no PostgreSQL or parser text, no stack trace, `AppError` details kept, a 4xx database warning that logs no URL or personal data |
| `unit-rate-limit` | 41 | The limiter and its keys: IPv4, IPv4-mapped IPv6, IPv6 `/64`, 429 and `Retry-After`, separate counters, the window |
| `unit-order-limits` | 15 | Exact limits of an order's notes (1000), delivery address (200) and item names (255) |
| `unit-order-service` | 80 | Order business rules, the pick list and idempotent creation (replay, payload mismatch, lost race) included, without network or database |
| `unit-email-delivery` | 16 | The email sender never throws and never waits forever: transport timeouts, the 10-second deadline, a timed-out send reported as an unknown outcome, its timer cleared, no unhandled rejection |
| `unit-product-service` | 14 | Hidden-product visibility for customers and admins, with a fake repository |
| `unit-review-service` | 13 | Moderation: public reads approved-only, new reviews unapproved |
| `unit-auth-cookie` | 39 | Reading the admin cookie through cookie-parser: missing, expired, tampered, URL-encoded, malformed, quoted and duplicated cookies, `requireAdmin` / `markAdmin`, and the WebSocket upgrade |
| `unit-money` | 23 | Agorot arithmetic and price parsing |
| `unit-originals` | 14 | Keeping and finding the full-resolution original of an upload |
| `smoke-fresh-db` | 13 | An empty database: every migration, the catalogue import, and a column-by-column schema match with the real one |
| `smoke-static` | 47 | Client serving, cache and security headers, SPA fallback and its boundaries, no internal file exposed, the admin kept out of the main bundle |
| `smoke-orders` | 248 | Order lifecycle, server-side pricing and totals, 409 on changed prices, 409 on a product out of stock, 409 on a colour or size the product no longer offers, `request_id` idempotency (replay, 422 on a different order, 8 concurrent requests, malformed ids, no internal fields exposed), order size limits and the `NUMERIC(10,2)` ceiling, status transitions, pagination, immutable fields, the pick list (tick, untick, missing line or order, no login) |
| `smoke-products` | 168 | CRUD, partial updates, subcategories, hiding, delete with and without orders, image cleanup |
| `smoke-settings` | 21 | The closed list of settings keys, set, reset |
| `smoke-reviews` | 57 | Moderation, the public/admin split, the stats contract the home page depends on |
| `smoke-pigments` | 48 | The 20 shades, ordering, search, the light < medium < dark invariant |
| `smoke-contract` | 267 | Black-box HTTP contract of every route (REFACTOR_PLAN P5): 401 on every admin route, side-effect-free probes with exact status and message, list/pagination shapes, error shape, security headers, CORS, parser errors in Hebrew, no database text, numeric limits, field-length limits, and the database effects of product, order, review and pigment flows |
| `smoke-rate-limits` | 41 | The order and review limits on the real routes (low limits, set before the server starts): 429 with `Retry-After`, separate counters, nothing else limited, and a refused or replayed order never creating a second one |
| `smoke-auth` | 46 | Login, cookie flags, every guarded route, logout, rate limiting |

---

## Getting started

**Requirements:** Node.js 18 or newer, and PostgreSQL with an empty database named `tamburia`.
`npm run a11y` also needs Chrome or Edge installed.

```bash
git clone https://github.com/idand2459-dot/tamburia-store.git
cd tamburia-store

npm install
npm install --prefix client

cp .env.example .env        # set DB_PASSWORD and ADMIN_PASSWORD (see below)
npm run migrate             # creates the schema (npm start also does this)
npm run products:import     # loads the catalogue from scripts/products_import_template.csv
npm run build:client
npm start
```

The store comes up at **http://localhost:3000** and the admin panel at **/admin**.
Imported products point at photo files that are not in the repository, so they show their
category icon until real photos are added (see [docs/product-photos.md](docs/product-photos.md)).

### Environment variables

The full list with comments is in [`.env.example`](.env.example). The ones that matter:

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | — | **Required.** PostgreSQL password |
| `NODE_ENV` | `development` | `development`, `test` or `production`; anything else stops the server. Set `production` explicitly when deploying |
| `ADMIN_PASSWORD` | — | **Required.** Admin panel password; at least 12 characters in production |
| `SESSION_SECRET` | random per start | Token signing secret. **Required in production**, at least 32 characters |
| `SESSION_TTL_HOURS` | `12` | Admin login lifetime, 1 to 168 |
| `ADMIN_URL` | `http://localhost:3000/admin` | Admin link in the new-order email. **Required in production**, and must be `https` |
| `CORS_ORIGINS` | empty | Extra origins allowed to call the API, comma separated; each exactly `scheme://host[:port]` |
| `MAIL_ENABLED` | `true` (`.env.example`: `false`) | `false` logs emails instead of sending them |
| `MAIL_USER` / `MAIL_PASS` | — | Gmail account and app password; required only when mail is enabled |
| `PORT` / `DB_PORT` | `3000` / `5432` | Server and PostgreSQL ports, 1 to 65535 |
| `ORDER_RATE_MAX` / `ORDER_RATE_WINDOW_MS` | `10` / 15 minutes | Order creations per client address and window |
| `REVIEW_RATE_MAX` / `REVIEW_RATE_WINDOW_MS` | `5` / 1 hour | Review creations per client address and window |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MS` | `10` / 15 minutes | Login attempts per client address and window |
| `TRUST_PROXY_HOPS` | `1` in production, `0` elsewhere | Proxies in front of the server, 0 to 5; decides which address the limits count |
| `DELIVERY_FEE` | `20` | Delivery fee in shekels (must match `client/src/js/utils/delivery.js`) |
| `CSP_ENABLED` | `false` | Content Security Policy (see Security) |

A limiter window is at most 24 hours. The rules, the reasons, and the checklist for deploying
are in [docs/security.md](docs/security.md).

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Commands

| Command | What it does |
|---|---|
| `npm start` | Runs migrations, then the server on port 3000 |
| `npm run migrate` | Runs migrations without starting the server |
| `npm run build:client` | Builds the React app into `client/build` |
| `npm run dev:client` | React dev server with hot reload on port 3001, API proxied to 3000 |
| `npm test` | Server test suites |
| `npm run test:client` | Client tests (Jest) |
| `npm run a11y` | Accessibility audit (`-- --report` writes `docs/a11y-report.md`) |
| `npm run products:import` | Imports or merges the catalogue from a CSV (default: `scripts/products_import_template.csv`) |
| `npm run seed:demo` | Inserts demo orders and reviews |
| `npm run seed:demo:clear` | Removes exactly that demo data again |
| `npm run images:categories` | Converts the category banner PNGs in `design-assets/` to WebP |
| `npm run products:list` | Writes the printable shooting list (CSV + A4 HTML) |
| `npm run images:products` | Turns raw product photos into 1200×1200 white-background WebP |
| `npm run products:hide-unphotographed` | Lists (and with `--apply`, hides) products that were not photographed |
| `npm run products:new-template` | Writes the Excel sheet for products photographed but not in the catalogue |
| `npm run products:import-new` | Validates (and with `--apply`, creates) the products from that sheet |

The last four are the shooting-day pipeline, documented step by step in
[docs/product-photos.md](docs/product-photos.md).

### Demo data

A fresh install has products but no orders or reviews, which leaves the admin dashboard
and the review sections empty. To fill them:

```bash
npm run seed:demo
```

This inserts 6 orders across every status, dated over the last week, plus 7 reviews
(5 approved, 2 awaiting moderation). Line items are built from real products in your
database. Every created id is printed and recorded in `scripts/.seed-demo-manifest.json`.

```bash
npm run seed:demo:clear
```

Removes the demo rows **by those exact ids**, so the database can be handed over clean.
Without the manifest it falls back to the demo markers: orders use phone numbers in the
unallocated `050-000000x` block, and reviews match on their exact name and text.

### Client development

```bash
npm start              # server, port 3000
npm run dev:client     # React with hot reload, port 3001 (set in client/.env.development)
```

> `client/build` is not committed. After any change under `client/src`, run
> `npm run build:client`, or the server at port 3000 keeps serving the previous version.

---

## API

Everything is under `/api`. Routes marked 🔒 require an admin session.

| Domain | Routes |
|---|---|
| **Auth** | `POST /auth/login` · `POST /auth/logout` · 🔒 `GET /auth/me` |
| **Products** | `GET /products` · `GET /products/:id` · `GET /products/categories` · 🔒 `POST` `PUT /:id` `DELETE /:id` |
| **Orders** | `POST /orders` (optional `request_id`: one order per id, a retry gets the original back with 200 and `Idempotent-Replayed: true`, the same id with a different order is 422; rate limited, 429 with `Retry-After`) · `GET /orders/by-phone/:phone` · 🔒 `GET /orders` `GET /:id` `GET /stats` `PUT /:id` `PUT /:id/status` `DELETE /:id` |
| **Reviews** | `GET /reviews` · `GET /reviews/stats` · `POST /reviews` (rate limited, 429) · 🔒 `GET /reviews/all` `GET /:id` `PUT /:id` `PUT /:id/approve` `DELETE /:id` |
| **Pigment formulas** | `GET /pigment-formulas` · `GET /pigment-formulas/:id` · `GET /pigment-formulas/code/:code` · 🔒 `POST` `PUT /:id` `DELETE /:id` |
| **Settings** | 🔒 `GET /settings/:key` · 🔒 `PUT /settings/:key` |
| **Uploads** | 🔒 `POST /upload-multiple` |
| **Health** | `GET /health` |

List endpoints accept `limit`, `offset`, `sort`, `order` and per-domain filters. Without
`limit` or `offset` they return a flat array; with them, an object carrying pagination.

Some endpoints are part of the API but have no screen yet: `GET /orders/stats`,
`GET /products/categories`, single-record `GET`/`PUT` for orders and reviews, and pigment
formula editing. All of them are tested.

`:key` in **Settings** is not free-form: the server knows a closed list of keys and
returns 404 for anything else. Today there is one, `stats-counting-from`: the date the
statistics tab counts its sums from. `PUT` with `value: null` deletes it, which undoes a reset.

---

## Status and known issues

This is a working application running locally against a real database. It is **not
deployed** yet, and the screenshots use seeded demo data.

Known gaps, in rough order of how much they matter:

1. **Not every product has a photograph yet.** About a third of the active catalogue has
   real photos from the shoot; the rest show their category icon.
2. **Unpriced products.** About 90 active products have no price yet. They show
   **"מחיר בחנות"**, cannot be added to the cart, and sort last in both price orders.
3. **The `kitchen` category is defined but has no active products.** It appears on the home
   page and leads to an empty category page.
4. **Rate limiting is in-process.** Counters live in the Node process's memory, which is
   correct for a single server but would not hold behind more than one instance.
5. **Security and privacy gaps are open** beyond that: the order lookup by phone number returns
   the customer's details, personal data reaches some logs and `localStorage`, the CSP is off,
   and the WebSocket, uploads and database TLS are not hardened. They are listed, with the
   deployment checklist, in [docs/security.md](docs/security.md). There is also no privacy policy
   or terms page yet.

The figures in the home page hero (400+ products, 12 categories, 30+ years) are hardcoded.
The rating beside them is computed from approved reviews and disappears when there are none.
