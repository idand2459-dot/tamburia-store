<!-- Template: fill in during adaptation. Keep every section heading; replace each {{...}} line. -->
# Glossary

The naming rule ([naming.md](../.claude/rules/naming.md)) requires every shared term to be defined here before it is used in code, docs, or plans.

## Purpose
- Define canonical domain terms and approved short forms used across code, docs, and plans.

## Core Terms
{{CORE_TERMS}} — the project's own terms, one bullet each, in the format `term — definition. Not synonym1, synonym2.` Not given yet: they are proposed and confirmed in Phase B (see Open Questions in [product-definition.md](product-definition.md)).

- order — a customer's request for products, with pickup or delivery; the database table `orders` (`server/api/order/order.service.js:65-78`). UI label: "הזמנות" (`client/src/js/pages/admin/adminConstants.js:66`). Not purchase, sale, or cart.
- request id — the version-4 UUID the storefront creates once for an order attempt and sends with it (`request_id`); the server creates at most one order per request id, and sending the same order again returns the original (`server/api/order/order.service.js`, `orders.request_id`, migration 012). Not idempotency key, order number (the order number is the database `id`).
- unresolved order — an order that was sent whose outcome the customer has not seen confirmed (a timeout, a network failure or a server error); kept with its request id in localStorage until it is confirmed, refused or cancelled, or for 48 hours after its first submission, whichever comes first (`client/src/js/hooks/useCheckoutForm.js`). UI label: "הזמנה שלא אושרה". Not pending order, draft.
- expired unresolved order — an unresolved order 48 hours after its first submission: the customer's details are removed from the device and only the request id, the send time, the item count and the total stay. It cannot be sent again and does not mean the order failed; the customer is told to ask the store (`client/src/js/store/persistence.js`). Not failed order.
- rate limit — the most requests one client address may send to a route in a window of time; over it the answer is a `429` with `Retry-After`. Every request counts, a retry of the same order included, and the counters live in the memory of the Node process. Set for login, order creation and review creation (`server/middleware/rateLimit.js`, `server/config/env.js`; [docs/security.md](../docs/security.md)). Not throttle, quota.
- delivery method — how the customer receives the order: `pickup` (self pickup) or `delivery` (`server/api/order/order.validator.js:22`). UI labels: "איסוף עצמי" and "משלוח" (`client/src/js/features/cart/DeliveryOptions.js:20`, `:28`). Not shipping method.
- order status — one of `new`, `processing`, `ready_for_pickup` (pickup only), `shipped` (delivery only), `completed` (`server/api/order/order.validator.js:20`, `:31-34`). UI labels: "חדשה", "בטיפול", "מוכנה לאיסוף", "נשלחה", "הושלמה" (`client/src/js/pages/admin/adminConstants.js:35-39`). Not state or stage.
- delivery area — the cities where delivery is allowed; an address outside them is rejected (`server/api/order/order.validator.js:84`). UI label: "אזור המשלוח" (`client/src/js/features/cart/CheckoutFormView.js:198`).
- pick list — the order's lines that the admin ticks off as they are prepared (`picked_items`); ticking does not change the status (`server/api/order/order.service.js:130-137`). UI label: "רשימת ליקוט", as the list's accessible name (`client/src/js/pages/admin/PickList.js:112`). Not checklist.
- hidden product — a product with `active = false`: still in the database, but not in the store for customers (`server/api/product/product.service.js:5-8`). UI label: "מוסתר מהחנות" (`client/src/js/pages/admin/AdminProductCard.js:197`). Not deleted or archived.
- variant — a version of a product with its own label and price (`product.variants`); the chosen one sets the price (`server/api/order/pricing.service.js:62-74`). UI label: "גרסאות" (`client/src/js/components/ProductCard.js:132`). Not option or model.
- review — a customer's rating and text about the store or a product; saved as not approved until the admin approves it (`server/api/review/review.service.js:45-48`). UI labels: "ביקורת" (`client/src/js/features/catalog/ReviewsCarousel.js:151`) and "ביקורות" (`client/src/js/pages/admin/adminConstants.js:71`). Not comment or feedback.
- repository — the file of one domain that holds its SQL: plain functions over `pg`, parameterised queries, no business rules (`server/api/<domain>/<domain>.repository.js`, for example `server/api/order/order.repository.js`). Replaces the former *model* files (`models/*.model.js`). Not model, DAO, ORM.
- store — the single classic Redux object that holds the storefront's shared state (`cart`, `wishlist`, `availability`); built in `client/src/js/store/index.js` (phase P4R). Not context, global state.
- action — a plain object with a `type` constant and a payload that describes one thing that happened (for example `CART_ITEM_ADDED`); the only way to change the store. Not event, command.
- reducer — a pure function `(state, action) => state` that returns the next state for one domain and the same reference when nothing changes; one file per domain. Not handler.
- selector — a pure function `(state) => value` that reads or derives a value from the store (for example `selectCartCount`); components read the store only through selectors. Not getter.
- thunk — an action creator that returns a function, run by `redux-thunk`, for the one flow with a side effect, `checkAvailability` (a server request). The wishlist toggle is a plain action: the reducer changes the list and `store/persistence.js` copies it to localStorage. Not async action, saga.
- availability — which products saved in the customer's cart are no longer in the catalog (`unavailableIds`); fetched from the server by id (`client/src/js/hooks/useAvailability.js`, moved to the store in P4R). Not stock, in-stock status.
- demo mode — the portfolio demonstration: `DEMO_MODE=true`, a public site with fictional data only, a read-only public admin and a banner; not a commercial launch (`server/config/env.js`, `server/api/demo/`, [docs/demo-deployment.md](../docs/demo-deployment.md)). Not sandbox, trial.
- demo database — a PostgreSQL database that carries the demo marker and holds only fictional data; the only database a demo server starts on. Not test database (the separate local database of `npm test`).
- demo marker — the one-row table `demo_database_marker` (a random id and a state, `bootstrapping` or `ready`) that identifies a demo database; created only by the bootstrap, never by a migration or the server (`scripts/demo-bootstrap.js`). Not flag, stamp.
- bootstrap — the owner-run first-time setup of a new empty database as a demo database: identity checks, claim, migrations, seed (`npm run demo:bootstrap`). Not install, deploy.
- demo identity — one of the three fixed fictional customers (name, phone, email, address) a demo order may carry (`server/api/demo/demo.rules.js`). UI label: "מילוי פרטי הדגמה". Not test customer.
- owner — the admin role with full access, entered with the admin password (`role: owner` in the session token). Not administrator, manager.
- viewer — the public read-only demo admin role, entered without a password in demo mode only (`role: viewer`, `POST /api/auth/demo-login`). UI label: "כניסה כצופה (הדגמה)". Not guest, visitor.
- visitor order — an order placed by someone using the demo: it carries a demo identity phone and is not a seeded order; kept at most 72 hours and at most 100 at a time (`server/api/demo/demo.service.js`). Not test order.
- seeded order — a curated demo order written by the seed, tagged `request_id = demo-seed:NN`, never deleted by cleanup (`scripts/lib/demoSeed.js`). Not sample order.

## Naming Alignment
- Keep this glossary aligned with naming decisions in [naming.md](../.claude/rules/naming.md).
- If a new domain term is introduced, add it here before broad usage.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
