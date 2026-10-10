Commit: af37de197344f74848e85353da897b2acc5bd218

# Codebase Map

A learning aid for the codebase. The full architecture reference is [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md); this map does not replace it.

## Architecture overview

### Folders
- `server/` — the Express API: `routes/`, `controllers/`, `services/`, `models/`, `validators/`, `middleware/`, `config/`, `db/` (migrations), `utils/`.
- `client/` — the React storefront and admin; code in `client/src/js/` (`pages/`, `features/`, `components/`, `hooks/`, `services/`, `routes/`, `context/`, `utils/`), styles in `client/src/css/`.
- `scripts/` — npm scripts: catalogue import, demo data, the product-photo pipeline, the accessibility audit.
- `test/` — the server suites, run by `test/run-all.js`.
- `docs/` — the existing project docs; `.doc/` — the project definition, glossary, architecture notes, and audit files.

### Layers
- Server: route → controller → service → model → database.
  - Routes attach middleware and a controller per endpoint (`server/routes/order.routes.js:29-39`).
  - Controllers parse the request with a validator and call one service; they never touch a model (`server/controllers/order.controller.js:2-3`, `:29-31`).
  - Services hold the business rules and call models, the email service, and the realtime broadcast (`server/services/order.service.js:8-17`).
  - Models run SQL through `query` from `server/config/db.js` (`server/models/order.model.js:5`).
  - The realtime service is infrastructure only; services decide what to broadcast (`server/services/realtime.service.js:4-8`).
  - Every error reaches the central handler (`server/app.js:95`).
- Client: page or feature → hook → service → `services/http.js` → `fetch`.
  - Example: the checkout hook calls `createOrder` (`client/src/js/hooks/useCheckoutForm.js:18`), which calls `postJson` (`client/src/js/services/orderService.js:24-25`), which calls `fetch` (`client/src/js/services/http.js:86-87`).
  - The admin screen does not use these services; it calls its own `api()` wrapper (`client/src/js/services/orderService.js:9`, `client/src/js/hooks/useAdminOrders.js:58`).

### Frontend to backend
- Server entry point: `server/server.js` — connects to the database, runs migrations, listens, and attaches WebSocket (`server/server.js:13-23`).
- One origin serves both: the API under `/api` (`server/app.js:89`) and the React build with a fallback to `index.html` (`server/app.js:92`, `:30-55`).
- Client entry point: `client/src/js/App.js` — the store routes (`client/src/js/App.js:69-84`) and the lazy-loaded admin (`client/src/js/App.js:32`).
- In development the React dev server proxies API calls to port 3000 (`client/package.json:3`), but not the WebSocket (`client/src/js/hooks/useWebSocket.js:12-14`).
- Live updates: WebSocket at `/ws` on the same HTTP server (`server/services/realtime.service.js:17`, `:27`).

### Database
- One PostgreSQL pool (`server/config/db.js:15-24`); `query` runs a single statement (`server/config/db.js:29-37`), `withTransaction` wraps BEGIN/COMMIT/ROLLBACK (`server/config/db.js:40-53`).
- Each model imports `query` and owns its table's SQL (`server/models/order.model.js:5`, `server/models/product.model.js:5`, `server/models/review.model.js:5`).
- The schema comes from 12 SQL migrations, `server/db/migrations/000_products_base.sql` to `011_orders_picked_items.sql`, applied once each and recorded in `schema_migrations` (`server/db/migrate.js:12-39`). They run on every server start (`server/server.js:16`) and before the tests (`test/run-all.js:42`).

## Feature walkthroughs

### W04 — Browse a category: from opening a category page until the filtered, sorted product list
1. The route `category/:slug` renders the category page. `client/src/js/App.js:71`
2. The slug is matched to a category from the client's own list; an unknown slug shows the 404 page. `client/src/js/pages/CategoryPage.js:41`, `:99`
3. The page asks for all products of the category, with no limit. `client/src/js/pages/CategoryPage.js:64`
4. `getProducts` builds `/api/products?category=…`. `client/src/js/services/productService.js:41-48`
5. The server sends `/api/products` to the product routes. `server/app.js:89`, `server/routes/index.js:20`
6. `GET /` runs `markAdmin`, which marks whether the caller is an admin, and calls the controller. `server/routes/product.routes.js:16`, `server/middleware/requireAdmin.js:29-35`
7. The controller parses the query and calls the service. `server/controllers/product.controller.js:14-17`
8. The service shows customers visible products only (`active = true`). `server/services/product.service.js:46-48`
9. The model filters by category and selects. `server/models/product.model.js:42`, `:59`
10. Back in the page: filter by `?sub=` and by the search box, sort, and render the list. `client/src/js/pages/CategoryPage.js:111-113`, `:123-131`, `:164-165`

### W01 — Place an order: from submitting the checkout form until the order is saved and both emails are logged
1. The submit button checks the form and calls `handlePlaceOrder`. `client/src/js/features/cart/CheckoutFormView.js:228-237`
2. Name and phone are required, and an address for delivery; the body carries the items, their prices, and the totals. `client/src/js/hooks/useCheckoutForm.js:60-80`
3. `POST /api/orders`. `client/src/js/services/orderService.js:24-25`, `client/src/js/services/http.js:86-87`
4. The route is open to customers; the controller parses the body. `server/routes/order.routes.js:29`, `server/controllers/order.controller.js:29-31`
5. The validator requires a name, and for delivery an address in the delivery area; the email is optional; the status starts as `new`. `server/validators/order.validator.js:236-253`
6. The service prices the order from the catalogue: prices and names come from the database, a hidden or unknown product is a 400, a changed price is a 409, and the delivery fee is added for delivery. `server/services/order.service.js:68`, `server/services/pricing.service.js:89-145`
7. The model inserts the order and returns it. `server/models/order.model.js:97-108`
8. The service broadcasts `order:created` (see W02). `server/services/order.service.js:70`
9. Two emails are sent in parallel: to the store and to the customer. `server/services/order.service.js:72-75`, `server/services/email/index.js:12-27`
10. Sending: with no recipient it returns without a log line; with `MAIL_ENABLED=false` it logs the subject and the recipient, not the body. `server/services/email/transporter.js:23`, `:25-27`
11. The response is 201 with the order and whether each email was sent. `server/services/order.service.js:77`, `server/controllers/order.controller.js:31`
12. The client shows the thank-you screen and empties the cart; on a rejection it keeps the cart, and a 409 updates the prices. `client/src/js/hooks/useCheckoutForm.js:108-113`, `:88-105`

### W02 — A new order reaches the admin: from saving the order until it appears in the feed with the chime
1. On start, the server attaches WebSocket to the same HTTP server. `server/server.js:23`
2. An upgrade is accepted only on `/ws` and only with a valid admin cookie. `server/services/realtime.service.js:37-50`
3. Each accepted connection joins the client list. `server/services/realtime.service.js:57-61`
4. Creating an order broadcasts `order:created` to every open connection. `server/services/order.service.js:70`, `server/services/realtime.service.js:68-82`
5. The admin screen composes the chime and hands it to the orders hook. `client/src/js/pages/admin/Admin.js:71`, `:76`
6. The orders hook listens for `order:created`. `client/src/js/hooks/useAdminOrders.js:83-88`
7. The WebSocket hook connects same-origin, dispatches by message type, and reconnects after 3 seconds. `client/src/js/hooks/useWebSocket.js:26-29`, `:43-56`, `:61-64`
8. The announcement: confetti, then the chime if sound is on. `client/src/js/hooks/useAdminOrders.js:41-44`, `client/src/js/hooks/useNewOrderChime.js:81-99`
9. The list reloads from `GET /api/orders`, which requires an admin. `client/src/js/hooks/useAdminOrders.js:55-72`, `server/routes/order.routes.js:33`
10. Fallback: a poll every 2 minutes, in case the WebSocket is down. `client/src/js/hooks/useAdminOrders.js:20`, `:91-94`

### W03 — Change an order's status: from the admin's click until the email to the customer
1. The next-step button or the status select calls `onStatusChange`. `client/src/js/pages/admin/OrderCard.js:115`, `:163`
2. `PUT /api/orders/:id/status`. `client/src/js/hooks/useAdminOrders.js:100-102`
3. The route requires an admin; the controller parses the status. `server/routes/order.routes.js:38`, `server/controllers/order.controller.js:41-43`, `server/validators/order.validator.js:300-303`
4. The order must exist (404), and the status must fit the delivery method (400). `server/services/order.service.js:116-117`, `server/validators/order.validator.js:102-107`
5. The model updates the order, and the change is logged. `server/services/order.service.js:119`, `:121`
6. The same status again sends no email; a changed status sends the status email. `server/services/order.service.js:123-125`
7. Only four statuses have an email: processing, ready for pickup, shipped, completed. `server/services/email/templates/orderStatus.js:8-34`, `server/services/email/index.js:30-38`
8. The response carries `email_sent`; the admin screen reloads the list. `server/services/order.service.js:127`, `client/src/js/hooks/useAdminOrders.js:108`

### W07 — Admin login: from entering the password until a session cookie opens the admin routes
1. `/admin/:tab` first asks `/api/auth/me` whether a session is valid. `client/src/js/App.js:89`, `client/src/js/routes/AdminRoute.js:27-31`, `client/src/js/services/authService.js:29-35`
2. With no session, the login screen is shown. `client/src/js/routes/AdminRoute.js:48`
3. The form sends the password to `POST /api/auth/login`. `client/src/js/pages/AdminLogin.js:24-31`, `client/src/js/services/authService.js:24-25`
4. The route limits login attempts per window. `server/routes/auth.routes.js:12-16`, `:24`
5. The password is compared in constant time; a wrong one is a 401. `server/controllers/auth.controller.js:14-16`, `server/services/auth.service.js:73-80`
6. On success: the attempt counter resets, and an HMAC-signed token is set as an httpOnly, SameSite=strict cookie. `server/controllers/auth.controller.js:18-21`, `server/services/auth.service.js:27-36`, `:83-91`
7. The client switches to the admin screen. `client/src/js/pages/AdminLogin.js:31`, `client/src/js/routes/AdminRoute.js:50-57`
8. Every admin route checks the cookie's signature and expiry, and answers 401 without it. `server/middleware/requireAdmin.js:10-19`, `server/services/auth.service.js:39-70`

### W06 — A customer review: from submitting the form, through approval, until it is published
1. The product page's review form submits with the product's id. `client/src/js/features/catalog/product-page/ProductReviewsSection.js:61-64`, `:102`
2. The submit hook blocks a double submit and sends `POST /api/reviews`. `client/src/js/hooks/useReviewSubmit.js:23-36`, `client/src/js/services/reviewService.js:54-55`
3. The route is open; the controller parses the body and creates the review. `server/routes/review.routes.js:14`, `server/controllers/review.controller.js:33-35`
4. The service always saves a new review as not approved. `server/services/review.service.js:46-48`, `server/models/review.model.js:87`
5. The public list shows approved reviews only, whatever the request asks. `server/services/review.service.js:31-33`, `server/models/review.model.js:28-30`
6. The admin loads all reviews from a route that requires an admin. `client/src/js/hooks/useAdminReviews.js:18`, `server/routes/review.routes.js:16`
7. "Approve" sends `PUT /api/reviews/:id/approve` with `approved: true`. `client/src/js/pages/admin/ReviewsTab.js:35`, `client/src/js/hooks/useAdminReviews.js:24-26`
8. The route requires an admin; the service sets `approved`. `server/routes/review.routes.js:21`, `server/controllers/review.controller.js:45-48`, `server/services/review.service.js:58-60`
9. The product page now receives it in the public list. `client/src/js/features/catalog/product-page/ProductDetails.js:144`

## Not covered yet
- W05 — Add or edit a product with images (S12).
- W08 — The pick list (S15).
- W09 — The paint calculator (S8).
- Not proposed: the CSV import (S13), the project calculator (S9), the wishlist (S4).
