# 005 — P9 End-to-end testing

Status: done
Owner: Idan
Last updated: 2026-11-16

## Goal
A reliable browser-level suite for the store's most important journeys, running the real client build, the real Express API and a real PostgreSQL, only against the guarded test database. No application code was changed: the suite found no application defect.

## Scope
In scope: `test/e2e/` (runner, helpers, three specs), `npm run test:e2e`, `test/unit-e2e-refusal.js`, docs. Out of scope: CI wiring, cross-browser runs, visual regression, load testing, and any change to the P8 security decisions, to the `POST /api/orders` contract, to admin authentication or to the checkout idempotency.

## Assumptions
- Chrome or Edge is installed (`CHROME_PATH` overrides the lookup); `puppeteer-core` was already a dev dependency of `npm run a11y`, so no dependency was added and Playwright was not needed.
- `TEST_DATABASE_URL` points to a local database whose name contains `test`, and `ADMIN_PASSWORD` is set (both from `.env`, never read by the agent).
- `client/build` is current (`npm run build:client`).

## Test architecture
- `test/e2e/run.js` starts the server through `startTestServer` (`test/lib/testServer.js`): the whole database guard, the server's own identity check, migrations, and a listening port chosen by the OS on 127.0.0.1. Mail is forced off (`MAIL_ENABLED=false`); the application has no payment or other external call. Then it launches Chrome through puppeteer-core, runs the specs in one process, always cleans up, and exits with 0 only when nothing failed and nothing was blocked.
- `test/e2e/lib/harness.js`: `check`, `scenario` (an exception is one failure, the run continues), and four separate counters: passed, failed, skipped, blocked. A browser disconnect is one failure and the remaining scenarios are reported as blocked.
- `test/e2e/lib/fixtures.js`: three priced products (`E2E-` SKU prefix), customer name prefix `E2E`, direct SQL reads of PostgreSQL for persistence checks, and the cleanup.
- `test/e2e/lib/browser.js`: one browser context per scenario (own localStorage and cookies), request recording, `interceptOrderPosts` (to lose or hang one order response), and shared page actions. Selectors are accessible names, field ids the form defines, and component class names; waits are conditions with bounds.
- `test/e2e/specs/customer.js`, `admin.js`, `failures.js`.

## Covered journeys
Customer (`customer.js`): browse a category, open a product, add to cart, change quantity, remove, cart survives a refresh; incomplete form is not sent; pickup checkout to the confirmation screen; the order as PostgreSQL holds it (customer, method, status, server-computed totals, items, `request_id`); delivery needs an address and adds the fee; no public lookup (401 or 404 for every old and guessed path, and `/orders/lookup` is the 404 page).

Admin (`admin.js`): a visitor sees only the login screen and makes no order request; every protected endpoint answers 401 without a session or with a forged cookie; a wrong password gives no access; UI login; the list loads; the cookie is HttpOnly; a new order appears through the real 30-second polling (bound 45 s, interval not shortened); inspect an order; change status through the select and read it back from PostgreSQL, also after a reload; the server rejects a status that does not fit the method; logout removes the cookie and the browser gets 401 afterwards.

Failures (`failures.js`): same `request_id` twice (201 then 200 with `Idempotent-Replayed`), six concurrent requests (exactly one 201), same id with a different body (422 `request_id_reused`, nothing saved); the response is lost after the server saved (uncertain notice, attempt stored, refresh keeps it and sends nothing, resend uses the same `request_id`, one order, success shows the original); a hung server (the client's 20 s timeout, nothing saved, safe resend); a stored attempt aged 49 hours (details removed, only the expired record stays, no resend button, no automatic request, no new `request_id`, only an explicit cancel frees the form); stock that changed during checkout (server 409, one request, no order, cart kept, no stored attempt; and 409 `out_of_stock` straight from the API).

Not duplicated on purpose: the backend suites keep the deep idempotency coverage (`smoke-orders`, `unit-order-service`), and the Jest suites keep the hook logic and the 429 path.

## Test database isolation
Every start runs the full guard (not production, `TEST_DATABASE_URL` required, local host, not the development database, a name with `test`, and the identity PostgreSQL reports). `test/unit-e2e-refusal.js` proves the runner exits 1 before any server, browser or fixture when the guard refuses (empty URL, production, remote host, a name without `test`). Cleanup deletes by recorded id and by the `E2E` / `E2E-` prefixes, before the run (leftovers of an interrupted run) and after it, and the run checks that nothing is left.

## Commands
```
npm run build:client
npm run test:e2e                      # all specs, about 2.5 minutes (the polling test waits for one real 30 s tick, the timeout test for 20 s)
E2E_SPECS=customer npm run test:e2e   # one spec: customer, admin or failures
```
Environment: Chrome or Edge (or `CHROME_PATH`), `client/build`, `TEST_DATABASE_URL`, `ADMIN_PASSWORD`. A missing browser, build or password is reported as blocked, never as passed.

## Findings and fixes
No application defect was found, so no application code changed. Two defects in the new tests were found and fixed, not hidden by retries: a wait that matched the product name left over from the previous page (a race), and two quick clicks on the quantity button while the drawer was still sliding in (one click was lost); each click is now awaited through a locator and confirmed before the next. One run lost its Chrome connection mid-run; it did not repeat in 8 later full runs and 6 customer-only runs, its cause was not determined, and the runner now reports a disconnect as one failure and the rest as blocked.

## Validation (final, 2026-11-16)
- `npm test` (agent-run): all 26 suites passed, 1553 checks, 0 failed (including `unit-e2e-refusal`, 16).
- `npm run test:client` (agent-run): 42 suites, 816 tests, 0 failed.
- `npm run test:e2e` (agent-run): 103 passed, 0 failed, 0 skipped, 0 blocked, in the last two consecutive full runs (and in two earlier ones). A run before the click fix failed once, and one lost its browser connection; both are described above.
- `npm run build:client` (agent-run): compiled successfully.
- ESLint (react-app config) on `test/e2e`: clean. `git diff --check`: clean.

## Known limitations and remaining risks
- Logout clears the cookie in the browser only; there is no server-side token revocation (already recorded in `.env.example` and `docs/security.md`), so a copied token stays valid until it expires. The suite checks what logout does guarantee.
- The 30 s polling and the 20 s client timeout are tested in real time, so the suite is slow by design.
- Only Chrome, one viewport, Hebrew/RTL, no mobile layout and no cross-browser coverage; accessibility stays with `npm run a11y`.
- Not in CI; it needs Chrome, a build and the local database.
- The rate limit (429) path is covered only by the Jest tests and `smoke-rate-limits`, not in the browser.
- Test products are created in the `tools` category; a very large catalogue could page them out of the category listing.

## Risks
- A UI wording change breaks accessible-name selectors; they are all in a few helpers and the specs.
- A leftover `E2E` row after a hard kill is removed by the next run's sweep.

## Rollout Order
Review, commit in the boundaries proposed in the final report, merge through a pull request.

## Rollback
Delete `test/e2e/`, `test/unit-e2e-refusal.js`, the `test:e2e` script, the `unit-e2e-refusal` entry in `test/run-all.js`, and the doc lines. No application code or schema is involved.
