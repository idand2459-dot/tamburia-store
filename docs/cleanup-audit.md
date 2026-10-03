# Cleanup & architecture audit

Branch `chore/cleanup-audit` (from `main` @ `41f3856`), 2026-10-02.

## Outcome (Phase 2, applied 2026-10-03)

The owner approved every recommendation below, including D6 (delete `POST /upload`), B1 (keep
the PNGs), F3 (services for pigments and settings too) and F11–F13 (client moves). It was
applied in one commit per topic, each followed by `npm test`, `npm run test:client`,
`npm run build:client` and `npm run a11y`, all green. **S1 is closed:** the owner rotated
`ADMIN_PASSWORD` and `SESSION_SECRET`. It was checked, without printing either value, that the
new password differs from the one in history and has at least 12 characters.

Where the result differs from the plan:

- **G6 not applied.** `design-assets/square-backup-*/` still exists locally, so its ignore
  line stays, even though the script that made it is deleted.
- **C3 / C4 were partly false positives.** `_reviews.css`, `_hero.css` and `_hero-cta.css`
  only *mention* the media queries in comments, and `_reset.css`'s "two body rules" are
  `html, body` + `body`. The two real duplicate dark-mode blocks (`_admin-form`,
  `_admin-products`) were merged.
- **Found along the way and fixed, each in its own commit:**
  - The hours table failed AA contrast (4.3:1) on the day it is closed, a state the audit
    only sees on those days.
  - `scripts/import-products.js` (M2) no longer worked: it predated migration 008 and wrote
    colours as `text[]` into a JSONB column. `smoke-fresh-db` now runs it.
  - "My orders" crashed on any non-2xx response (a 429 from its rate limit).
- **Additions beyond the report:** production refuses to start without `SESSION_SECRET` or
  with an admin password under 12 characters; `unit-repo-hygiene`, `unit-config`,
  `smoke-fresh-db`, `unit-product-service` and `unit-review-service` were added; `ADMIN_URL`
  now defaults to `:3000/admin`.
- **Admin lazy loading (F17):** main bundle 149.25 kB → 132.13 kB gzipped, plus a 21.1 kB
  admin chunk.

The architecture as it now stands is described in [ARCHITECTURE.md](ARCHITECTURE.md).
The rest of this file is the Phase 1 report as approved, kept for the record.

---

Every item has an ID, so you can approve by ID ("approve all except D3, F7").
Recommendation verbs: **delete**, **move**, **fix**, **keep** (with the reason).

### How this was checked

| Check | Tool | Notes |
|---|---|---|
| Unused modules (server, scripts, tests) | `npx knip` with entries `server/server.js`, `server/db/migrate.js`, `scripts/*.js`, `test/*.js` | 1 hit, which was a false positive (see A-notes) |
| Unused modules (client) | `npx knip` with entries `src/index.js`, `setupTests.js`, `*.test.js` | 0 unused files |
| Unused exports (server) | knip + a custom scanner | knip can't follow `controller.list` on CommonJS namespaces, so the custom scan counts every exported name across files |
| Unused CSS classes | custom scanner | Every class in `src/css` matched against `src/js` + `public/index.html`, with dynamically built prefixes (`spinner-${size}`) excluded |
| Unused assets | filename grep + `require.context` check | Category banners load through `require.context` in `CategoryBanner.js` |
| Dependencies | `npx depcheck` (root and client), verified by hand | |
| Secrets | regex scan of `git log --all -p`, compared against the current `.env` **without printing values** | |
| Large files | `git rev-list --objects --all` + `cat-file` | |
| Baseline | `npm test`, `npm run test:client`, `npm run build:client`, `npm run a11y` | All green: **590 server checks / 10 suites, 53 client tests / 8 suites, a11y 0 findings**. The first a11y run crashed in Puppeteer (`TargetCloseError`) and the rerun was clean, so it's a flaky harness, not a finding |

---

## 0. Critical (read these first)

| ID | Path | What | Evidence | Recommendation |
|---|---|---|---|---|
| **S1** | git history: `client/src/AdminLogin.js` @ `8f2509a` (2026-03-18), removed in `90e5713` | The **current** `ADMIN_PASSWORD` is hardcoded in history (the old client-side `if (password === '…')` check) | The value equals `ADMIN_PASSWORD` in your local `.env`. The commit is in `origin/main`, and **the GitHub repo is already PUBLIC** | **Rotate `ADMIN_PASSWORD` now**, before deploying, and set a real `SESSION_SECRET` so old tokens die. Once rotated, the leaked value is worthless, so **don't rewrite history**: the repo is public and already cloned/cached, and a rewrite would also break the merged PR refs |
| **S2** | git history: root `server.js` and `import_products.js` (first in `8f2509a`, again in `ae5dd2e` and others; gone since `a0a9148`) | The local Postgres password is hardcoded (4 characters) | It equals `DB_PASSWORD` in your local `.env` | Low risk while Postgres stays local-only. **Never reuse it for a deployed database**, and change the local one too. No rewrite |
| **M1** | `server/db/migrations/001_products_columns.sql` | **No migration creates the `products` table.** 001 starts with `ALTER TABLE products`, with the comment "the table itself was created by hand" | On a fresh database, `npm start` fails on migration 001. This contradicts the README's claim that "a fresh clone reaches a working schema with `npm start`" | **Fix:** add `000_products_base.sql` with `CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR NOT NULL, price NUMERIC NOT NULL, stock INTEGER NOT NULL DEFAULT 0, image_url VARCHAR, category VARCHAR)`, taken from the live schema. Your existing DB sees it as pending and runs it as a no-op; a fresh DB gets the table before 001. **No existing migration is edited** |
| **M2** | `scripts/import-products.js`, `scripts/products_import_template.csv` (399 rows) | The only way to load a catalog into a fresh DB, but nothing points to it | Not in `package.json`, not in the README. The README says "a fresh install has products", which is false | **Keep.** Add `"products:import": "node scripts/import-products.js"` and a step in Getting started |

Other secrets results, for completeness: no `.env` was ever committed (only `.env.example`). No API keys, tokens,
private keys or connection strings with credentials appear anywhere in history (patterns: Postgres URLs with embedded credentials,
`sk-…`, `AKIA…`, `ghp_…`, `AIza…`, `BEGIN PRIVATE KEY`, `xox…`, `*_PASSWORD=`, `*_SECRET=`). `MAIL_PASS`
(the Gmail app password) was never committed. Two other password literals in history are test fixtures and
match no real secret. Seed data uses the unallocated `050-000000x` phone block, so no real customer data
is anywhere in history.

> S1 was resolved by rotation (see Outcome above), so the commit that holds the old value is
> named here: it no longer unlocks anything.

---

## 1. Unused files and folders

| ID | Path | What | Evidence | Recommendation |
|---|---|---|---|---|
| A1 | `client/src/assets/images/sections/contact-storefront-294.webp` | Image | Referenced nowhere in `src/js`, `src/css` or `public/` | **delete** |
| A2 | `design-assets/sections/contact-storefront.jpg` | Source of A1 | A1 is unused | **delete** (with A1) |
| A3 | `design-assets/unused/about-storefront.png` (2.3 MB) and the `unused/` folder | Discarded design source | Folder name; unreferenced; the largest file in the repo | **delete** |
| A4 | `design-assets/tools-subcategory-mapping.csv` | One-off working sheet from the tools subcategory split | Unreferenced by code or docs | **delete** |
| A5 | `client/src/css/index.css` | CRA boilerplate (`body` font stack, `code` font) | Imported by `src/index.js`. `base/_typography.css:16-20` needs `!important` *only* to beat it | **delete** + remove its import + drop the `!important` in `_typography.css` (see F9). Pixel-identical, because the Heebo rule already wins |
| A6 | `scripts/images-square-uploads.js` + `images:square-uploads` npm script | One-off migration of already-uploaded 3:4 photos to square | Its own header says "חד-פעמי" (one-off). Already run on 2026-10-01; new uploads are squared by `image.service` | **delete** (git history keeps it), plus its `.gitignore` line `design-assets/square-backup-*/` |
| A7 | `client/src/assets/images/categories/.gitkeep`, `docs/images/.gitkeep` | Placeholders | Both folders now hold real files | **delete** |
| A8 | `uploads/.gitkeep`, `photos/raw/.gitkeep` | Placeholders | `.gitignore` whitelists them on purpose (`uploads/*` + `!uploads/.gitkeep`), and the scripts and multer write into these folders | **keep** |
| A9 | `stash@{0}` "WIP on main: 1b8c5ca …" (2026-09-26) | Local stash of 37 renames (`→ routes/AdminRoute.js`, `→ utils/wishlistUtils.js` …) | Those moves have since landed on main | **drop** after a glance (`git stash show -p stash@{0}`). Local only, never pushed |
| A10 | remote branch `origin/redesign/css-upgrade` | Merged branch | Fully contained in `origin/main` | **delete on GitHub** after this PR |
| A-notes | `scripts/lib/cutout-worker.js`, `@imgly/background-removal-node` | knip says unused | False positive: `cutout.js:14` spawns the worker by path, and the worker loads `@imgly` | **keep** |

**Scripts and npm scripts.** All the others are live and documented: `seed:demo(:clear)`, `a11y`,
`images:categories`, `images:products`, `products:list`, `products:new-template`, `products:import-new`,
`products:hide-unphotographed` (part of the photo-day runbook). No duplicates. One fix:

| ID | Path | What | Recommendation |
|---|---|---|---|
| A11 | `package.json` → `dev:client` | `npm start --prefix client` starts CRA on **3000**, which collides with the server. The README works around it with PowerShell-only `$env:PORT=3001` | **fix:** add a committed `client/.env.development` containing `PORT=3001` (CRA reads it on every OS; it's not matched by `.gitignore`'s `.env`). Then `npm run dev:client` just works |

---

## 2. Dead code inside files that stay

### 2a. Unused exports

| ID | Where | Names | Recommendation |
|---|---|---|---|
| D1 | client `hooks/useAdminProducts.js` | `parseCSV`, `downloadTemplate` exported, but only used inside the file / through the hook's return value | **un-export** |
| D2 | client `hooks/useReveal.js`, `hooks/useScrolled.js` | Both named **and** default export of the same hook; only the named one is imported | **drop the default export** |
| D3 | client `hooks/usePageTitle.js` (`HOME_TITLE`, `fullTitle`), `utils/colorPalette.js` (`asColor`), `utils/storeInfo.js` (`CLOSED_LABEL`) | Internal-only | **un-export** |
| D4 | server and scripts constants exported but used only in their own file: `CSP`, `MAX_FILES`, `STATUS_LABELS`, `itemLabel`, `isHeic`, `MAX_EDGE`, `HAS_ORDERS_MESSAGE`, `WS_PATH`, `ORIGINALS_DIR`, `statusesForMethod`, `STATUSES`, `DELIVERY_METHODS`, `ALLOWED_CITIES`, `ML_FIELDS`, `WRITABLE`, `TYPES`, `KEY_BY_PATH`, `hexFor`, `urlToPath`, `seed-demo`'s `DEMO_PHONES/DEMO_REVIEWS/seedAll/clearAll` | Harmless, but they advertise a public surface that isn't one | **un-export** in the dead-code commit. Low priority |

### 2b. Server endpoints the client never calls

Admin calls through `api()` are included. Everything below is covered by tests unless noted.

| ID | Endpoint | Used by | Recommendation |
|---|---|---|---|
| D5 | `PATCH /orders/:id/status`, `PATCH /reviews/:id/approve` | nothing (duplicates of the `PUT`s; not even tested) | **delete** the two aliases. The README already documents only `PUT` |
| D6 | `POST /upload` (single) | `smoke-auth` (guard check only); the admin uses `/upload-multiple` | **delete** (route, `uploadSingle`, test row), or keep as API completeness. *Your call* |
| D7 | `GET /orders/stats`, `GET /products/categories` | tests only. The stats tab computes from the order list; the home grid uses the static category tree | **keep**: tested, cheap, documented API. Mark "API-only" in ARCHITECTURE |
| D8 | `GET/PUT /orders/:id`, `GET/PUT /reviews/:id` | tests only | **keep** (REST completeness; `PUT /orders/:id` is how a non-money field is fixed) |
| D9 | pigment formulas: `GET /:id`, `GET /code/:code`, `POST`, `PUT /:id`, `DELETE /:id` | tests only. The calculator calls only `GET /pigment-formulas`, and there's no admin pigments tab | **keep** (tested; validators enforce the light < medium < dark invariant). Document as "admin-ready, no UI yet" |
| D10 | `GET /health` | nothing in-repo | **keep**: for the hosting platform's health check |

### 2c. Unused CSS / stale comments / logs

| ID | Path | What | Recommendation |
|---|---|---|---|
| D11 | `components/_loading.css:129` `.page-loading` | No JS renders it | **delete** the rule |
| D12 | `server/services/order.service.js:115-116` | `// TODO: replace with project logger` above a `console.log` | **delete the TODO**, keep the log line (behavior unchanged). The other `console.log`s are startup/shutdown/mail-off messages and the `DB_LOG_QUERIES` logger, all intentional |
| D13 | `client/src/css/app.css:19,139,144-145,153`, `components/_product-card.css:13`, `features/category/_category-banner.css:5`, `_category-toolbar.css:6-8`, `features/home/_hero.css:5`, `features/admin/_admin-stats.css:5`, `_admin-import.css:11-13`, `features/cart/_checkout-form.css:10-12`, `features/product/_breadcrumb.css:47`, `layout/_navbar.css:88-89` | Changelog comments about deleted files (`_header.css`, `_category-themes.css`, `_products-toolbar.css`, `_product-search.css`, `_pages.css`, `_home.css`, `_catalog.css`) and removed rules ("the deleted …", "used to …") | **fix:** rewrite to present tense (why the order is what it is), and drop the history. Git has the history |
| D14 | `server/controllers/setting.controller.js:4-5` | "No service layer, like the products and reviews domains". Products already has a service, and after Phase 2 both will | **fix** (rewritten with F1–F4) |
| D15 | `server/controllers/product.controller.js:2` | "validates input, calls the model and returns a response". It also calls the service and holds the visibility rule | **fix** (rewritten with F1) |
| D16 | `.env.example` → `DELIVERY_FEE` comment | "must match the client (App.js)". The constant lives in `client/src/js/hooks/useCart.js:12` | **fix** |
| D17 | README known-issue #3 | Links `client/src/js/ProductPage.js` (now `pages/ProductPage.js`) and says validation uses `alert()`, but **no `alert(` exists in the client any more** | **fix** (in the README pass) |
| D18 | Build warnings: `components/Confetti.js:63`, `pages/ProductPage.js:147` | `react-hooks/exhaustive-deps` | **fix** where it's a real dependency. Where omission is intended, use a one-line `eslint-disable-next-line` with the reason. A clean build looks better to a reviewer |
| D19 | `client/public/manifest.json` → `shortcuts[1].url` | `"/?page=contact"`, the pre-router URL scheme | **fix** → `"/contact"` |
| D20 | README lines 58-70 | HTML-comment TODO "TO ADD THE REMAINING TWO SHOTS" | **fix** in the README pass |

The heuristic scan for **commented-out code blocks** found none in `server/`, `client/src` or `scripts/`.

---

## 3. What's committed that shouldn't be

### 3a. Large binaries

| ID | Path | Size | Evidence | Recommendation |
|---|---|---|---|---|
| B1 | `design-assets/{categories,hero,sections}/*.png/.jpg` (18 files after A2/A3) | **≈ 32 MB**, about 2/3 of the whole repo (41 MB working tree, 49 MB of blobs in history) | Source art: `npm run images:categories` reads `design-assets/categories/*.png`. The hero/section WebPs were made from the rest | **Option 1 (my pick): keep them.** They're the reproducible source of the shipped WebPs, a fresh clone can rerun the converter, and 32 MB is acceptable. **Option 2:** move them out (Drive), ignore `design-assets/**/*.png`, and note in `design-assets/categories/README.md` where they live. That shrinks the tree, not history. Either way, **no history rewrite**: the repo is public and pushed, and 49 MB doesn't justify breaking every clone |
| B2 | history only: `uploads/1773797323570.png` (347 KB), `uploads/1773797731434.png` | Early test uploads | Not in HEAD | **leave** |

The rest is small: `client/package-lock.json` 656 KB, README screenshots ≤ 316 KB each, shipped WebPs ≤ 192 KB.

### 3b. `.gitignore`

Covered: `node_modules`, `.env`, `.env.local`, `client/build/`, `uploads/*`, `uploads-originals/`,
`photos/raw/*`, `photos/processed*`, every generated list and backup under `design-assets/`, and the seed manifest.
**Not ignored** (verified with `git check-ignore`):

| ID | Pattern | Why | Recommendation |
|---|---|---|---|
| G1 | `.DS_Store`, `Thumbs.db` | OS junk (only `client/.gitignore` has `.DS_Store`) | **add** |
| G2 | `*.log`, `npm-debug.log*` | Logs at the root | **add** |
| G3 | `.vscode/`, `.idea/` | Editor folders | **add** |
| G4 | `.claude/` | The local Claude Code folder sits untracked at the root; only `settings.local.json` is ignored, and only by your *global* git config | **add** |
| G5 | `coverage/` | Root coverage output (client already ignores its own) | **add** |
| G6 | `design-assets/square-backup-*/` | Goes with A6 | **remove** the line if A6 is approved |

`docs/a11y-report.md` is generated (`npm run a11y -- --report`) but is committed on purpose as compliance
evidence. **keep**.

### 3c. `.env.example`

No real values ✓. Every variable the **server** reads (`server/config/env.js`) is listed **except**:

| ID | Variable | Default | Recommendation |
|---|---|---|---|
| E1 | `DB_LOG_QUERIES` | on outside production | **add** (README known-issue #6 already admits it's missing) |
| E2 | `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS` | 10 / 15 min | **add** |
| E3 | `CHROME_PATH` (a11y script), `TEST_PORT` (test runner) | auto / 3100 | **add** under a "tooling (optional)" heading |
| E4 | `MAIL_USER`, `MAIL_PASS` | **required even when `MAIL_ENABLED=false`** (`env.js:62-63` call `required()` unconditionally) | **fix:** require them only when mail is enabled. Then a cloner can start the app with `MAIL_ENABLED=false` and no Gmail account. Startup-config-only change, and it gets a test |

---

## 4. Dependencies

| ID | Package | Where | Evidence | Recommendation |
|---|---|---|---|---|
| P1 | `web-vitals` | client deps | depcheck + knip; `reportWebVitals.js` was deleted long ago | **remove** |
| P2 | `@testing-library/user-event` | client deps | No test imports it | **remove** |
| P3 | `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/react` | client **dependencies** | Test-only | **move to devDependencies** (`npm run build` doesn't need them) |
| P4 | `eslint-config-react-app` | depcheck "missing" | Ships inside `react-scripts` | false positive, **nothing to do** |
| P5 | root | — | depcheck: no issues. Runtime (`cors dotenv express multer nodemailer pg sharp ws`) and dev (`axe-core puppeteer-core exceljs @imgly/…`, scripts only) are correctly split | **keep** |
| P6 | root vs client duplicates | — | None: two separate apps, no shared package | — |
| P7 | root `package.json` metadata | `"description": ""`, `"author": ""`, no `engines` | Cosmetic, but it's the first file a reviewer opens | **fix:** one-line description, `"engines": { "node": ">=18" }` |

---

## 5. Architecture consistency

### 5a. Server: layers per domain

Target: **routes → validators → controllers → services → models**.

| Domain | routes | validator | controller | service | model | Where it skips or mixes |
|---|---|---|---|---|---|---|
| orders | ✓ | ✓ | ✓ | ✓ `order.service` + `pricing.service` | ✓ | **Reference shape**, nothing to change |
| products | ✓ | ✓ | ✓ | **partial** `product.service` (create/update/remove only) | ✓ | `list`, `getOne`, `categories` go controller → model. **The hidden-product visibility rule** (`active` forced unless an admin asked, 404 for hidden to non-admins) **is business logic in the controller** |
| reviews | ✓ | ✓ | ✓ | **none** | ✓ | Controller → model. **The moderation rule** (`approved: true` pinned on public list and stats; `POST` always unapproved) lives in the controller |
| pigment formulas | ✓ | ✓ | ✓ | **none** | ✓ | `update` loads the existing row in the controller so the validator can check light < medium < dark against it |
| settings | ✓ | ✓ | ✓ | **none** (documented in the controller header) | ✓ | "`value: null` deletes the row" decision is in the controller |
| auth | ✓ | **inline** in `login` | ✓ | ✓ but named `services/auth.js` | n/a (no table) | Input check inline; file-name breaks the `*.service.js` convention |
| uploads | ✓ | multer config in `middleware/upload.js` | ✓ | `image.service` called from middleware | n/a | Fine for infrastructure; **keep + document** |
| health | inline in `routes/index.js` | — | — | — | `db.assertConnection` | Fine; **keep + document** |

Also: **the pagination envelope** (`{ [key]: rows, pagination: { total, limit, offset } }` when `limit`/`offset`
are sent, flat array otherwise) is written out four times (product, review, pigment and order controllers).

**SQL placement is clean:** no SQL outside `models/`, except `config/db.js` (pool), `db/migrate.js` (runner)
and the health check. ✓

| ID | Recommendation |
|---|---|
| **F1** | *(your Phase-2 addition)* **`product.service`**: move `list` / `getOne` / `categories` into it, including the visibility rule as `listProducts({ isAdmin, …})` / `getProduct(id, { isAdmin })`. The controller becomes parse → service → respond |
| **F2** | *(your Phase-2 addition)* **`review.service`**: `listPublic`, `listAll`, `getReview`, `createReview` (always unapproved), `updateReview`, `setApproved`, `removeReview`, `publicStats`. The moderation rule moves out of the controller |
| **F3** | You said "all domains", so also **`pigmentFormula.service`** (owns "load existing → validate → update" and the 404s) and **`setting.service`** (owns "null deletes"). Both are thin, but that's what makes the chain uniform. Auth/uploads/health stay infrastructure exceptions, documented in ARCHITECTURE |
| F4 | Extract the pagination envelope to `server/utils/paginate.js`, used by all four controllers |
| F5 | Rename `services/auth.js` → `auth.service.js` and `services/realtime.js` → `realtime.service.js` (`email/` stays a folder). Move the login body check into `validators/auth.validator.js` |
| F6 | Tests: `smoke-*` already pin the HTTP behavior of every endpoint, so the refactor is checked by them. Add a **`unit-review-service`** and a **`unit-product-service`** (visibility and moderation rules, no network) in the style of `unit-order-service` |

### 5b. Client: folder meanings

**`fetch()` outside `services/`** (the admin's `api()` wrapper in `pages/admin/Admin.js` stays, as documented in `services/http.js`):

| ID | File:line | Call | Recommendation |
|---|---|---|---|
| **F7** | `hooks/useCheckoutForm.js:87` | `POST /api/orders` | **`services/orderService.js` → `createOrder()`** |
| **F7** | `pages/OrderHistory.js:42` | `GET /api/orders/by-phone/:phone` | **`orderService.getOrdersByPhone()`** |
| **F8** | `features/calculator/PaintCalculator.js:75` | `GET /api/pigment-formulas` | **`services/pigmentService.js` → `getPigmentFormulas()`** |
| F9b | `pages/AdminLogin.js:29`, `routes/AdminRoute.js:28,36` | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | **`services/authService.js`** (login/me/logout). Not part of the admin `api()` wrapper, because they run *before* or *around* the session |
| F10 | `services/reviewService.js:24,31` | `getReviews` / `getReviewStats` use raw `fetch` without an `ok` check, unlike every other service | **fix:** go through `getJson`, keeping today's fallback (`[]` / `null` on failure) so callers see no difference |

**Files in the wrong place.** `pages/` should hold only route screens, but today it holds three home-page
sections and two overlays, while two real route screens live in `features/`:

| ID | Now | What it actually is | Proposed |
|---|---|---|---|
| F11 | `pages/CategoryPage.js` | The **category grid section on the home page** (misnamed) | `features/home/CategoryGrid.js` (matches `css/features/home/_category-grid.css`) |
| F11 | `pages/FAQ.js` | A home-page section | `features/home/FAQ.js` (matches `_faq.css`) |
| F11 | `components/WhyUs.js`, `components/FeaturesBanner.js` | Home-only sections, not reusable UI | `features/home/` |
| F12 | `pages/OrderHistory.js`, `pages/Wishlist.js` | Drawers opened from the layout, not routes | `features/cart/` (matches `css/features/cart/_order-history*.css`, `_wishlist.css`) |
| F12 | `components/cart/*` (5 files) | Cart flow only | `features/cart/` |
| F13 | `features/catalog/CategoryView.js`, `ProductView.js` | **The real route screens** for `/category/:slug` and `/product/:id` (data loading, 404) | `pages/CategoryPage.js`, `pages/ProductPage.js` |
| F13 | `pages/ProductPage.js` (+ its test) | The product page **presentation**, under `ProductView` | `features/catalog/product-page/ProductDetails.js` |
| F14 | `features/catalog/categories.js` | The category tree. **Data**, imported by `components/`, `utils/`, `pages/`, the server (`server/utils/categories.js` reads it by path) and scripts | **keep where it is.** Moving it means touching the server's `SOURCE` path and two scripts for no functional gain. Document why |
| F15 | `pages/admin/*` (15 files) | The admin app | **keep** as `pages/admin/`: it's one route screen with its tabs, and the hooks live in `hooks/useAdmin*`. Documented in ARCHITECTURE |
| F16 | `features/calculator/` (JS) vs `css/features/calculators/` | Singular vs plural | **rename** JS to `features/calculators/` |

`hooks/`, `utils/`, `context/`, `routes/` are each used for one thing ✓. `components/` after F11/F12 holds
only reusable UI (Drawer, Navbar, Footer, ProductCard/List, LoadingStates, PageHeader, Reveal, …) ✓.
`utils/wishlistUtils.js` has a redundant suffix, so it could be `utils/wishlist.js`. Optional; I'd leave it.

**F17: admin lazy loading** *(your Phase-2 addition)*. `App.js` imports `AdminRoute` → `Admin` + all 14
tab files + `Confetti` + `useNewOrderChime` statically, so every shopper downloads the admin.
Plan: `const AdminRoute = lazy(() => import('./routes/AdminRoute'))` inside `<Suspense>` with the existing
`LoadingStates` spinner, for both `/admin` routes. **Baseline today: `main.js` 149.08 kB gzipped (567 KB raw),
one chunk.** CSS (29.48 kB gzipped) will **stay in one file**, because `app.css` imports every partial and the import
order *is* the cascade. Moving the admin partials into the lazy chunk would reorder rules, so I'm not doing it
here and will say so in ARCHITECTURE.

### 5c. CSS (ITCSS + `CONVENTIONS.md`)

Structure holds: `base/ layout/ components/ features/<domain>/`, one entry `app.css`, nothing loose in
`features/`. Unused selectors: only D11. Exceptions to the rules:

| ID | Path | Rule broken | Recommendation |
|---|---|---|---|
| C1 | `features/admin/_admin-products.css` (**566 lines**) | Hard ceiling 400 | **split** (e.g. list/toolbar vs card vs chips), keeping the order in `app.css` |
| C2 | `features/cart/_cart.css` (400), `_admin-form.css` (395), `_admin-order-card.css` (395) | At the ceiling | **leave**, note it |
| C3 | `_admin-form.css`, `_admin-products.css`, `features/home/_reviews.css`: 2 dark-mode blocks each; `_hero.css`, `_hero-cta.css`: 2 reduced-motion blocks each | "ONE block" | **merge**, checked with the per-(selector, property) cascade comparison from the split |
| C4 | `base/_reset.css:32` and `:49` | Two `body` rules in one file | **merge** |
| C5 | `600px` (6 files: calculators + review form), `640px` (2), `1280px` (2), `min-width: 769px` (3) | Outside the 5 named breakpoints | **keep.** CONVENTIONS §4 allows a different value when snapping would change the visual. **Add** the list of sanctioned exceptions to CONVENTIONS so it stays honest |
| C6 | `!important` | Only 2 real ones: `_accessibility.css:54` (`.visually-hidden`, commented ✓) and `_typography.css:20` (goes away with A5) | — |
| C7 | `CONVENTIONS.md` §1 table: `pages/` row | Lists "about, contact, returns, 404". `_accessibility.css` lives there too | **fix** the one line |

### 5d. Naming

Server files follow `<domain>.<layer>.js` everywhere except `services/auth.js` and `services/realtime.js` (F5).
Client components are PascalCase, hooks `useX`, and services `xService` ✓. Comment language: server/client JS is
Hebrew, CSS and CONVENTIONS are English, and each file is consistent within itself. One exception is
`base/_typography.css`, which has a Hebrew header and English body (it'll be rewritten anyway with A5).

---

## 6. Documentation (README)

| ID | Section | Problem |
|---|---|---|
| R1 | Getting started | A fresh clone **fails** (M1) and has **no products** (M2). The import step is missing; "a fresh install has products" is false. `MAIL_USER/MAIL_PASS` are silently required (E4) |
| R2 | Testing | Says "237 checks across five suites". Reality: **10 suites, 590 checks** (adds `smoke-products`, `smoke-settings`, `unit-order-service`, `unit-money`, `unit-originals`), plus **8 client suites / 53 tests** (`npm run test:client`) and `npm run a11y`. Known-issue #7 ("no automated frontend tests") is false |
| R3 | Folder structure | `services/` described as "admin authentication, email templates and transport", but it holds order/pricing/product/image/realtime. `utils/` is missing. `client/src/js/` is one line where `pages/ components/ features/ hooks/ services/ utils/ context/ routes/` each deserve one |
| R4 | Design decisions → Layered server | "route → validator → controller → model". No service layer mentioned |
| R5 | Commands | Missing `test:client`, `a11y`, `images:categories`, `products:import` (M2). `dev:client` collides on port 3000 (A11) |
| R6 | Client development | PowerShell-only `$env:PORT=3001`; becomes plain `npm run dev:client` after A11 |
| R7 | Architecture diagram | DB box lists four tables (no `settings`, no `schema_migrations`). The admin's live order feed (`ws` on `/ws`, `services/realtime.js`) isn't shown |
| R8 | Tech stack | "Tests: Node's built-in fetch, no test framework" is only half true (the client uses Jest + Testing Library). `sharp` (image processing) and `ws` are missing |
| R9 | Intro / Known issues | Numbers are stale: "406 products" (now 435 active / 438 total), "192 of 193 image references never uploaded" (152 active products now have real photos), "124 of 406 have price 0" (now 92 active). #3 `alert()` is gone (D17). #6 is fixed by E1. #7 is false (R2) |
| R10 | Screenshots | Two "coming soon" cells plus an HTML TODO (D20). The category and product pages now have photos to shoot |
| R11 | Product photos + "יום הצילומים" (≈ 250 lines, a third of the README, half in Hebrew) | An operations runbook, not what a cloner or reviewer needs first | **move** to `docs/product-photos.md` and link it |
| R12 | Missing | No link to an architecture doc (comes with `docs/ARCHITECTURE.md`); no "Accessibility" section pointing at `/accessibility`, `npm run a11y` and `docs/a11y-audit.md` |

---

## Summary: what I propose, in order

**Do immediately (outside the repo):**
1. **S1:** rotate `ADMIN_PASSWORD` and set a real `SESSION_SECRET`. **S2:** never reuse the local DB password in a deployment.

**Phase 2 commits, in this order. After each one: `npm test`, `npm run test:client`, `npm run build:client`, `npm run a11y`:**

| # | Commit | Items |
|---|---|---|
| 1 | `fix(db): create the products table for fresh databases` | M1 |
| 2 | `chore: remove unused files` | A1–A4, A6, A7 (+G6) |
| 3 | `chore: remove dead code and stale comments` | A5, D1–D5, (D6 if you want), D11–D16, D18, D19 |
| 4 | `chore: tighten .gitignore and .env.example` | G1–G5, E1–E3, E4 |
| 5 | `chore(deps): drop unused client packages, move test libs to dev` | P1–P3, P7 |
| 6 | `refactor(server): a service layer for every domain` | F1–F6 (+ unit tests) |
| 7 | `refactor(client): route all store server calls through services` | F7–F10 (+ service tests) |
| 8 | `refactor(client): one meaning per folder` | F11–F13, F16 (pure moves + import fixes) |
| 9 | `perf(client): lazy-load the admin` | F17, with the before/after bundle numbers in the message |
| 10 | `style(css): bring partials back under the conventions` | C1, C3, C4, C5-note, C7 |
| 11 | `chore(scripts): products:import and a dev:client that doesn't collide` | M2, A11 |
| 12 | `docs: ARCHITECTURE.md, README refresh, product-photos runbook` | R1–R12 |

**Leave as is, and why:** migrations 001–010 (history the DB depends on), `uploads/.gitkeep` and `photos/raw/.gitkeep`
(whitelisted on purpose), the API-only endpoints D7–D10 (tested, cheap, documented), `features/catalog/categories.js`
(F14: the server and scripts read it by path), `pages/admin/` (F15), the non-standard breakpoints (C5), the design-asset
PNGs (B1, unless you prefer option 2), and git history as is (no rewrite; rotation is the fix).

**Decisions I need from you:** D6 (delete single `/upload`?), B1 (keep the PNGs, or move them out?),
F3 (services for pigments and settings too, which I recommend), and whether F11–F13 (file moves) are in scope.
