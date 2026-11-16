# 004 — P8.2 Customer data and order access security

Status: done
Owner: Idan
Last updated: 2026-11-14

Read-only audit and plan; no application code was changed, and nothing was staged or committed while writing it. It builds on `002-2026-11-14-p8-1-backend-hardening.md` and `003-2026-11-14-admin-order-polling.md`, and closes the backlog items "public order lookup", "personal data in logs" and the checkout `localStorage` item (`.plan/000-backlog.md:33`, `:36`, `:37`; `docs/security.md` "Customer data").

## Approval and changes to this plan (2026-11-14)
The owner approved the plan with these decisions, which override the text below where they differ:
1. The public order lookup is removed completely (backend, frontend, links, CSS, dead code). Done in part A.
2. The admin filter `GET /api/orders?phone=` stays.
3. `/orders/lookup` shows the normal 404 page.
4. Public order creation and all checkout and idempotency behaviour stay.
5. Pending-attempt personal data expires 48 hours after the **original** submission; a retry never extends it.
6. **The `POST /api/orders` success and replay response is not changed in P8.2.** Finding 2's trimmed response, Step E and Q5 are dropped; the optional improvement is a backlog item.
7. Admin polling stays as it is.
8. Checkout texts that pointed to "ההזמנות שלי" now tell the customer to contact the store. Done in part A (`CheckoutFormView.js`).
Stricter log rule: **no raw error object, unsafe exception message or stack trace is logged** (this replaces "stack frames without the message line" in finding 3). Only category, operation, status, request id and the PostgreSQL error code are kept.
Branch: `fix/customer-data-security`, created from the committed HEAD `0ed6779` (nothing merged or rebased).
Work is delivered in three reviewable parts, each followed by a review stop: **A** lookup removal (backend and frontend together), **B** log sanitising with privacy tests, **C** 48-hour retention. The full backend suite, the frontend suite and the production build run after C.

**Progress**
- Part A: implemented; `npm test` (all 25 server suites), `npm run test:client` (42 suites, 762 tests) and `npm run build:client` pass. Approved by the owner.
- Part B: implemented; `npm test` (all 25 server suites) passes, including `unit-error-handler` (114) and `unit-email-delivery` (37). Approved by the owner.
- Part C: implemented. The 48-hour clock starts at the first submission and a resend stores the same `submittedAt`; at 48 hours the personal details are removed and an expired record (`requestId`, `submittedAt`, `expired`, `itemCount`, `total`) stays, which cannot be sent again and tells the customer to contact the store. Checked on load, before every send, and by one timer for the due time. Records that cannot be dated are expired; unreadable ones are removed. Full suites: `npm test` (25 server suites), `npm run test:client` (42 suites, 810 tests) and `npm run build:client` pass. Approved by the owner.
- Email `reason` review: `reason` is read by no production code (only tests). Applied in the final cleanup.

## Final review and cleanup (2026-11-14)
Done after parts A, B and C were approved. The owner approved the implementation and this review, so the plan is `done`; the commits are made by the owner by hand (four commits: lookup removal, logging, 48-hour retention, documentation and plan).

**Changes in the cleanup**
1. Email `reason`: the two raw `err.message` return values are now fixed words, `delivery_failed` (`transporter.js`, a failed send) and `build_failed` (`email/index.js`, a template that threw). The `{ sent, reason }` shape and every other reason (`timeout`, `MAIL_ENABLED=false`, the no-recipient and no-template texts) are unchanged. Consumers searched in `server/`, `client/src/js/`, `scripts/` and `test/`: production code reads only `.sent`; `order.service.js` builds its own reason text for an unchanged status; the client receives `email_sent` and `emails` as booleans and never a reason. Only `unit-email-delivery.js` compared against the message, and its four checks were updated.
2. `orderRepository.digitsOnly` was exported only for the removed lookup; it is no longer exported (the admin `phone` filter still uses it inside the file), and the matching stub was removed from `unit-order-service.js`.
3. Seven regression tests for storage failures were added to `useCheckoutForm.test.js` (see below). No production code needed to change.

**Checkout storage failure review (no defect found)**
The hook reads and writes the attempt through `persistence.js`, whose `write` reads the value back, so a throwing, full or silently dropping `localStorage` is reported as `persisted: false`, never as success. The request still goes out, and the attempt (the same `requestId`, the same body, the same `submittedAt`) lives in `pendingRef` and in state, so:
- a resend in the same page sends the exact same body and `request_id`; a new order is refused while it is open (`pendingRef`), even though storage is empty; nothing is sent by itself, however long the page waits;
- if storage works again, the resend stores the very same attempt;
- the "not saved on this device, a reload will lose it" warning appears in the error text after an unknown outcome and in the notice for every kept attempt (429 and 422 included); the notice hides it for an expired record;
- after 48 hours the in-memory record is also reduced (no body) and cannot be sent.
What cannot be fixed without a redesign, and is left as it is: if the write failed and the customer reloads or closes the tab anyway, nothing is left to recover from, the cart may still be there, and a new order gets a new `request_id`, so a duplicate is possible if the first one was in fact received. The warning is the mitigation; there is no `beforeunload` prompt.

**Integration review (the diffs were read, not only the test results)**
- Public lookup: no `by-phone`, `findByPhone`, `findOrdersByPhone`, `getOrdersByPhone`, `OrderHistory`, `order-history` or `orders/lookup` remains outside the tests that assert their absence, this plan, the backlog history, and old audit documents. `GET /api/orders/by-phone/<x>/...` answers 404; `GET /api/orders/by-phone` matches only `/:id` (401 without a session, 400 with one).
- Admin: `useAdminOrders`, the admin pages, `auth` and `requireAdmin` are not in the diff; every order route is `requireAdmin`; `GET /api/orders?phone=` still filters; the polling tests pass unchanged.
- Checkout: `createOrder`, the controller's `create`, the validator and the repository's insert are untouched; the created answer and the replay answer have the same keys as before (`smoke-contract`, `smoke-orders`).
- Logs: a 5xx is one line of method, route template, status, category, code and an order's request id; mail logs carry a fixed label and the outcome; no `console.*` call left in `server/` takes a request body, parameter, query, URL, error object or error message from a request path. Still logged and not customer data: start-up and migration messages, the connection pool's error message, image file names, the first line of each SQL statement when `DB_LOG_QUERIES` is on.
- Expired attempts: the raw stored text contains none of the name, phone, email, address, notes or item names (tests on the storage text, for every route into the expired state).
- Unused code: the client build has no warnings; no unused import in the changed files; the removed drawer's CSS and its two `app.css` imports are gone; `getJson`, `lineTotal`, `Drawer`, `STATUS_CONFIG` are still used elsewhere.

**Test results**
- `npm test`: 25 server suites pass (`unit-error-handler` 114, `unit-email-delivery` 37, `unit-order-service` 77, `smoke-orders` 292, `smoke-contract` 264, `smoke-auth` 46).
- `npm run test:client`: 42 suites, 816 tests pass.
- `npm run build:client`: compiled successfully.
- `git diff --check`: no whitespace errors (git prints only its usual LF-to-CRLF notices).
- **Intermittent test, cause not established:** `useAvailability.test.js` ("different ids ask again, abort the earlier request, and replace the result") failed once in a full client run and once in three runs of that file alone, and passed in the other runs. Neither the test nor `useAvailability.js` is part of this change (no diff). It is recorded in the backlog; whether it depends on timing, on test order or on something else has not been investigated.

**Remaining concerns (not production-readiness claims)**
- Up to 48 hours of customer details can sit in `localStorage` after an order whose outcome was unknown; on a shared device they are readable in that time.
- After a failed write plus a reload, a duplicate order is possible (above).
- After 48 hours the customer must phone the store; cancelling and ordering again can duplicate an order that was received. The warning is shown.
- The device clock decides the 48 hours; a clock moved back more than 10 minutes expires the attempt at once, and a clock moved forward shortens it.
- Rate-limit counters are still in the memory of one process; the logs hold no stack traces, so a failure that needs one has to be reproduced; log retention is the host's decision; the store is not deployed and the deployment checklist in `docs/security.md` is untouched.
- `POST /api/orders` still returns the whole order except `picked_items` (owner decision; backlog item).

**Revision 2 (owner decision):** the public order lookup is **removed completely**. No replacement is planned: no lookup by phone, order number, token or any other public verification. The earlier "order number + phone" design is dropped.

## Goal
Remove the one public path that returns customer personal data (`GET /api/orders/by-phone/:phone`) together with its UI, keep personal data out of server logs and URLs, make the checkout confirmation return only what the confirmation screen shows, and bound how long a pending checkout attempt keeps a customer's details on a device, without changing checkout, inventory checks, `request_id` idempotency, or the admin's order management and polling.

## Scope
In scope:
- Deleting the public lookup: server route, controller, service and repository code that only it uses, the "ההזמנות שלי" drawer, its navigation links, route, CSS, tests, and the docs that describe it.
- Pointing the checkout's "unresolved order" texts away from the removed drawer.
- Log redaction in the error handler and the mail sender.
- The 48-hour retention of the pending checkout attempt.
- Trimming the `POST /api/orders` response to the confirmation fields.
- Tests for all of the above, and the docs and backlog updates.

Out of scope (stay in the backlog): SMS or email verification, a replacement way for customers to check an order (customers phone the store; the confirmation email and screen already carry the order number), admin token revocation, CSP, upload hardening, database TLS, a durable email outbox, a shared rate-limit store, privacy-policy pages, a data-retention job for the `orders` table.

## Assumptions
- One server instance, no real customer data today (portfolio app).
- The admin never used the public lookup: the admin screens use `GET /api/orders` with `search`, `status`, paging and dates, not `?phone=` (searched `client/src/js`; only the removed drawer called `by-phone`).
- Admin polling (`useAdminOrders`, plan 003) reads `GET /api/orders` and is untouched.
- Work is planned from the **current committed state**: branch `feat/admin-order-polling`, HEAD `0ed6779`, 36 commits ahead of `main`. The polling work is not assumed merged. The working tree has only two untracked files: `ARCHITECTURE_AUDIT.md` (never touched by this plan) and this plan.
- Hebrew text a customer sees is product content and stays Hebrew; code, comments, commit messages and docs added by this work are English (`AGENTS.md`).

## Findings

### 1. Why the lookup goes, and everything that depends on it
`GET /api/orders/by-phone/:phone` is open (only a 20-per-15-minutes limiter) and returns, for every order under a phone number, the name, phone, email, delivery address, notes, items and totals. One known number reads a person's identity and address; the limiter slows scanning but does not protect a known number; and the phone filter (`REGEXP_REPLACE`, no index) forces a table scan per request. Severity: High if real customers' data is stored, Low today. With the owner's decision the exposure is closed by deletion.

**Dependency inventory** (from searching `server/`, `client/src/`, `test/`, `scripts/`, `docs/`, `.doc/`, `README.md` for `by-phone`, `byPhone`, `findByPhone`, `findOrdersByPhone`, `getOrdersByPhone`, `OrderHistory`, `order-history`, `orders/lookup`, `onOrderLookup`, "ההזמנות שלי"):

| Piece | Location | Used by anything else? | Action |
|---|---|---|---|
| Route `GET /by-phone/:phone`, `byPhoneLimiter`, and its comment | `server/api/order/order.routes.js:14-28, :43` | no | **Delete**; update the file header (`:1-4`) |
| Controller `byPhone` and its export | `order.controller.js:23-26, :68` | no | **Delete** |
| Service `findOrdersByPhone` and its export | `order.service.js:44-55, :235`; mentioned in the comment at `:84` | no | **Delete**; reword the `replayOf` comment |
| Repository `findByPhone` and its export | `order.repository.js:91-94, :218` | no | **Delete** |
| `digitsOnly` and the `phone` filter in `buildFilters` | `order.repository.js:20-23, :35-38, :219`; `order.validator.js:302` (`parseListQuery`) | **yes**: the admin list accepts `GET /api/orders?phone=` | **Keep** (authenticated admin filter); no change |
| `orderService.getOrdersByPhone` and its header text | `client/src/js/services/orderService.js:2, :33-40` | only `OrderHistory` | **Delete**; fix the file header |
| Drawer component | `client/src/js/features/cart/OrderHistory.js` (194 lines, incl. its own `STATUS_CONFIG`) | only `StoreLayout.js:18, :159` | **Delete** the file |
| Overlay wiring | `StoreLayout.js:18, :41 (OVERLAY_PATHS), :81 (onOrderLookup), :86, :117, :159` | — | **Edit**: remove the import, the path, the match and its three uses (keep `useMatch` if other overlays still use it; they do) |
| SPA route | `client/src/js/App.js:90` `orders/lookup` | — | **Delete**; an old link then reaches the catch-all not-found page (Q3) |
| Navigation links | `components/Navbar.js:120 (openOrderHistory), :215-216 (drawer item), :246 (top link), :11 (ClipboardList import, if unused after)`; comments at `:244` | — | **Delete** both links and the handler |
| Navbar CSS | `css/layout/_navbar.css:339` `.navbar-link--orders` and comments at `:44, :337` | — | **Delete** the rule, fix the comments |
| Drawer CSS | `css/app.css:126, :129` (imports), `css/features/cart/_order-history.css`, `_order-history-card.css` | only `OrderHistory` | **Delete** both partials and their two imports (the cascade order of the others is unchanged); fix comments in `components/_drawer.css:6-10`, `components/_modals.css:5`, `features/admin/_admin-order-card.css:296`, `features/admin/_admin-orders.css:8` |
| Checkout texts | `features/cart/CheckoutFormView.js:245, :254` tell the customer to "check ההזמנות שלי by phone number" | — | **Rewrite** (below) |
| Accessibility statement | `pages/Accessibility.js:71` lists "ההזמנות שלי" among the dialogs | — | **Edit** the list |
| Shared pieces kept | `Drawer.js` (cart, wishlist), `formatPrice`/`lineTotal`, `PHONES`/`WHATSAPP`, `adminConstants.STATUS_CONFIG` (admin) | yes | **Keep** |
| Tests | `test/smoke-orders.js:171-175, :543-545, :709-710`; `test/smoke-contract.js:347-350, :598-603`; `test/smoke-auth.js:116`; `test/smoke-rate-limits.js:115`; `test/smoke-static.js:52`; `test/unit-order-service.js:60-75 (mock), :454-475, :512`; `test/unit-error-handler.js:103-121` (uses the path only as sample data); `client/src/js/__tests__/services/storeServices.test.js:9, :69-81`; `scripts/a11y-audit.js:75` | — | **Delete or rewrite** as in Steps |
| Docs | `README.md:59, :192, :196, :242, :278, :286, :316, :514, :549`; `docs/ARCHITECTURE.md:190, :232, :240`; `docs/security.md:19, :151-163`; `.doc/architecture.md:19, :74`; `.doc/product-definition.md:20`; `.doc/glossary.md:15`; `.doc/code-audit.md` B03; `.plan/000-backlog.md:33, :36, :37`; `docs/a11y-audit.md:18` and `docs/cleanup-audit.md:244, :257` are historical (the first is a Hebrew audit and stays untranslated) | — | **Update**; leave historical audits as they are, with one line added to `.doc/code-audit.md` B03 saying it was closed by P8.2 |

**What stays reachable after the deletion.** The Express stack has no `/by-phone` route, so `GET /api/orders/by-phone/<phone>` falls through to the `/api` not-found handler: **404** (`server/app.js:94`). One thing to know: a single-segment `GET /api/orders/by-phone` matches `/:id` and answers **401** (`requireAdmin` runs first), which exposes nothing; tests use the two-segment form. `GET /orders/lookup` on the page server keeps returning `index.html` (the SPA fallback), and the client then renders the not-found page.

### 2. Checkout stays as it is; the confirmation response is trimmed
`POST /api/orders` returns every column except `picked_items`, plus `emails` (`order.service.js:137-140` for 201, `:94-96` for a replay). The confirmation screen reads only: `id`, `customer_name`, `customer_phone`, `delivery_method`, `delivery_address`, `customer_email`, `total` (`OrderSuccessView.js:19-72, :87`). `useCheckoutForm` stores the whole answer in `orderSuccess` and uses nothing else; the client reads no `emails` field.

Proposed single function `toConfirmation(order)` used by both the 201 and the replay path (so they cannot drift):

| Keep | Why |
|---|---|
| `id` | confirmation number, WhatsApp text |
| `customer_name`, `customer_phone`, `customer_email` | shown on the confirmation; the submitter just sent them |
| `delivery_method`, `delivery_address` | shown in the "what happens next" list |
| `total` | shown |
| `emails` (`{ store, customer }`, booleans or null) | documented contract, no personal data, pinned by `smoke-contract.js:584-585` and `smoke-orders.js:694` |

Dropped from the public answer: `notes`, `items`, `subtotal`, `delivery_fee`, `status`, `created_at` (and, as today, `picked_items`, `request_id`, `request_hash`). The security value of this trim is small (the submitter receives their own data), which is why it is its own step and commit and can be dropped without affecting the others (Q5). Its cost is test churn: the pricing and rounding assertions in `smoke-orders.js` (for example `:107-114, :381-382, :420`) and `smoke-contract.js:582-587` read `subtotal`, `items` and `status` from the POST answer and must read them from the admin `GET /orders/:id` instead, through one small test helper.

Unchanged and re-verified by tests: the controller still answers `201` or `200` with `Idempotent-Replayed: true`, `422 request_id_reused` for a different body, inventory/option checks (409), pricing from the catalogue, the field-length limits and the rate limit (a 429 never touches an order).

### 3. Logs
| # | Location | What is logged | Personal data | Fix |
|---|---|---|---|---|
| L1 | `server/middleware/errorHandler.js:133` | every 5xx: `req.originalUrl` and the whole error | URL can hold personal data; a PostgreSQL error carries `detail`, `where`, and a message that repeats the offending value (the first line of `stack` too). 23xxx errors are 4xx and already logged as method + code only (`:134-138`); unmapped codes take the 5xx branch | Log `METHOD <route pattern>` (`req.baseUrl + req.route?.path`, for example `PUT /api/orders/:id`), the status, a short error category, and for a PostgreSQL error only its `code`, `routine` and the stack frames **without** the message line. Other errors are logged as now (their messages are written by this code or by Node, not by the customer). Add the request id when the request has one (order creation) |
| L2 | `server/services/email/transporter.js:56` | `"<subject>" → <to>` when mail is off | recipient; the new-order subject holds the customer's name (`templates/newOrder.js:13-15`) | log the label only |
| L3 | `transporter.js:66` | subject on a timeout | customer name | label + `timeout` |
| L4 | `transporter.js:69` | `→ <to> \| <subject>` on every successful send | recipient and name on every order | label + `sent` |
| L5 | `transporter.js:72` | `<to>: <err.message>` | recipient; SMTP messages repeat the address | label + `failed` + `err.code` / `err.responseCode` |
| L6 | `server/services/email/index.js:20` | `err.message` of a template failure | a missing-field `TypeError`, no value | unchanged |
| ok | `errorHandler.js:137`, `order.service.js:184`, `config/db.js:26, :34` | method + code; order id and statuses; pool error; first SQL line without parameters | none | unchanged |

`send()` gains a caller-chosen `label` (`order #12 store`, `order #12 customer`, `order #12 status`); the returned `{ sent, reason }` is unchanged (`reason` is not logged or sent to the client; to be confirmed against `unit-email-delivery`). Also not found anywhere in `server/`: a log of a request body, `req.params` or `req.query`. Retained and safe: error category, status, operation, request id, PostgreSQL error code. The 404 JSON echoes `METHOD URL` to the requester only and is not logged (Info, no change).

### 4. Pending checkout attempt in `localStorage`
Key `tamburia-checkout-attempt` (`client/src/js/store/persistence.js:21, :142-182`), value `{ requestId, body, submittedAt }`; `body` is the exact request: name, phone, email, delivery method and address, notes, items, totals, `request_id`. It is written in `sendAttempt` (`useCheckoutForm.js:151`) before every send. It survives reload, navigation, closing the browser, and admin logout (the storefront never reads the admin session). There is no expiry today (`persistence.js:147-150`; `useCheckoutForm.js:33`; backlog `:33`).

**Why the body must stay for a while.** The server hashes the normalized customer fields, address, notes and lines next to `request_id` (`order.service.js:64-73`); a retry must carry the same `request_id` and a body that hashes the same, otherwise `422 request_id_reused` (`:87-97`). If the first request never arrived, the body is the only copy of the order. So the body is kept **unchanged** for the whole retention period.

**Design.** `ATTEMPT_RETENTION_MS = 48 hours`, measured from the attempt's original `submittedAt` (a manual resend does not extend it: `retryPendingOrder` passes the original `submittedAt`, `useCheckoutForm.js:275`).
- Within 48 hours nothing changes: the same body and `request_id` are sent on *send again*, after a reload, after a 429, and so on.
- At 48 hours the personal data is **removed** and the record becomes `{ requestId, submittedAt, expired: true, itemCount, total }` (the same two numbers the notice already shows). That is all that stays on the device.
- The notice for an expired attempt has **no resend** (no body exists to resend, and a new body under the old `request_id` would be a 422). It says, in Hebrew, that the details were removed from this device after 48 hours, that **the order may or may not have been received**, and tells the customer to contact the store (phone and WhatsApp, as on the confirmation screen) before sending a new order. Expiry never claims the order failed.
- Nothing is sent automatically, ever. A new order still cannot be sent while the notice is open; the customer must press cancel, and the cancel confirmation keeps its duplicate warning (rewritten without the removed drawer, below). Cancelling is the only way to get a new `request_id`.
- Where it is applied: when the attempt is read on page load (`useCheckoutForm`'s initial state), and in `handlePlaceOrder` and `retryPendingOrder` before anything is sent, so an open tab cannot send a body that is 48 hours old.
- Attempts stored by the current bundle already carry `submittedAt`, so they expire too.

**Cleanup matrix** (what is in `localStorage` afterwards):

| Outcome | Today | After this plan |
|---|---|---|
| Created (201) or replayed (200) | removed (`useCheckoutForm.js:204`) | unchanged |
| Server refused with a 4xx other than 408, 422, 429 (proof that no order exists) | removed (`:188`) | unchanged |
| 408, 5xx, timeout, network failure, non-JSON | kept, no expiry | kept up to 48 h with the body; then reduced to the `expired` record |
| 429 | kept | kept up to 48 h; then reduced |
| 422 (`request_id_reused`) | kept as conflict, cancel only | unchanged during 48 h; then reduced (the conflict notice already tells the customer to contact the store) |
| Cancelled by the customer | removed (`:281`) | unchanged; an `expired` record is removed by the same cancel |
| Expired | n/a | personal data removed; the small `expired` record stays until the customer cancels it |
| Storage blocked | memory only, with the existing warning | unchanged |

Rejected alternatives: `sessionStorage` (loses the recovery when the tab closes, the very case P7.4 protects), browser-side encryption (the key sits in the same origin, so an XSS or anyone with the profile reads both), removing the body (breaks both the hash match and the never-arrived case), and a server-side copy (stores the same data elsewhere and needs a migration).

**Texts that referenced the removed drawer** (`CheckoutFormView.js:245, :254`) become: for the conflict, "מזהה ההזמנה כבר שימש בשרת להזמנה אחרת, ולכן אי אפשר לשלוח אותה שוב. צרו קשר עם החנות לפני שתבטלו" (with the phone and WhatsApp links already used in the notice's area), and in the cancel confirmation, "אם ההזמנה כבר התקבלה, שליחה חדשה תיצור הזמנה נוספת. אפשר לברר מול החנות בטלפון." Exact wording is a copy decision for the owner at review.

### 5. Response minimization summary (after this plan)
| Endpoint | Auth | Fields |
|---|---|---|
| `POST /api/orders` (201, replay 200) | none, rate limited | the confirmation fields in finding 2 |
| `GET /api/orders/by-phone/:phone` | — | **gone (404)** |
| `GET /api/orders`, `/:id`, `/stats`, `PUT /:id`, `PUT /:id/status`, `PUT /:id/items/:line/picked`, `DELETE /:id` | admin cookie, `requireAdmin` on all | all `COLUMNS` including `picked_items`, as today |
| Never returned anywhere | — | `request_id`, `request_hash` (not in `COLUMNS`, `order.repository.js:7-11`; `findByRequestId` adds the hash and `replayOf` strips it, `order.service.js:94`; pinned by `smoke-orders.js:684-699`) |

## Open Questions
1. **Deletion list.** Is the dependency inventory in finding 1 the intended scope, including deleting both `_order-history*.css` partials and the drawer's `STATUS_CONFIG` copy? *Recommended: yes.*
2. **Admin `?phone=` filter.** Keep `GET /api/orders?phone=` (authenticated, a small admin filter, `buildFilters`)? *Recommended: keep; it is not public and the admin may use it.*
3. **Old link `/orders/lookup`.** Let it fall to the not-found page, or redirect to the home page? *Recommended: not-found (no redirect code to maintain; nothing links to it after this change).*
4. **Retention constant.** 48 hours, as decided, counted from the original send. *Confirm that a manual resend does not restart the clock (recommended: it does not).*
5. **Trim the `POST /api/orders` answer** to the confirmation fields (Step F)? It touches many pricing assertions. *Recommended: yes, as a separate last code commit so it can be skipped alone.*
6. **Branch base.** Create `fix/customer-data-security` from the current HEAD `0ed6779` (36 commits ahead of `main`, polling not merged)? The pull request then contains all of those commits unless the polling branch is merged first; the owner picks the PR target. *Recommended: branch from the current HEAD; do not merge or rebase anything.*
7. **Checkout and cancel texts.** Approve the new Hebrew wording at review (finding 4).

## Steps
Nothing is staged, committed, pushed, merged or rebased by the agent; the owner approves each commit. No dependency is installed, no migration is run, no environment variable is added.

1. **Create the branch** `fix/customer-data-security` from the current HEAD once the plan is `active`.
2. **Step A — remove the lookup (server).** Edit `order.routes.js`, `order.controller.js`, `order.service.js`, `order.repository.js` as in the inventory. Update tests: delete the by-phone checks in `smoke-orders.js`, `smoke-contract.js`, `smoke-rate-limits.js`, `unit-order-service.js`; in `smoke-auth.js:116` move the line out of the "public routes stay open" list; add the new 404 assertions below.
3. **Step B — remove the lookup (client).** Delete `OrderHistory.js` and the two CSS partials; edit `StoreLayout.js`, `App.js`, `Navbar.js`, `_navbar.css`, `app.css`, `orderService.js`, `Accessibility.js`, `CheckoutFormView.js` (texts), the comments listed; delete the `getOrdersByPhone` test; remove the page from `scripts/a11y-audit.js:75` and the route from `test/smoke-static.js:52`. Steps A and B ship in the same pull request (a client without its server route, or the reverse, leaves a dead feature).
4. **Step C — log redaction (server).** `errorHandler.js:131-133` and `transporter.js` / `email/index.js` as in finding 3; the `label` argument added at the three senders in `email/index.js`.
5. **Step D — checkout attempt retention (client).** `persistence.js` (constant, expiry reduction, a validator for both shapes, header comment), `useCheckoutForm.js` (apply on load and before any send; treat `expired` like `conflict` for resend; update the header comment that says there is no expiry; `summaryOf` carries the flag), the pending-order notice in `CheckoutFormView.js` (expired variant, contact links, cancel).
6. **Step E — trim the confirmation response (server, optional per Q5).** `toConfirmation()` in `order.service.js` used by `createOrder` and `replayOf`; update the assertions that read pricing fields from the POST answer to read them from the admin `GET /orders/:id`.
7. **Step F — docs and backlog.** `README.md`, `docs/ARCHITECTURE.md`, `docs/security.md` (remove the lookup row and the "exposes customer information" gap, record the log and retention behaviour, add "log retention is the host's decision"), `.doc/architecture.md`, `.doc/product-definition.md:20` (S4 without the lookup), `.doc/glossary.md` (remove "the order lookup" from the rate-limit entry; define **expired checkout attempt** before it is used), `.doc/code-audit.md` B03 note, `.plan/000-backlog.md` (tick the three items and move them to DONE), and set this plan to `done`.

## Validation
Existing coverage found, and what is added:

| Area | Exists | Added |
|---|---|---|
| Removed lookup | tests that **assert it works** (`smoke-orders.js`, `smoke-contract.js`, `smoke-auth.js`, `smoke-rate-limits.js`, `unit-order-service.js`, `storeServices.test.js`) | replaced by 404 and absence tests (A, B) |
| Admin routes protected | `smoke-auth.js` (401 without cookie, 200 with), `smoke-contract.js:155` (guard before id check) | one assertion per admin order route (A) |
| Public checkout and idempotency | `smoke-orders.js:666-799` (replay, 422, concurrency, hidden internals), `smoke-contract.js`, `useCheckoutForm.test.js` (429, unknown outcome, reload) | unchanged, must pass |
| Logs | `unit-error-handler.js:94-136` (the 4xx warning only) | 5xx line and mail logs (C) |
| Attempt retention | `checkoutAttempt.test.js`, `useCheckoutForm.test.js`, `PendingOrderNotice.test.js` | expiry tests (D) |
| Admin polling | `useAdminOrders.polling.test.js` | re-run; no change expected |

Checklist (each item is a test or a command; `agent-run` unless stated):
- [ ] `npm test` — all server suites; needs the local `TEST_DATABASE_URL` (`AGENTS.md`).
- [ ] `npm run test:client` — all client suites, including `useAdminOrders.polling.test.js` unchanged.
- [ ] `npm run build:client` — the production build compiles with the drawer, its CSS and its imports gone.
- [ ] Search `Grep` for `by-phone|byPhone|findByPhone|findOrdersByPhone|getOrdersByPhone|OrderHistory|order-history|orders/lookup|onOrderLookup|openOrderHistory|navbar-link--orders` over `server/`, `client/src/`, `test/`, `scripts/`: no match except in tests that assert the 404 or absence (those spell the old path once, in a clearly named test). `README.md`, `docs/` and `.doc/` current docs: no match outside historical audits.
- [ ] Test (A): `GET /api/orders/by-phone/0501234567` and `GET /api/orders/by-phone/050-123-4567` → 404 with the `{ error }` shape, with and without the admin cookie, and no `RateLimit-*` headers; `POST` to the same path → 404.
- [ ] Test (A): every admin order route (`GET /orders`, `GET /orders/stats`, `GET /orders/:id`, `PUT /orders/:id`, `DELETE /orders/:id`, `PUT /orders/:id/status`, `PUT /orders/:id/items/0/picked`) → 401 without the cookie and the normal status with it; `GET /orders?phone=0500000000` with the cookie still filters (Q2).
- [ ] Test (A): `POST /api/orders` → 201 with a valid order; invalid orders → the same 400/409 as before; a product that is out of stock or an option no longer offered → 409; the stored order has server-computed totals.
- [ ] Test (A): idempotency unchanged: same `request_id` and body → 200 with `Idempotent-Replayed: true` and the same `id`; different body → 422 `request_id_reused`; concurrent duplicates → one row; `request_id` and `request_hash` never appear in any answer.
- [ ] Test (B): a client test renders `Navbar` and the store layout and finds no link, button or text "ההזמנות שלי" and no route `/orders/lookup` (visiting it renders the not-found page); `test/smoke-static.js` no longer lists `/orders/lookup`; `scripts/a11y-audit.js` has no such page.
- [ ] Test (B): the unresolved-order notice and the cancel confirmation no longer mention "ההזמנות שלי" and show the store phone and WhatsApp links.
- [ ] Test (C): a 5xx whose request URL, params, query and body hold a phone, name, email and address, and whose PostgreSQL error `message`, `detail` and `where` hold the same values, produces `console.error` output with the method, the route pattern, the status and the PostgreSQL code, and **none** of those values; a non-PostgreSQL 5xx still logs its stack; the client response is unchanged (`{ error }`, no stack, no database text).
- [ ] Test (C): `unit-email-delivery` — for mail enabled, disabled, timed out, and failed with an error whose message contains the recipient, no captured log line contains the recipient, the customer's name or the subject; the label and the outcome are present; the returned `{ sent, reason }` is unchanged.
- [ ] Test (D): with fake timers, an attempt read 47 hours 59 minutes after `submittedAt` returns the full body and the same `requestId`; at 48 hours it is reduced to `{ requestId, submittedAt, expired, itemCount, total }` and the raw `localStorage` string contains none of the name, phone, email, address, notes or item names.
- [ ] Test (D): within the period, after a reload, *send again* sends the exact same body and `request_id`, and a 200 replay clears the attempt (existing tests pass unchanged).
- [ ] Test (D): after expiry there is **no automatic request** (no `fetch`, even after advancing timers by days), `retryPendingOrder` sends nothing, `handlePlaceOrder` sends nothing while the notice is open, and the notice says the outcome is unknown and points to the store, without saying the order failed.
- [ ] Test (D): cancel removes the expired record, and the next order gets a **new** `request_id`; a successful, a refused (4xx), and a cancelled attempt leave no key in `localStorage`; with storage blocked the hook still works in memory.
- [ ] Test (D): an open tab that crosses 48 hours and then presses *send again* sends nothing and shows the expired notice.
- [ ] Test (E, if kept): the `POST /orders` answer has exactly the keys `id, customer_name, customer_phone, customer_email, delivery_method, delivery_address, total, emails`, for the 201 and for the replay, and the two key lists are equal; the confirmation screen still renders from it; the stored order read through the admin route still has the pricing fields.
- [ ] `owner-run` (browser, dev server, Windows PowerShell 5.1 for starting it): place an order; stop the server mid-request; reload; confirm *send again* still works; then change the stored `submittedAt` in the developer tools to three days ago and reload to see the expired notice; confirm the navbar and the mobile menu have no orders link and `/orders/lookup` shows the not-found page. Not automated.
- [ ] `owner-run` after Step C with mail disabled: place an order with an email and read the terminal; expect only labels and outcomes. Visual check.

## Risks
- **Customers lose self-service order checking.** They phone the store; the number is on the confirmation screen and in the email. Accepted by the owner's decision.
- **Dead client/server pair.** Removing only one side leaves a drawer that always fails or a route nobody calls. Mitigation: Steps A and B in one pull request.
- **Shrinking the checkout answer breaks pricing tests and any consumer of the answer.** The only client consumer reads the seven confirmation fields. Mitigation: Step E is separate and optional (Q5), with a test helper that reads the stored order through the admin route.
- **Expiry could be mistaken for a failed order.** Mitigation: the notice says the outcome is unknown and points to the store; no code path creates a new `request_id` except the customer's explicit cancel.
- **Log changes lose some detail.** Route pattern, status, category, PostgreSQL code and routine, stack frames and request id are kept; a value-dependent failure is reproduced with a test order.
- **Stacked history.** The branch sits on 36 commits that are not in `main`; reviewing the pull request without the polling branch merged shows all of them. Mitigation: Q6; the P8.2 commits are the last five to seven and are listed below.
- **Stale cached client bundle** calling the removed route sees a 404, which the old drawer already displays as "no orders found". `index.html` is served `no-store` (`server/app.js:25`).
- **Historical docs** (`docs/cleanup-audit.md`, `docs/a11y-audit.md`) still mention the drawer. Left as records on purpose.

## Rollout Order
1. Owner answers Q1-Q7 inside this file; the plan is updated and its Status becomes `active`.
2. Create the branch from the current HEAD; execute Steps A to F in order, running `npm test` and `npm run test:client` after each; the owner reviews and makes each commit.
3. Run the `owner-run` checks.
4. Pull request from the branch (target per Q6), resolve comments, merge. The agent does not merge, rebase, push or tag.

**Suggested commit boundaries** (one intent each):
1. `feat(orders): remove the public order lookup from the server` — Step A with its tests.
2. `feat(client): remove the public order lookup page and links` — Step B with its tests. Must land in the same pull request as commit 1.
3. `fix(server): keep personal data out of error and mail logs` — Step C.
4. `feat(client): expire the stored checkout attempt after 48 hours` — Step D.
5. `refactor(orders): return only confirmation fields from order creation` — Step E (skippable).
6. `docs: p8.2 customer data security and backlog` — Step F.

## Rollback
- **Commits 1 and 2:** revert both together; this restores `GET /by-phone/:phone` and its exposure. No data, schema or environment change was made, so nothing needs undoing in the database. Reverting only one of them leaves a broken pair.
- **Commit 3:** revert; log lines return to the old format, nothing depends on them.
- **Commit 4:** revert. A record already reduced to the `expired` shape cannot be restored (the personal data is gone by design); the old code does not accept that shape and treats it as "no attempt", so the customer sees no notice. This is the only step that destroys data, and only on the customer's device after the retention time.
- **Commit 5:** revert; the answer returns to the full order. Safe to skip entirely.
- **Commit 6:** revert the documentation; if commits 1-2 are reverted, restore the lookup text in the docs and the backlog.
- No migration, dependency or environment variable is added, so there is nothing to undo outside the repository.
