# 003 — Replace the admin WebSocket order feed with HTTP polling

Status: done
Owner: Idan
Last updated: 2026-11-14

Approved by the owner with adjustments: one continuous pass (no manual browser check between the phases), new orders detected by order id (a set of ids seen), the polling logic kept local in `useAdminOrders` (no `usePolling` hook), and nothing staged or committed by the agent. Tests are in `useAdminOrders.polling.test.js`.

Implementation and automated validation are complete (client tests, server tests, production build). **Manual browser validation is still pending** (the chime and confetti within 30 seconds, no sound on page load, the Network tab cadence while the tab is hidden and shown, and the 401 stop); it has not been done. The Validation items marked owner-run for the browser are the open ones.

## Goal
Replace the WebSocket `order:created` notification with a 30-second HTTP poll of `GET /api/orders` that runs only while the tab is visible, so the admin keeps the new-order chime, the confetti and the unseen-order count without a WebSocket server, a `ws` dependency or the open WebSocket security gaps (`docs/security.md`, backlog item "WebSocket hardening"). The decision comes from the WebSocket audit: one feature, one user, low order rate, and a poll already exists.

## Scope
In scope:
- Client: a new generic `usePolling` hook, `useAdminOrders.js` (poll, new-order detection, 401 handling), deletion of `useWebSocket.js`.
- Server: deletion of `realtime.service.js`, the `attachRealtime` call in `server/server.js`, the `broadcast` call in `server/api/order/order.service.js`, and the `ws` dependency.
- Tests, docs, and the backlog (listed in Steps).

Out of scope (and why):
- Order creation, checkout and idempotency: untouched. The only edit in `order.service.js` is deleting the `broadcast` line and its import (phase 2).
- A lighter polling endpoint (`?since=`, `ETag`, or a count endpoint): `GET /api/orders` returns every order with its `items`, and polling it 4× more often than today (30 s instead of 120 s) raises the load. Fine for the current volume; a backlog item records it instead of widening this plan.
- Admin token revocation and server-side logout: separate backlog item.
- Historical audit files (`ARCHITECTURE_AUDIT.md`, `TARGET_ARCHITECTURE.md`, `REFACTOR_PLAN.md`, `SETUP.md`, `docs/cleanup-audit.md`, `.doc/code-audit.md`): they describe the code at an earlier time and stay as written. `ARCHITECTURE_AUDIT.md` is never touched.
- No new dependency, no migration, no Redux change: orders stay in `useAdminOrders` state, as today.

## Assumptions
- Only `Admin.js` mounts `useAdminOrders`, and `Admin` is mounted only after login (`AdminRoute.js`), so the poll exists only for a logged-in admin.
- Every 401 from `adminApi` already calls `onUnauthorized`, which returns the admin to the login screen and unmounts `Admin` (`adminService.js:22`, `AdminRoute.js:55`). The hook must still stop on its own, so it does not depend on that.
- Order ids are increasing integers, so "newer than any id seen" identifies a new order.
- Today `loadOrders` ignores `res.ok`: a non-OK JSON object empties the list, and `useAdminOrders.test.js:352-366` pins that. The manual reload path (status change, delete) keeps that behavior in this plan.
- jsdom provides `document.visibilityState` and the `visibilitychange` event, and Jest fake timers can drive both.

## Open Questions
1. **New-order detection.** Today a new order is detected by the count growing (`prevOrdersCount`), so a delete plus a new order inside one poll window shows nothing. Recommended: compare the highest order id seen instead, and keep the count only where the code needs it. Requirement 7 holds either way: the first load sets the baseline and never notifies. Approve the id-based rule?
2. **Which tabs poll.** The hook lives in `Admin`, which holds all six tabs, and the new-orders badge is visible on every tab. Recommended: poll on every tab, as today (the requirement "while the admin orders interface is active" is read as "while the admin screen is mounted and the tab is visible"). The alternative, polling only on the orders tab, would stop the chime elsewhere.
3. **Failed polls.** A network error or a 5xx keeps the list and retries at the next 30-second tick, with no backoff and no error message (as today). Recommended: keep it; only a 401 stops polling. Agree?
4. **Branch base.** The current branch `fix/p8-1-backend-hardening` holds finished P8.1 work that is not on `main`. Recommended: create `feat/admin-order-polling` from the current HEAD, and let the pull request show P8.1 first (or merge P8.1 first). Which one?
5. **`ws` removal.** `npm uninstall ws` rewrites `package.json` and `package-lock.json`. Recommended: the owner runs it (it needs the network), and the agent edits nothing by hand in the lock file. OK?
6. **One or two commits.** Recommended: two commits, because the second one (removal) happens only after the owner verifies the polling by hand. Agree?

## Steps
Phase 1: polling (the WebSocket server stays in place but nothing on the client listens to it).
1. Create the branch `feat/admin-order-polling` (Open Question 4) before any edit. `ARCHITECTURE_AUDIT.md` stays untracked and unstaged.
2. Add `client/src/js/hooks/usePolling.js`. Transport only, like `useWebSocket` was: `usePolling(callback, { intervalMs, enabled })`.
   - A chain of `setTimeout`, not `setInterval`: the next tick is scheduled only after the previous callback's promise settles, so two requests never overlap (requirement 6).
   - A `document.hidden` check before each tick and a `visibilitychange` listener: hidden clears the timer; visible runs the callback at once and restarts the 30-second chain (requirements 3 to 5). When the tab is hidden at mount, no timer starts until it becomes visible.
   - If a request is already in flight when the tab becomes visible, no second one starts; the chain continues after it settles.
   - The callback is kept in a ref (the same pattern as `useWebSocket`), and the hook stops permanently when the callback returns `false` (see step 3).
   - Cleanup on unmount: clear the timer, remove the listener, and ignore a result that arrives after unmount.
3. Change `client/src/js/hooks/useAdminOrders.js`:
   - Remove the `useWebSocket` import and call, the `POLL_MS = 120000` interval and its comments. Add `POLL_MS = 30000` and `usePolling(pollOrders, { intervalMs: POLL_MS })`.
   - `pollOrders` calls `adminApi.getOrders()`. On `res.status === 401` it returns `false` (polling stops; `onUnauthorized` already ran, requirement 8). On a non-OK answer or a failure it keeps the list and does nothing else (Open Question 3). On success it updates the list and runs the new-order detection.
   - Detection (Open Question 1): a `lastSeenOrderId` ref, set from the first successful load without notifying (requirement 7). Later, when any order has an id above it, call `announceNewOrder()` once, then raise the ref. The status change, delete and pick-list calls keep using `fetchOrders`, which does not notify; it raises the baseline only when the list changes, so an order created by someone else and picked up by a manual reload is not announced a second time by the next poll.
   - One in-flight guard shared by the poll and the manual reloads, plus a sequence number so an older response never overwrites a newer one (a slow poll must not undo a status change the admin just made).
   - The unseen-order count (`newOrdersCount` in `Admin.js:86`) is derived from `orders`, so it needs no change.
   - Update the header comments (Hebrew comments stay as they are; new or changed ones are English).
4. Tests (see Tests): add `usePolling.test.js` and the polling cases in `useAdminOrders.test.js`; remove the five `jest.mock('…/useWebSocket')` lines (`App.test.js:17`, `App.cart.test.js:15`, `Admin.test.js:16`, `useAdminOrders.test.js:14`, `useAdminOrders.reports.test.js:17`) in phase 1, because the module will no longer be imported there.
5. Run the checks in Validation, phase 1. **The owner verifies the behavior in a browser** (two windows: the storefront places an order, the admin sees the chime within 30 seconds; hide the tab, wait, show it again). Stop here until the owner confirms.

Phase 2: removal (only after step 5 is confirmed).
6. Delete `server/services/realtime.service.js`, the `attachRealtime` import and call in `server/server.js`, and the `broadcast` import and call in `server/api/order/order.service.js` (including the JSDoc sentence about broadcasting). Update the comments that mention the broadcast (for example the replay comment at `order.service.js:104-110`).
7. Delete `client/src/js/hooks/useWebSocket.js`.
8. In `test/unit-auth-cookie.js` delete `testWebSocket`, `openSocket`, and the `ws`, `http` and `attachRealtime` imports, and end the suite with the same summary and exit code logic directly. The cookie-parser and `requireAdmin` checks stay.
9. Owner runs `npm uninstall ws` at the repository root. `client/package-lock.json` is not touched (its `ws` entries belong to the Create React App dev server).
10. Documentation (Hebrew product text is not affected; these are English docs):
    - `README.md`: the feature bullet (line 76), the tech table (102), the architecture diagram (about 124 to 135, the `/ws` node and the WebSocket edge), `services/` description (155, "realtime"), the `unit-auth-cookie` row and its test count (381), the hardening sentences (about 320 and 554).
    - `docs/ARCHITECTURE.md`: lines 14, 34, 95, 118 and 240.
    - `docs/security.md`: remove the WebSocket gap bullet (178) and any deployment-checklist line about the upgrade or `Origin`; add a line that the admin order list is polled every 30 seconds.
    - `.doc/architecture.md` (lines 10 and 78), `.doc/codebase-map.md` (lines 20 to 33, 62, 69 to 78; the W02 walkthrough becomes the polling walkthrough), `.doc/product-definition.md` (S11 becomes "new-order notification by polling, with a chime").
    - `.plan/000-backlog.md`: tick or remove the item "WebSocket hardening" (line 41, keeping the token-revocation decision as its own item); add the item for a lighter orders endpoint (Scope); update the note on line 53.
    - `.doc/glossary.md`: add the terms only if a new shared term appears (none planned).
11. Final checks (Validation, phase 2). Stage the changes with `git add` per phase and propose the commit messages; the owner commits.

## Tests
Add `client/src/js/__tests__/hooks/usePolling.test.js` (Jest fake timers, `visibilityState` stubbed):
- runs the callback every 30 s and not before.
- does not start a second call while the first promise is pending (no overlap), then schedules the next after it settles.
- a hidden tab stops the ticks (advance 5 minutes: zero calls); becoming visible calls at once, then every 30 s.
- hidden at mount: no call until visible.
- becoming visible while a call is pending starts no second call.
- the callback returning `false` stops polling for good.
- unmount clears the timer and the listener; a late result after unmount does nothing.

Update `client/src/js/__tests__/hooks/useAdminOrders.test.js` (and `.reports.test.js` for the mock removal only):
- the first load never calls `onNewOrder` or shows confetti for orders already present (requirement 7).
- a poll that returns a new order id calls `onNewOrder` once and sets `showConfetti`; a second poll with the same list does not.
- a poll after the admin deleted an order and one new order arrives still announces it (Open Question 1).
- a poll answer of 401 stops further polling (advance 5 minutes: no more `GET /api/orders`), and leaves the list as it was.
- a 500, a network failure or a non-JSON answer keeps the list and the next tick still runs.
- a slow poll that resolves after a status-change reload does not overwrite the newer list.
- the unseen-order count (`orders.filter(status==='new')`) rises after a poll that adds a new order.
- existing tests for status change, delete, pick list and `loadOrders` stay as they are, except the removed mock line.

Server:
- `test/unit-auth-cookie.js`: remove the six WebSocket checks (Phase 2); the rest stays. Update the count in `README.md`.
- No server test is added: the server loses a feature and gains none. `smoke-orders` already pins that order creation, replay and the response shape are unchanged, and must still pass untouched.

## Validation
Phase 1:
- `npm run test:client` — all client suites pass, including the new ones. (agent-run)
- `npm run build:client` — the production build compiles, with no import of `useWebSocket` left in use. (agent-run)
- `rg "useWebSocket" client/src --glob "!**/__tests__/**"` shows only `useWebSocket.js` itself. (agent-run)
- `npm test` — the server suites still pass (needs `TEST_DATABASE_URL`, a local database). (owner-run)
- Manual: with the server and client running, the admin screen open and another window placing an order, the chime and the confetti fire within 30 seconds, the badge count rises, and a page reload does not play the chime for existing orders. In DevTools Network, `GET /api/orders` appears every 30 seconds, stops while the tab is hidden, fires at once when it is shown again, and never shows two requests in flight. After clearing the cookie, one request returns 401 and no more follow. (owner-run)

Phase 2:
- `rg -i "websocket|realtime|attachRealtime|broadcast|\bws\b" server client/src test scripts package.json README.md docs .doc/architecture.md .doc/codebase-map.md .doc/product-definition.md` returns no live reference (historical audit files are excluded on purpose). (agent-run)
- `Select-String -Path package.json -Pattern '"ws"'` returns nothing, and `package-lock.json` has no root dependency `ws` (the `client/` lock is excluded). (owner-run, Windows PowerShell 5.1)
- `npm test` and `npm run test:client` pass. (`npm test` owner-run, `npm run test:client` agent-run)
- `node server/server.js` starts, and a request to `/ws` now returns the normal 404 instead of an upgrade. (owner-run)
- `git status` shows `ARCHITECTURE_AUDIT.md` still untracked and unchanged. (agent-run)

## Risks
- **Four times the list traffic** (30 s instead of 120 s, each answer holding every order with its `items`). Mitigation: hidden tabs do not poll, one admin is expected, and a backlog item covers a lighter endpoint if the order volume grows.
- **A slow or stale response overwrites newer state.** Mitigation: the in-flight guard and the sequence number, with a test.
- **A missed or doubled notification** from the detection rule. Mitigation: the id-based baseline, set on first load and raised by every successful list load, with tests for first load, repeat poll, and delete plus new order.
- **Sound autoplay is blocked in a tab that was hidden** and then shown (browsers need a user gesture in some cases). The behavior is the same as today for the poll-triggered chime; the confetti and the badge still show. Not fixed here.
- **Browsers throttle timers in background tabs**, which is why the plan pauses them and refreshes on visible instead of relying on them.
- **A clock-less 401 loop** if the hook did not stop. Mitigation: the poll stops on the first 401 even when `onUnauthorized` is a no-op, with a test.
- **Deployment drift** during a rolling deploy: an old cached admin bundle keeps trying `/ws` and gets a 404 every 3 seconds until reloaded. Mitigation: harmless; the admin reloads on the next visit. Noted in the commit body.
- **Phase 2 needs the network** for `npm uninstall ws`; if it fails, the code removal can still merge, and the dependency can follow.

## Rollout Order
1. Approve the plan and the Open Questions (Status becomes `active`).
2. Create the branch and implement phase 1; run the phase 1 validation.
3. The owner verifies the polling by hand and approves phase 2.
4. Implement phase 2 and validate. Stage with `git add`; the owner commits, pushes and opens the pull request.
5. Merge into `main` through the pull request, after review; then set this plan to `done`.

Suggested commits (the owner runs them):
- `feat(admin): poll the order list every 30 seconds instead of listening on a WebSocket`
- `chore(server): remove the WebSocket server and the ws dependency`

Each with the attribution line from the session instructions.

## Rollback
- Phase 1 alone: revert the first commit. The WebSocket server is still there, so `useWebSocket` and the 120-second poll come back exactly as they were.
- Phase 2: revert the second commit (this restores the files, `package.json` and the lock file together). No database state is involved, so nothing else needs undoing.
- Before any commit: `git restore` the touched files; the new `usePolling.js` and its test can simply be deleted, since nothing else imports them.
- If polling misbehaves after merge, setting `POLL_MS` back to 120000 is a one-line stopgap; the WebSocket code stays recoverable from history until phase 2 is merged.
