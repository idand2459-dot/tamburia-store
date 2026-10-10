# Code Audit

Commit: af37de197344f74848e85353da897b2acc5bd218

Read-only audit, following the [refactoring skill](../.claude/skills/refactoring/SKILL.md). Starting points: the [codebase map](codebase-map.md) and the [test baseline](test-baseline.md) (671 passed, 0 failed). Scope: the source files read for the six walkthroughs, and the places they led to. No code was changed and nothing was run.

Already in the backlog from the setup, not repeated here: the static inline styles, `errorHandler.js:62`, the stale test counts in the docs, and a separate test database.

## Findings

### F01 — The delivery area is defined twice, client and server
- Evidence: `client/src/js/features/cart/CheckoutFormView.js:22`, `:25-29`, `:192`; `server/validators/order.validator.js:48`, `:50`, `:68-72`
- Severity: medium
- Category: structure
- Suggested change: keep the city list and its message in one source that both sides read, so adding a city is one change; the mechanism is for the plan to decide, within the current stack.
- Behavior: unchanged
- Pinned by tests: no — no test sends an address outside the delivery area (`test/` has no such case), and the client check has no test

### F02 — The delivery fee is set in two places that must match
- Evidence: `client/src/js/hooks/useCart.js:12`; `server/config/env.js:81`; the warning in `.env.example:31-32`
- Severity: medium
- Category: structure
- Suggested change: have the client take the fee from the server instead of a constant. Today, changing `DELIVERY_FEE` alone makes the cart show one total while the server charges another, because the server compares item prices only (`server/services/pricing.service.js:121`, `:137`).
- Behavior: unchanged while both values are 20
- Pinned by tests: server yes (`test/smoke-orders.js:102`, `:117`); client no

### F03 — The order statuses are listed in four places
- Evidence: `server/validators/order.validator.js:20`, `:31-39`; `client/src/js/pages/admin/adminConstants.js:34-39`; `server/services/email/templates/orderStatus.js:8-29`
- Severity: low
- Category: structure
- Suggested change: when a status is next added or renamed, keep the four lists aligned in the same change; a shared definition is possible but crosses the client/server boundary, so it is a decision for its own plan.
- Behavior: unchanged
- Pinned by tests: server yes (`test/smoke-orders.js:199`, `:214-218`); client no

### F04 — The store's address is hard-coded in five email strings
- Evidence: `server/services/email/templates/newOrder.js:65`; `server/services/email/templates/orderConfirmation.js:65`; `server/services/email/templates/shared.js:22`; `server/services/email/templates/orderStatus.js:17`, `:64`
- Severity: low
- Category: readability
- Suggested change: one constant for the store's address (and phone and hours) used by all templates.
- Behavior: unchanged
- Pinned by tests: no

### F05 — Comments point to files or notes that do not exist
- Evidence: `server/validators/order.validator.js:44` (the city list is "copied from CartModal"; it is in `CheckoutFormView.js:22`); `client/src/js/hooks/useWebSocket.js:7` (`services/realtime.js`; the file is `server/services/realtime.service.js`); `server/routes/order.routes.js:20-21` ("see the note in the summary", without saying which summary or file)
- Severity: low
- Category: readability
- Suggested change: point each comment at the real file, or remove the dangling reference.
- Behavior: unchanged
- Pinned by tests: not applicable (comments only)

### F06 — The admin orders hook holds pure calculations
- Evidence: `client/src/js/hooks/useAdminOrders.js:174-223` (statistics), `:226-256` (CSV export); the hook's tests cover the pick list only (`client/src/js/hooks/useAdminOrders.test.js:2`)
- Severity: low
- Category: structure
- Suggested change: move the statistics and the CSV rows into pure functions under `client/src/js/utils/`, as `utils/pickList.js` already does for the pick list, so they can be tested without rendering a hook.
- Behavior: unchanged
- Pinned by tests: no

### F07 — `exportOrdersToExcel` writes a CSV file
- Evidence: `client/src/js/hooks/useAdminOrders.js:225-226`, `:248-253`; the button label "ייצא לאקסל" (`client/src/js/pages/admin/OrdersTab.js:72`)
- Severity: low
- Category: readability
- Suggested change: name the function after what it produces (for example `exportOrdersToCsv`); the button label is product text and is the owner's call.
- Behavior: unchanged
- Pinned by tests: no

### F08 — The order model builds column names from the keys it is given
- Evidence: `server/models/order.model.js:98-103`, `:113-116`; safe today because the validators pass only known fields (`server/validators/order.validator.js:245-254`, `:282-288`)
- Severity: low
- Category: architecture
- Suggested change: let the model check the columns against its own list too, so a future caller cannot pass an unchecked key into the SQL.
- Behavior: unchanged
- Pinned by tests: partly (`test/smoke-orders.js:253-254`: `total` and `items` cannot be edited)

## Behavior questions for you to decide

Each of these would change behavior, so none is a finding; each is your decision.

### B01 — AC01: the confirmation email in the log
- Evidence: `server/validators/order.validator.js:248` (the customer's email is optional); `server/services/email/transporter.js:23` (no recipient returns before the `MAIL_ENABLED` check); `server/services/email/transporter.js:26` (with `MAIL_ENABLED=false` the log line is `[מייל כבוי] "<subject>" → <to>`)
- What happens: an order without an email writes no confirmation line to the log at all; with an email, only the subject and the recipient are logged, not the email.
- The question: is AC01 met by "a line with the confirmation's subject and recipient is logged, for an order that has a customer email"? Or should the log show something more (for example a line also when there is no recipient, or the email's content)?

### B02 — A stack trace in non-production 5xx responses
- Evidence: `server/middleware/errorHandler.js:62`
- The question: keep it as a development aid, or remove it so no response ever carries a stack trace (the error-handling skill's rule)? Already in the backlog.

### B03 — Order lookup by phone number is open
- Evidence: `server/routes/order.routes.js:13-30` (the code's own comment: a phone number alone returns the name, address, items, and totals; it is rate-limited, 20 per 15 minutes, not protected)
- The question: is the rate limit enough while the store runs locally only, or should proof of ownership (for example a one-time code) be planned before the store goes live?

### B04 — Mail is on when `MAIL_ENABLED` is not set
- Evidence: `server/config/env.js:50` (on unless set to `false`), `server/config/env.js:51` (then `MAIL_USER` and `MAIL_PASS` are required); `.env.example:21` (`false`)
- The question: should a missing `MAIL_ENABLED` mean off, so a fresh copy without the variable starts without Gmail credentials?
