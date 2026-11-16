# Portfolio demo: deployment runbook

This is the owner's runbook for putting Technic Tambur online as a **portfolio demonstration** (plan
`.plan/006-2026-11-16-p10-portfolio-demo.md`): one Node.js web service on Render (the Express API and the
React build, one origin) and a Neon PostgreSQL database that holds only fictional demo data. It is not a
commercial launch. Nothing here has been deployed yet: the application side is implemented and tested
locally, and every step below that needs an account, a dashboard or a secret is **owner-run**.

The agent that implemented this connects to nothing. It never reads an environment file and never
receives a secret; secrets exist only in the Render and Neon dashboards and in the owner's password
manager.

## How the demo is kept safe

| Risk | Protection | Where |
|---|---|---|
| The demo server touches the real database | `DEMO_MODE` starts only on a database that carries the `demo_database_marker` table with the id in `DEMO_DATABASE_ID` and state `ready`; otherwise it exits before any write | `server/api/demo/demo.service.js`, `server/server.js` |
| A normal server touches the demo database | A server without `DEMO_MODE` exits when the marker table exists | the same |
| A real database is claimed as a demo | Only `npm run demo:bootstrap` creates the marker, only on a **pristine** database, with the typed host and database name; the server never creates it | `scripts/demo-bootstrap.js`, `scripts/lib/demoTarget.js` |
| A visitor's real data is stored | Checkout accepts only three fixed fictional identities (name, phone, email and address together), and `notes` empty or one fixed text | `server/api/demo/demo.rules.js`, `order.service.js` |
| Spam and growth | At most `DEMO_MAX_VISITOR_ORDERS` visitor orders, deleted after `DEMO_ORDER_TTL_HOURS`; per-address order limits | `demo.service.js` |
| Public write access to the admin | The public admin is the read-only **viewer**: owner-only `requireAdmin` (default-deny), an explicit seven-route allowlist for reads | `server/middleware/requireAdmin.js`, `test/lib/adminRoutes.js` |
| Uploads and public reviews | `POST /api/upload-multiple` and `POST /api/reviews` answer 403 `demo_disabled` in demo mode, for every caller | `server/middleware/demoDisabled.js`, `review.service.js` |
| Real email | `MAIL_ENABLED=false` is required (set explicitly) for the server to start in demo mode | `server/config/env.js` |
| An unencrypted or unverified database link | `DB_SSL=true` verifies the certificate chain and host name; nothing disables verification | `server/config/db.js`, `unit-repo-hygiene` |

## Before you start (owner)

1. Read the current free-tier terms of **Render** and **Neon** on their official pages. The plan's numbers
   (Render free web service: spins down after 15 minutes idle, about a minute to wake, ephemeral disk;
   Neon free: compute suspends after 5 minutes idle, about 1 GB, a direct host and a pooled host) came
   from a web search on 2026-11-16 and must be re-verified. No paid plan is needed or planned.
2. Review the catalogue and pigment dosages (below). **Nothing from `uploads/`, `uploads-originals/`,
   `photos/` or `design-assets/` is ever deployed**, and the repository is public: a file committed once
   stays in the history.

## 1. Approve the catalogue (owner-run, local)

The owner approved using the existing catalogue and photographs (2026-11-16). `scripts/demo-data/catalogue-selection.json`
lists the 117 chosen real products (every sellable product with a valid photograph, plus the real products the
calculators and the admin demo need) and four reviewed subcategory reassignments; `npm run demo:catalogue`
rebuilds `catalogue.json` and `demo-assets/uploads/` from it (images are published under their content hash, so no
internal product id appears in a file name; the originals are only read). Prices are demonstration prices and
SKUs are `DEMO-###`. Review the result before committing; the steps below are only needed to change the selection.

```powershell
npm run demo:candidates          # read-only against the development database
```

This writes `design-assets/demo-candidates.csv` and `.html` (ignored by git). Open the HTML sheet, then in
the CSV mark about 36 rows with `x` in the `select` column:

- at least two per category where a photograph exists; every calculator pair covered (the sheet shows
  the gaps); three products with colours, sizes or variants; three out of stock and two hidden
  (`demo_in_stock` / `demo_active` = `0`); two with an illustrative image; no price 0;
- check every image: no person, face, vehicle, phone number, receipt, supplier catalogue page or shop
  interior, and you took it or hold the right to publish it. Any doubt: drop it;
- fill `demo_name` or `demo_description` for any row whose warnings column is not empty. The build stops
  while a row still carries a phone, URL, email, WhatsApp mention, or a supplier or address hint;
- the three paint-calculator products (ids 416, 627, 628 in the shop) keep their ids so the bundle
  works; everything else is renumbered.

```powershell
npm run demo:catalogue                              # demonstration pigment dosages (the default)
npm run demo:catalogue -- --real-pigments cream,red # publish the real dosages of these shades only
```

Review `scripts/demo-data/catalogue.json`, `scripts/demo-data/pigment-formulas.json` and
`demo-assets/uploads/`, then stage and commit them yourself. Run `npm test` first: `unit-demo-catalogue`
checks the files.

## 2. Create the demo database (owner-run)

1. In the Neon dashboard create a **new, empty** project for this purpose. Copy its **direct** connection
   URL (not the `-pooler` one: the migration advisory lock is a session lock and needs a direct
   connection).
2. In the current PowerShell session only (never in a file, a command line argument, a chat or a log):

```powershell
$env:DEMO_DATABASE_URL = '<the direct URL>'
npm run demo:bootstrap -- --confirm-host <host as in the URL> --confirm-database <database name>
```

The script refuses unless the host and database you typed equal the URL's, the database is not the
development or test database, and the database is **pristine** (nothing in it). It then claims the
database, runs the migrations and seeds it, and prints `DEMO_DATABASE_ID=<uuid>` **once**. Store that id
in Render as `DEMO_DATABASE_ID`. This run also proves that the Neon certificate verifies with Node's
default trust: if it fails with a certificate error, do not disable verification; report it (the plan's
answer is a documented CA path variable).

- Interrupted after the claim? `npm run demo:bootstrap -- --resume --database-id <id> --confirm-host
  <host> --confirm-database <name>` completes it. The server refuses a database left in `bootstrapping`.
- Refresh the curated rows later: `npm run demo:seed -- --database-id <id> --confirm-host <host>
  --confirm-database <name>`; add `--reset` to also delete every visitor order.
- Close the PowerShell window (or `Remove-Item Env:DEMO_DATABASE_URL`) afterwards.

## 3. Create the Render web service (owner-run)

New **Web Service**, connected to the GitHub repository, free instance type, one instance:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm ci --prefix client && npm run build:client && node scripts/demo-copy-images.js` |
| Start command | `npm start` |
| Health check path | none (a path that touches the database or counts as traffic would defeat the cold-start decision) |
| `NODE_VERSION` | set explicitly (Node 20 or newer; the project is tested on 24) |

The root `devDependencies` (puppeteer, background removal, exceljs) are not needed to run or build and
are skipped by a production install. Render builds with `CI=true`, which makes the client treat lint
warnings as errors: reproduce it with `$env:CI='true'; npm run build:client` before deploying.

### Environment variables

Names only; values are entered in the Render dashboard and never written to a file.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `true` |
| `DEMO_DATABASE_ID` | the id the bootstrap printed |
| `DB_HOST` | the Neon **direct** host |
| `DB_PORT` | `5432` |
| `DB_NAME` | the database name |
| `DB_USER` | the Neon role |
| `DB_PASSWORD` | the Neon role's password (secret) |
| `DB_SSL` | `true` |
| `SESSION_SECRET` | new random value, at least 32 characters (secret) |
| `ADMIN_PASSWORD` | the private owner password, at least 20 random characters (secret); never the real shop's |
| `ADMIN_URL` | `https://<your-service>.onrender.com/admin` |
| `MAIL_ENABLED` | `false` (must be set explicitly) |
| `TRUST_PROXY_HOPS` | decided by the live test below (1 or 2) |
| `ORDER_RATE_MAX` | `5` |
| `ORDER_RATE_WINDOW_MS` | `900000` |
| `REVIEW_RATE_MAX` | `5` |
| `DEMO_MAX_VISITOR_ORDERS` | `100` |
| `DEMO_ORDER_TTL_HOURS` | `72` |
| `HSTS_ENABLED` | `true` |

Leave `CORS_ORIGINS` empty and `SERVE_CLIENT` at its default. The local `.env`, the development database
and the local passwords are never reused. Rotating `SESSION_SECRET` ends every session (the revocation
method); the owner password is changed in the dashboard and redeployed; the database password is rotated
in Neon and Render together.

## 4. Live checks (owner-run, in this order)

1. The start log shows `(production)` and the database identity passed (no refusal message).
2. `curl -s https://<host>/api/health` returns `ok`; `curl -sI https://<host>/` shows
   `Strict-Transport-Security`.
3. The `docs/security.md` deployment checklist.
4. **`TRUST_PROXY_HOPS` is decided here, not assumed.** Run the three-call `RateLimit-Remaining` test and
   the forged `X-Forwarded-For` test from `docs/security.md`, set 1 or 2 accordingly and redeploy.
5. The cookie is `Secure; HttpOnly; SameSite=Strict`; product images load; the banner is on every page.
6. The viewer: "כניסה כצופה (הדגמה)" opens the admin; in the browser's network panel spot-check three
   writes (a status change, a product edit, a review delete): each is 403.
7. The owner login (password) can edit a product, and `POST /api/upload-multiple` is 403 for the owner.
8. A demo order (use the "מילוי פרטי הדגמה" button) appears in the admin, and no email arrives.

Put the results in the pull request, not the repository.

## Cold starts and limits (accepted)

A free Render instance sleeps after 15 minutes idle and takes about a minute to wake; Neon adds a short
delay on its first query. No keep-alive requests and no paid hosting are used, by decision. Rate limits
are per process and per address, so run one instance only. If the first query after a wake times out, the
5-second connection timeout in `server/config/db.js` may need a measured increase.

## Rollback

Each implementation phase is a separate change set and can be reverted on its own; with `DEMO_MODE` unset
the application behaves as the commercial store. Suspend or delete the Render service and the Neon
project from their dashboards. `demo-assets/` and `scripts/demo-data/` can be deleted without touching
`uploads/`, `uploads-originals/`, `photos/` or `design-assets/`.
