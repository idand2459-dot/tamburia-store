# Architecture

Technik Tambour is a Hebrew, right-to-left online store for a hardware shop, plus the owner's
admin panel. One Node process serves the REST API, the uploaded images and the built React app
from the same origin.

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js ≥ 18, Express 5 |
| Database | PostgreSQL through `pg`. No ORM; plain SQL in model files |
| Client | React 19 (Create React App), react-router 7, lucide-react icons |
| Real time | `ws`: the admin's live order feed on `/ws` |
| Images | `multer` for uploads, `sharp` to resize, square and re-encode them to WebP |
| Email | Nodemailer (Gmail) |
| Auth | Hand-written HMAC-SHA256 session token in an `httpOnly` cookie |
| Tests | Server: plain Node scripts against a real server and database. Client: Jest + Testing Library. Accessibility: axe-core through Puppeteer |

## Folder structure

```
server/
  server.js        starts the process: migrations, HTTP server, WebSocket, graceful shutdown
  app.js           builds the Express app; middleware order lives here
  config/          env.js (reads and validates every variable), db.js (the one pg Pool)
  db/              migrate.js (the runner) and migrations/000–010 (.sql, applied in order)
  routes/          one router per domain; marks which endpoints are public and which need the admin
  validators/      parse and bound every body and query; throw 400 on bad input
  controllers/     translate HTTP to a service call and back; no SQL, no model imports, no try/catch
  services/        business rules: pricing, visibility, moderation, emails, realtime, auth, images
  models/          all SQL, parameterised, explicit column lists
  middleware/      security headers, admin guard, rate limiting, uploads, the central error handler
  utils/           AppError, money in agorot, pagination envelope, category tree, originals

client/src/
  index.js         entry point (CRA requires exactly this path)
  css/             app.css imports every partial: base / layout / components / features/<domain>
  js/App.js        shared state (cart, wishlist, checkout) and the route table
  js/StoreLayout.js  the store frame: navbar, footer, drawers, floating buttons around <Outlet>
  js/pages/        route screens only (home, category, product, static pages, admin login, admin/)
  js/components/   reusable UI: Drawer, Navbar, Footer, ProductCard, ProductList, LoadingStates…
  js/features/     feature UI by domain: home, catalog (+ product-page), cart, calculators
  js/hooks/        state and effects: useCart, useCheckoutForm, useAvailability, useAdmin*…
  js/services/     every server call the storefront makes (http, product, review, order, pigment, auth)
  js/routes/       AdminRoute: the session guard in front of the admin
  js/context/      StoreContext, the object App.js hands to every screen
  js/utils/        pure helpers: pricing, store info, colour palette, category icons…

test/              15 server suites (unit-*, smoke-*), run by run-all.js
scripts/           catalog import, demo data, the product-photo pipeline, the a11y audit
```

## A request, end to end: placing an order

1. **Cart, in the browser.** `hooks/useCart` keeps the cart in `localStorage` and computes the
   subtotal, the delivery fee (the same `DELIVERY_FEE` as the server, 20 ₪) and the total for
   display only. `useAvailability` asks `GET /api/products?ids=…` which saved items are still
   in the catalogue, and the cart blocks checkout for any that aren't.
2. **Submit.** `features/cart/CheckoutFormView` calls `handlePlaceOrder` from
   `hooks/useCheckoutForm`. It builds the order (customer, delivery method, and for each line
   the product id, quantity, chosen variant/colour/size and the price the customer saw) and
   calls `services/orderService.createOrder` → `POST /api/orders`.
3. **Route → validator → controller.** `routes/order.routes` maps the request to
   `orderController.create`, which runs `validators/order.validator.parseCreate`: types,
   lengths, phone, a delivery address when delivering, and the delivery city against the
   allowed list. Bad input becomes a 400.
4. **Service: pricing.** `services/order.service.createOrder` first calls
   `services/pricing.service.priceOrder`, before anything is written:
   - loads the products with `Product.findPricesByIds`;
   - rejects (400) a line whose product doesn't exist or is hidden, an unknown variant, or a
     product with no price yet;
   - takes **each price from the database** (the variant's if one was chosen) and the name too;
   - compares it with what the client sent, in agorot. Any difference means **409** with
     every current price in `details.prices`, and the order is not saved;
   - computes `subtotal`, `delivery_fee` (from `DELIVERY_FEE`) and `total` in integer agorot,
     converting to shekels only at the end. Whatever totals the request carried are ignored.
5. **Model.** `Order.create` inserts the priced order with one parameterised `INSERT`.
6. **Side effects.** The service broadcasts `order:created` over the WebSocket, so the open
   admin chimes and refreshes, and sends the store and the customer their emails. A mail
   failure never fails the order.
7. **Back in the browser.** 201: the success step shows and the cart empties. 409: the hook
   applies `details.prices` to the cart so the customer sees the new total before trying
   again. Any other error shows the server's message and keeps the cart.

Errors at any layer are thrown as `AppError(status, message, details)` and become JSON in the
single `middleware/errorHandler`. No controller has a `try/catch`.

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

**Content-hashed images.** Every upload is resized to a 1200px long edge, padded to a
square, stripped of metadata (GPS included) and saved as WebP named after the SHA-256 of
its own bytes. The photo pipeline uses `product-<id>-<hash>.webp`. A changed image is a new
URL, so `/uploads` can be cached for a week and the build's `/static` for a year
(`immutable`), while `index.html` is `no-store`.

**Layered server, every domain the same.** routes → validators → controllers → services →
models, for products, orders, reviews, pigment formulas and settings. The rules a reviewer
would look for each have one home: pricing in `pricing.service`, visibility in
`product.service`, moderation in `review.service` (public reads are approved-only whatever
the query says; new reviews are always unapproved). Auth, uploads and the health check have
no table, so they have no model.

**One way to the server on the client.** Every storefront call goes through `services/`,
built on `services/http.js` (`getJson` / `postJson`, `ApiError` with status and details,
abort-aware). The admin has its own `api()` wrapper in `pages/admin/Admin.js`, because a 401
there must return to the login screen.

**The admin is lazy-loaded.** `App.js` loads `routes/AdminRoute` with `React.lazy` inside
`<Suspense>`, so a shopper never downloads the admin. The main bundle went from
149.25 kB to 132.13 kB gzipped, and the admin is a separate 21.1 kB chunk that only
`/admin` fetches. `smoke-static` fails if admin code lands back in the main bundle. Its CSS
stays in the main stylesheet, for the reason below.

**ITCSS, with the import order as the cascade.** `css/app.css` only imports, and its order
*is* the cascade: `base/` (tokens, reset, typography) → `layout/` → `components/` →
`features/<domain>/`. Rules are in `css/CONVENTIONS.md`: one component per partial, ≤ 400
lines, one dark-mode and one reduced-motion block per file, colours from tokens. Moving CSS
is checked by comparing, for every (selector, property), the ordered declarations across
every media context before and after.

**Security.** The admin password is checked only on the server, in constant time. The
session token's algorithm is fixed in code, and the cookie is `httpOnly` + `SameSite=Strict`
(+ `Secure` in production). Login and order lookup are rate-limited, and every query is
parameterised. In production the server refuses to start without `SESSION_SECRET` or with
an admin password under 12 characters. Secrets come only from the environment: `.env` is
gitignored, `.env.example` holds placeholders, and `unit-repo-hygiene` fails if `.env` or
any of its secret values appears in a tracked file.

**Accessibility.** The storefront targets IS 5568 / WCAG 2.1 AA. `npm run a11y` audits
12 pages at desktop, mobile and dark mode with axe-core plus heading, language and zoom
checks, and must report zero findings. The statement is at `/accessibility`.

## Tests

`npm test` starts its own server on port 3100 against the real database, runs 15 suites
(646 checks), and cleans up what it created:

- **unit-*** (no network or database): repo hygiene, config startup rules, order service,
  product visibility, review moderation, money, originals.
- **smoke-fresh-db**: creates an empty database, runs every migration and the catalogue
  import, and compares the schema column by column with the real one.
- **smoke-static, -orders, -products, -settings, -reviews, -pigments, -auth**: the HTTP
  contract of every endpoint, including server-side totals, guarded routes, cache and
  security headers, and SPA-fallback boundaries.

`npm run test:client` runs 67 Jest tests in 9 suites (services, cart, pricing, drawer focus,
category filters, product-page races, the admin products tab). `npm run a11y` is the
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
