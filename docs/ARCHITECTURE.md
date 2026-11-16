# Architecture

Technik Tambour is a Hebrew, right-to-left online store for a hardware shop, plus the owner's
admin panel. One Node process serves the REST API, the uploaded images and the built React app
from the same origin.

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js ≥ 18, Express 5 |
| Database | PostgreSQL through `pg`. No ORM; plain SQL in repository files |
| Client | React 19 (Create React App), react-router 7, lucide-react icons |
| Images | `multer` for uploads, `sharp` to resize, square and re-encode them to WebP |
| Email | Nodemailer (Gmail) |
| Auth | Hand-written HMAC-SHA256 session token in an `httpOnly` cookie |
| Tests | Server: plain Node scripts against a real server and database. Client: Jest + Testing Library. Accessibility: axe-core through Puppeteer |

## Folder structure

```
server/
  server.js        starts the process: migrations, HTTP server, graceful shutdown
  app.js           builds the Express app; middleware order lives here
  config/          env.js (reads and validates every variable), db.js (the one pg Pool)
  db/              migrate.js (the runner) and migrations/000–012 (.sql, applied in order)
  api/             index.js (mounts the domains, GET /health) and one folder per domain:
                   product, order, review, pigmentFormula, setting, auth, upload. A domain folder holds
                   <d>.routes (public vs admin endpoints), <d>.validator (parse and bound input, 400),
                   <d>.controller (HTTP to a service call and back; no SQL, no repository import, no
                   try/catch), <d>.service (business rules) and <d>.repository (all SQL, parameterised,
                   explicit column lists). order also holds pricing.service and order.rules (the delivery-area and status-vs-method rules that the validator and the service share); auth and upload have no repository
  services/        shared infrastructure: email, image processing
  middleware/      security headers, admin guard, rate limiting, uploads, the central error handler
  utils/           AppError, money in agorot, pagination envelope, category tree, originals

client/src/
  index.js         entry point (CRA requires exactly this path)
  css/             app.css imports every partial: base / layout / components / features/<domain>
  js/App.js        the Redux Provider and the route table
  js/StoreLayout.js  the store frame: navbar, footer, drawers, floating buttons around <Outlet>; owns the checkout form and the menu state
  js/pages/        route screens only (home, category, product, static pages, admin login, admin/)
  js/components/   reusable UI: Drawer, Navbar, Footer, ProductCard, ProductList, LoadingStates…
  js/features/     feature UI by domain: home, catalog (+ product-page), cart, calculators
  js/store/        the Redux store: cart, wishlist (the saved product records, the one wishlist state every screen reads), availability (…Actions, …Reducer, …Selectors per domain); persistence.js copies the cart and the wishlist to localStorage
  js/hooks/        state and effects: useCheckoutForm, useAvailability (recently viewed), useAdmin*…
  js/services/     every server call the storefront makes (http, product, review, order, pigment, auth)
  js/routes/       AdminRoute: the session guard in front of the admin
  js/utils/        pure helpers: pricing, store info, colour palette, category icons…

test/              server suites (unit-*, smoke-*), run by run-all.js
scripts/           catalog import, demo data, the product-photo pipeline, the a11y audit
```

## A request, end to end: placing an order

1. **Cart, in the browser.** The Redux store (`store/cart`) keeps the cart lines and the delivery
   method; the lines are saved to `localStorage`. Selectors compute the subtotal, the delivery fee
   (the same `DELIVERY_FEE` as the server, 20 ₪) and the total for display only. The
   `checkAvailability` thunk (`store/availability`) asks `GET /api/products?ids=…` which saved
   items are still in the catalogue, and the cart blocks checkout for any that aren't.
2. **Submit.** `features/cart/CheckoutFormView` calls `handlePlaceOrder` from
   `hooks/useCheckoutForm` (called in `StoreLayout`). It builds the order (customer, delivery method, and for each line
   the product id, quantity, chosen variant/colour/size and the price the customer saw) and
   calls `services/orderService.createOrder` → `POST /api/orders`.
3. **Route → limiter → validator → controller.** `api/order/order.routes` first runs the order
   limiter (`createLimiter`, 10 requests per 15 minutes per client address by default; over it,
   a 429 with `Retry-After`, answered before the controller, so nothing is created or read), then
   maps the request to `orderController.create`, which runs
   `api/order/order.validator.parseCreate`: types, lengths (notes 1000, delivery address 200, an item
   name 255, customer name 30), ids no larger than the PostgreSQL `INTEGER` maximum, phone, a
   delivery address when delivering, and the delivery city against the allowed list. Bad input
   becomes a 400.
4. **Service: pricing.** `api/order/order.service.createOrder` first calls
   `api/order/pricing.service.priceOrder`, before anything is written:
   - loads the products with `Product.findPricesByIds`;
   - rejects (400) a line whose product doesn't exist or is hidden, an unknown variant, or a
     product with no price yet; a product with `in_stock = false` is refused with **409** and
     `details.reason = 'out_of_stock'` (reported before a changed price; no quantities are tracked);
   - refuses (409, `details.reason = 'option_unavailable'`, after stock and before price) a line
     whose `selectedColor` or `selectedSize` is not an option the product defines today; a null
     one is accepted (calculator bundle lines carry none), and the check is only at creation, so
     orders already saved keep whatever they hold;
   - rejects (400) more than 50 lines, more than 999 units in a line, or a total above
     99,999,999.99 (the largest `NUMERIC(10,2)`), so the insert can never fail on size;
   - takes **each price from the database** (the variant's if one was chosen) and the name too;
   - compares it with what the client sent, in agorot. Any difference means **409** with
     every current price in `details.prices`, and the order is not saved;
   - computes `subtotal`, `delivery_fee` (from `DELIVERY_FEE`) and `total` in integer agorot,
     converting to shekels only at the end. Whatever totals the request carried are ignored.
5. **Repository.** `orderRepository.create` inserts the priced order with one parameterised `INSERT`.
   With a `request_id` it is `createOnce`: `INSERT … ON CONFLICT (request_id) DO NOTHING`, see
   *One order per request id* below.
6. **Side effects.** The service sends the store and the customer their emails. Nothing is
   pushed to the admin: the open admin screen polls `GET /api/orders` every 30 seconds while
   its tab is visible and announces ids it has not seen. A mail
   failure never fails the order. The answer waits for the two emails, but never longer than
   about 10 seconds: the SMTP transport has 5 s connection, greeting and DNS timeouts and an 8 s
   socket timeout, with a 10 s deadline over each send. A send that hit the deadline is reported as
   `{ sent: false, reason: 'timeout' }`, which means *unknown*, not *failed*: the message may
   still have gone out. So `emails.store` and `emails.customer` being `false` means "not
   confirmed sent".
7. **Back in the browser.** 201 (or 200 for a replay): the success step shows and the cart empties. 409 (price): the
   hook applies `details.prices` to the cart; each change must be acknowledged by the customer
   before the order can be sent. 409 (out of stock, or a colour/size that is gone): the cart is
   checked again and the lines are blocked. A 429 (the rate limit) keeps the attempt, see below.
   Any other 4xx shows the server's message and keeps the cart. A timeout, a network failure or
   a 5xx is an unknown outcome, see below.

**One order per request id (P7.4).** Every submission carries a `request_id`, a version-4 UUID
the browser creates once per order. `orders.request_id` has a partial unique index
(migration 012), so PostgreSQL, not the code, decides who wins when requests race, and
`orders.request_hash` is the SHA-256 of the order as the validator normalized it (customer,
delivery, notes and each line's id, name, price, quantity, variant, colour and size; not the id
itself and not the totals). `createOrder` looks the id up *before* pricing:
- found, same hash: the original order comes back with **200** and `Idempotent-Replayed: true`,
  with no repricing (a price or stock change after the sale is not a reason to refuse a
  retry), no emails; `emails` is `{ store: null, customer: null }`
  (unknown), and `picked_items`, `request_id` and `request_hash` are not returned;
- found, different hash: **422**, `details.reason = 'request_id_reused'`, and nothing is returned
  from the other order;
- not found: priced and inserted with `ON CONFLICT … DO NOTHING`. If another request took the id
  in between, the same two rules apply to the row it wrote, so concurrent identical requests give
  exactly one 201 and the rest 200.

A rejected request (400, 409) stores nothing, so the same id can be used again once the cause is
fixed. The id is optional, so older clients work and simply get no protection, and its shape (v4
UUID, 122 random bits) is enforced so that it cannot be guessed.

On the client, `hooks/useCheckoutForm` keeps the id and the *exact body sent* in localStorage
(`tamburia-checkout-attempt`, written just before the request leaves) until the outcome is known:
- the order was created (201, or 200 for a replay) or the server refused it with a 4xx: the attempt
  is removed;
- a timeout (20 s, `AbortController` + `setTimeout`, so it works in older browsers), a network
  failure, a 5xx, a 408 or an answer that is not JSON: the outcome is unknown, so the attempt is
  kept for at most 48 hours, and a new order cannot be sent. The checkout shows the unresolved
  order and offers *send it again* (the same body and id, so the server returns the original) or
  *cancel* (a second click, after a warning that a duplicate may be created);
- 48 hours after the *first* submission (a resend stores the same `submittedAt`, so it never moves
  the clock) the customer's details are removed from the device and an expired record stays:
  `{ requestId, submittedAt, expired, itemCount, total }`. It cannot be sent again, because there
  is no body to send, and nothing sends it by itself. The notice says the outcome is unknown,
  not that the order failed, and sends the customer to the store; only *cancel* is offered, with
  the same duplicate warning, and only cancelling lets a new order get a new `request_id`. The
  time is checked when the page loads, before every send, and by one timer for the due time, so
  a browser that was closed and a page that stayed open both lose the details on time. A record
  that cannot be dated or read is treated as expired or removed (`store/persistence.js`);
- a 429 keeps the attempt too, unchanged (the same body, the same `request_id`, the same stored
  text), and shows the server's message with a line saying the same order can be sent again in a
  few minutes. The limiter answers before it looks at the request, so a 429 proves nothing about
  an earlier send of the same order: treating it as a refusal (and dropping the attempt) could
  lead to a duplicate. Nothing is retried automatically, no new `request_id` is made, and the
  customer presses *send again*, which the server answers with the original order if it exists.
  Limits count every request, a replay included; see [security.md](security.md);
- a 422 keeps the attempt, flagged as a conflict, and offers only *cancel*;
- if localStorage cannot hold the attempt it still works in memory, the message does not promise
  that a reload is safe, and the notice says that a reload will lose it;
- when the original is confirmed after the customer changed the cart, the cart and the form are
  kept (the confirmed order is shown, with a note), and are emptied only if the cart is still the
  order that was sent.

The attempt holds the customer's name, phone and address (no payment data exists in this app) and
nothing is logged.

**The cart is checked against the catalogue** (`checkAvailability`, one `GET /api/products?ids=`)
on the first load, when the set of products changes, on entering the cart or the checkout, and
when the tab becomes visible again. A product missing, out of stock or without a price blocks all
its lines; a variant that is gone blocks only its line; a different price re-prices the line and
is kept as a pending change (also in localStorage, so a reload cannot skip it). The server still
decides at order time.

Errors at any layer are thrown as `AppError(status, message, details)` and become JSON in the
single `middleware/errorHandler`. No controller has a `try/catch`. The handler sends only text
this API wrote: an `AppError`'s message and details, a translated message for a known PostgreSQL
error (its status kept, 4xx included), a Hebrew message for a body-parser error (malformed JSON,
a body over 200 KB, an unsupported encoding), and a generic text for anything else. What
PostgreSQL, the parser or an unexpected error says is never sent, and no response carries a stack
trace in any environment; 5xx errors are logged in full on the server.

## Main design decisions

**Prices are decided by the server.** The client sends the price it showed only so that a
silent change can be caught (409), never to be charged. Money is integer agorot inside the
server and `NUMERIC(10,2)` in the database (migration 010), so 3 × 12.90 is 38.70, not
38.699999…

**Hide instead of delete.** Orders reference products by id, so a product leaves the shop
with `active = false` (migration 009) instead of being deleted. For a customer a hidden
product does not exist: it's absent from lists and search, and `GET /products/:id` returns
the same 404 as an id that never existed. An admin sees hidden products only when asking
(`?active=all|false`), except by id, so the edit form can bring one back. The rule lives
in `product.service`, and pricing rejects hidden products again at checkout. `DELETE` works
only for a product with no orders. Otherwise it returns 409 and suggests hiding.

**The pick list is a parallel column, not a field inside `items`.** An order's lines are
JSONB in `orders.items`, so there is no row to add `picked` to. Which lines are picked is
`orders.picked_items INTEGER[]` (migration 011), the set of picked line indexes. `items`
stays the untouched record of the sale. It is never edited, and the customer is never told
which lines are picked: picking is warehouse state that no public answer carries. A set of
indexes has no length to keep aligned with `items`, and old orders get `'{}'` with no
backfill. One toggle is a single `UPDATE` with `array_append` / `array_remove`, so two
devices ticking different lines never overwrite each other. The index is stable because
`items` never changes after the order is saved.
`PUT /api/orders/:id/items/:line/picked { picked }` is admin-only. A line past the end is
404, and the status never changes here. On the client the toggle is optimistic, and a failed
save reverts only that line.

**Content-hashed images.** Every upload is resized to a 1200px long edge, padded to a
square, stripped of metadata (GPS included) and saved as WebP named after the SHA-256 of
its own bytes. The photo pipeline uses `product-<id>-<hash>.webp`. A changed image is a new
URL, so `/uploads` can be cached for a week and the build's `/static` for a year
(`immutable`), while `index.html` is `no-store`.

**Layered server, every domain the same.** routes → validators → controllers → services →
repositories, for products, orders, reviews, pigment formulas and settings. The rules a reviewer
would look for each have one home: pricing in `pricing.service`, visibility in
`product.service`, moderation in `review.service` (public reads are approved-only whatever
the query says; new reviews are always unapproved). Auth, uploads and the health check have
no table, so they have no repository.

**One way to the server on the client.** Every storefront call goes through `services/`,
built on `services/http.js` (`getJson` / `postJson`, `ApiError` with status and details,
abort-aware). The admin has its own `api()` wrapper in `pages/admin/Admin.js`, because a 401
there must return to the login screen.

**The admin is lazy-loaded.** `App.js` loads `routes/AdminRoute` with `React.lazy` inside
`<Suspense>`, so a shopper never downloads the admin. The main bundle went from
149.25 kB to 132.13 kB gzipped, and the admin is a separate chunk (21.1 kB when it was split
out) that only `/admin` fetches. `smoke-static` fails if admin code lands back in the main bundle. Its CSS
stays in the main stylesheet, for the reason below.

**ITCSS, with the import order as the cascade.** `css/app.css` only imports, and its order
*is* the cascade: `base/` (tokens, reset, typography) → `layout/` → `components/` →
`features/<domain>/`. Rules are in `css/CONVENTIONS.md`: one component per partial, ≤ 400
lines, one dark-mode and one reduced-motion block per file, colours from tokens. Moving CSS
is checked by comparing, for every (selector, property), the ordered declarations across
every media context before and after.

**Security.** The admin password is checked only on the server, in constant time. The
session token's algorithm is fixed in code, and the cookie is `httpOnly` + `SameSite=Strict`
(+ `Secure` in production). Login, order creation and review creation are
rate-limited per client address (in the process's memory, one server), and every query is
parameterised. The server refuses to start on an invalid `NODE_ENV`, a malformed `CORS_ORIGINS`
or port, a session lifetime above 168 hours, or a limiter window above a day, and in production
also without a `SESSION_SECRET` of at least 32 characters, an admin password of at least 12, or an
`https` `ADMIN_URL`. Secrets come only from the environment: `.env` is gitignored,
`.env.example` holds placeholders, and `unit-repo-hygiene` fails if `.env` or any of its secret
values appears in a tracked file. The rules, the deployment checklist and the gaps that are not
closed yet (personal data in logs, the CSP, uploads,
database TLS) are in [security.md](security.md).

**Accessibility.** The storefront targets IS 5568 / WCAG 2.1 AA. `npm run a11y` audits
the 12 storefront pages and the admin's orders screen (logged in, pick list open, with two
temporary orders it deletes afterwards) at desktop, mobile and dark mode with axe-core plus heading, language and zoom
checks, and must report zero findings. The statement is at `/accessibility`.

## Tests

`npm test` runs the server suites one after the other and opens no database connection itself;
each HTTP suite starts its own server on a port the operating system picks, through
`test/lib/testServer.js`, and cleans up what it created. `TEST_DATABASE_URL` (a separate local
database) is required; the guard refuses `NODE_ENV=production`, a malformed URL, a host that is not local, and the
development database itself (`test/lib/testDatabase.js`):

- **unit-*** (no network or database): repo hygiene, config startup rules, order service,
  product visibility, review moderation, money, originals, admin cookie reading, the test-database guard,
  numeric ids and offsets, the error handler, the rate limiter and its address keys, and the order
  field-length limits.
- **unit-email-delivery**: the email sender's timeouts, deadline and non-throwing contract, with a
  fake transport.
- **smoke-fresh-db**: creates an empty database, runs every migration and the catalogue
  import, and compares the schema column by column with the real one.
- **smoke-static, -orders, -products, -settings, -reviews, -pigments, -contract, -rate-limits, -auth**: the HTTP
  contract of every endpoint, including server-side totals, guarded routes, cache and
  security headers, and SPA-fallback boundaries. `smoke-rate-limits` starts its server with low
  order and review limits, and every other suite runs with limits too high to reach. `smoke-contract` is the black-box net for the
  backend restructuring: it imports nothing from `server/` and covers every route, including
  all admin routes without a cookie.

`npm run test:client` runs the Jest tests (services, the Redux store, pricing, the admin
hooks and tabs, the pure utils, App routing). They live in `client/src/js/__tests__/`, in folders that
mirror the code they cover. `npm run test:e2e` drives the real build in Chrome against the guarded test database (see `test/e2e/run.js`). `npm run a11y` is the
accessibility gate (it serves `client/build`, so build first).

## Running it

```bash
npm install && npm install --prefix client
cp .env.example .env          # set DB_PASSWORD and ADMIN_PASSWORD; MAIL_ENABLED=false needs no Gmail
npm run migrate               # or let npm start do it
npm run products:import       # loads the catalogue from scripts/products_import_template.csv
npm run build:client
npm start                     # http://localhost:3000, admin at /admin
npm run dev:client            # optional: hot reload on :3001, API proxied to :3000
```
