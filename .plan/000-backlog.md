# Prioritized Backlog

Format:
- `- [ ] <title>`
- `- [ ] <title> | <marker>`   optional trailing marker, such as a design link or a scope tag

Add a new item at the end of `Current queue:`, in priority order. When an item is done, tick it (`- [x]`) and move it under `## DONE`.

Current queue:
- [ ] README.md and docs/ARCHITECTURE.md contain exact test counts that go stale; replace them with a general statement or verify them | phase B
- [ ] errorHandler.js:62 adds the stack trace to non-production 5xx responses; decide whether to keep it | phase B
- [ ] Static inline styles: `display: 'none'` in ImportTab.js:39, `fontWeight: 600` in PaintCalculator.js:412, and a hard-coded `'#333'` in PaintCalculator.js:271 and :412 (a possible token violation); move them to partials or confirm they stay | audit
- [ ] npm test and npm run a11y use the real local database (test/run-all.js:2-5); decide on a separate test database, and record the answer in AGENTS.md | phase B
- [ ] Add tests that pin the current behavior before any audit change: the delivery area (server and client), the client delivery fee, the email templates' store details, and the admin statistics and CSV rows | audit F01 F02 F04 F06 F07
- [ ] One source for the delivery area's cities and message, client and server | audit F01
- [ ] The client takes the delivery fee from the server instead of a constant | audit F02
- [ ] Keep the four order-status lists aligned, or plan a shared definition | audit F03
- [ ] One constant for the store's address, phone, and hours in the email templates | audit F04
- [ ] Fix the comments that point to missing files or notes | audit F05
- [ ] Move the admin statistics and CSV rows out of useAdminOrders into pure utils | audit F06
- [ ] Rename exportOrdersToExcel to match the CSV it writes | audit F07
- [ ] The order model checks column names against its own list | audit F08
- [ ] `scripts/lib/palette.js:41` still evaluates client source with `new Function` to read `colorPalette.js`; move the palette to a JSON file as was done for `categories.json` | P7 finding
- [ ] Remove the obsolete `.skeleton-category-card` selector in `client/src/css/components/_loading.css` (its component was deleted in P7) | P7 finding
- [ ] P5 security and validation findings: raw PostgreSQL text in 4xx responses (mapPgError message used only for 5xx), inconsistent validation messages and order, English parser errors (malformed JSON, 413), stack trace in non-production 5xx, rate limiting on POST /orders and POST /reviews (SEC-01), production checks for headers, `Secure` cookie, HSTS and CORS (SEC-02), undefined duplicate-SKU behavior | P5 findings, behavior change
- [ ] **Before production:** runtime delivery-fee synchronization. The client has `DELIVERY_FEE = 20` (`utils/delivery.js`) and the server reads `DELIVERY_FEE` from the environment. P7.3 added a test that the code defaults and `.env.example` agree, but a production override of the variable still makes the customer see one total and the order record another (the server ignores the totals the client sends, a contract pinned by smoke-orders). A fix needs the fee to reach the client at run time (a field in an existing response, or a small endpoint) | P7.3 finding
- [ ] Review `CART_BUNDLE_ADDED` (calculator bundles): it still merges into an existing line by product id alone, whatever its colour, size or variant (pinned in cartBehavior.test.js, documented in cartReducer.js) | P7.3, behavior change
- [ ] Cart quantity is not capped in the UI: the server refuses a line above 999 units with a 400, but the cart lets the customer go past it | P7.3
- [ ] `selectedColor` and `selectedSize` of an order line are free text on the server and are not checked against the product | P7.3
- [ ] `POST /api/orders` has no idempotency key and the client has no request timeout, so a retry after a lost response can create a duplicate order; a very small race remains between pricing a product and a concurrent delete (`items` is JSONB with no foreign key) | P7.3 audit, with SEC-01
- [ ] Cart availability marks a whole product by id when it is unavailable; a stock level per variant does not exist (only `in_stock` on the product), so "one variant sold out" cannot be expressed yet | P7.3

## DONE
- [x] Replace the manual cookie parsing in `auth.service.js` (`readCookie`) with `cookie-parser`, keeping the existing HMAC-signed token authentication and cookie flags unchanged; do NOT introduce express-session | owner decision, behavior-preserving | done in P7.1 (cookie-parser 1.4.7; the WebSocket upgrade runs it by hand)
- [x] Unify the two wishlist persistence paths: `utils/wishlistUtils.js` (used by Wishlist.js and ProductDetails.js) writes the same localStorage key as the Redux `toggleWishlist` thunk but never updates the store ids, so the heart on the product page and the navbar count can disagree | done in P7.2 (items in the store, persistWishlist, wishlistUtils.js removed)
