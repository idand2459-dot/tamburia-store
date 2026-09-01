# Technik Tambour — Online Store

A full e-commerce application for a hardware and building-supplies store in Petah Tikva:
a catalog of over 400 products, a shopping cart, orders with email notifications, moderated
customer reviews, and two domain-specific calculators — a paint calculator with pigment
shade simulation, and a project calculator that turns a type of job into a shopping list.

Behind it sits a protected admin panel where the owner manages the catalog, orders and reviews.

The storefront is in Hebrew and right-to-left.

---

## Features

**Storefront**
- Catalog by category and subcategory, with search, sorting and stock status
- Product pages with an image gallery, variants (sizes and prices), colors and reviews
- Cart persisted locally, pickup or delivery with a delivery-area check
- Wishlist, order lookup by phone number, and reviews for both the store and individual products

**Paint calculator**
- Computes surface area from walls, windows and doors, across any number of coats
- 20 pigment shades with a live preview at three depth levels
- Adds every product the job needs to the cart in one click

**Admin panel**
- Product management, including image upload and CSV import
- Order tracking with status changes that email the customer automatically
- Review moderation — nothing is published before approval
- Statistics and order export

**Email**
- New-order notification to the store
- Order confirmation to the customer
- An update on every status change

---

## Tech stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express 5 |
| Database | PostgreSQL (via `pg`, no ORM) |
| Client | React 19 (Create React App) |
| Email | Nodemailer |
| File uploads | Multer |
| Authentication | Signed HMAC tokens in an httpOnly cookie |

No ORM and no third-party auth library — the data access layer and the authentication
were written directly, so the flow stays explicit and readable.

---

## Project structure

```
server/
  config/        environment loading and validation, single database pool
  db/            SQL migrations and the runner
  models/        all SQL lives here, explicit columns, never SELECT *
  controllers/   no SQL, no try/catch — errors bubble to one handler
  validators/    every request body and query parameter is checked and bounded
  routes/        one router per domain, marking what is public and what is guarded
  services/      admin authentication and email
  middleware/    error handling, uploads, security headers, rate limiting

client/          React application
test/            end-to-end test suites
scripts/         CSV product import tool
legacy/          archived first prototype, not served
```

The server serves both the API and the React application from the same origin,
so production runs a single process.

---

## Getting started

**Requirements:** Node.js 18+, PostgreSQL with a database named `tamburia`.

```bash
git clone https://github.com/idand2459-dot/tamburia-store.git
cd tamburia-store

npm install
npm install --prefix client

cp .env.example .env      # fill in the values
npm run build:client
npm start
```

The site comes up at **http://localhost:3000**, and the admin panel at **/admin**.
Migrations run automatically on startup, before the port opens.

### Commands

| Command | What it does |
|---|---|
| `npm start` | Runs the server on port 3000 |
| `npm test` | Runs every test suite |
| `npm run build:client` | Builds the React application |
| `npm run dev:client` | React dev server with hot reload |
| `npm run migrate` | Runs migrations without starting the server |

For client development, run both processes and give React a different port:

```bash
npm start                                    # server, port 3000
$env:PORT=3001; npm start --prefix client    # React, port 3001
```

> **Note:** `client/build` is not committed. After any change under `client/src`,
> run `npm run build:client` or the browser will keep serving the previous version.

---

## Environment variables

The full list lives in [`.env.example`](.env.example). The main ones:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_PASSWORD` | — | **Required.** PostgreSQL password |
| `MAIL_USER` / `MAIL_PASS` | — | **Required.** Gmail account used to send mail |
| `MAIL_ENABLED` | `true` | `false` logs emails instead of sending them |
| `ADMIN_PASSWORD` | — | **Required.** Admin panel password |
| `SESSION_SECRET` | — | Token signing secret. Required in production |
| `DELIVERY_FEE` | `20` | Delivery fee, in shekels |
| `CSP_ENABLED` | `false` | Content Security Policy — see the note below |

---

## API

Everything is under `/api`. Routes marked 🔒 require an admin session.

| Domain | Routes |
|---|---|
| **Auth** | `POST /auth/login` · `POST /auth/logout` · 🔒 `GET /auth/me` |
| **Products** | `GET /products` · `GET /products/:id` · `GET /products/categories` · 🔒 `POST` `PUT /:id` `DELETE /:id` |
| **Orders** | `POST /orders` · `GET /orders/by-phone/:phone` · 🔒 `GET /orders` `GET /:id` `GET /stats` `PUT /:id` `PUT /:id/status` `DELETE /:id` |
| **Reviews** | `GET /reviews` · `GET /reviews/stats` · `POST /reviews` · 🔒 `GET /reviews/all` `GET /:id` `PUT /:id` `PUT /:id/approve` `DELETE /:id` |
| **Pigment formulas** | `GET /pigment-formulas` · `GET /pigment-formulas/:id` · `GET /pigment-formulas/code/:code` · 🔒 `POST` `PUT /:id` `DELETE /:id` |
| **Uploads** | 🔒 `POST /upload` · 🔒 `POST /upload-multiple` |
| **Health** | `GET /health` |

List endpoints accept `limit`, `offset`, `sort`, `order` and per-domain filters.
Without `limit` or `offset` they return a flat array.

---

## Security

- **The admin password is only ever checked on the server**, using a constant-time
  comparison. The session token is delivered in an `httpOnly`, `SameSite=Strict`
  cookie, so page JavaScript cannot read it.
- **Login is rate limited** — 10 attempts per 15 minutes per address.
- **Order totals are computed server-side** from the line items and ignored from the
  request body, so a crafted request cannot set its own price.
- **Reviews are always stored unapproved**, and the public endpoint cannot be
  persuaded to return anything else.
- **Every input is validated** before it reaches the database, and every query is
  parameterised.
- **Uploads are restricted** to allowed image types and a maximum size, and stored
  under a randomised filename.
- **User-supplied values in emails are escaped**.
- `nosniff`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` on every
  response. CORS is closed in production to explicitly configured origins.

A Content Security Policy is written and ready but off by default: the built
`index.html` contains an `application/ld+json` block for structured data, which
browsers block under `script-src 'self'`. The impact is limited to SEO.
Enable it with `CSP_ENABLED=true`.

---

## Tests

```bash
npm test
```

224 checks across five suites. They start their own server on port 3100, so they can
run while the real one is serving. They talk to the real database, create temporary
records and remove them afterwards. The pigment suite explicitly asserts that the
existing data was left untouched.

| Suite | Covers |
|---|---|
| `smoke-static` | Client serving, caching, security headers, and that no internal file is exposed |
| `smoke-orders` | The order lifecycle, including server-side total calculation |
| `smoke-reviews` | Moderation and the split between the public and admin listings |
| `smoke-pigments` | The shades and the ascending-pigment rule |
| `smoke-auth` | Login, route protection and rate limiting |
