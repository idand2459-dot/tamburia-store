# Product Definition

## Purpose
The online store of Technic Tambur, a hardware shop: a public storefront for its customers and an admin side for the shop owner.

## Product Vision
A complete, realistic online store for the shop, finished and checked as it exists in the code today.

## Problem Statement
The shop needs a website that works like a real online store: customers browse products by category, add them to a cart, choose self pickup or delivery, place an order, and get a confirmation by email; the owner manages products, orders, and reviews.

## Value Proposition
- {{VALUE_POINT}} — one bullet per benefit: a bold lead-in, then one sentence.

## Product Scope
- In scope (version 1 is the store as it exists in the code today, finished and checked, not extended). Each item is per README.md, not yet verified against the code:
  - S1 — Catalogue browsing by category and subcategory, with search, sorting, and stock status (`README.md:56`).
  - S2 — Product pages: image gallery, colour, size and variant selection, product reviews (`README.md:57`).
  - S3 — A cart kept in `localStorage`, pickup or delivery, with a delivery-area check (`README.md:58`).
  - S4 — Wishlist, recently viewed products, and order lookup by phone number (`README.md:59`).
  - S5 — Reviews of the store and of products; the home-page rating comes from approved reviews only (`README.md:60-61`).
  - S6 — Every page, filter, and modal has its own URL and survives a refresh (`README.md:62`).
  - S7 — An accessibility statement at `/accessibility` (`README.md:63`).
  - S8 — Paint calculator: walls minus openings, times coats, converted to litres and containers; 20 pigment shades with a live preview (`README.md:66-69`).
  - S9 — Project calculator: four job types that expand into a product checklist; both calculators add everything to the cart in one action (`README.md:70-71`).
  - S10 — Admin panel with six tabs, each with its own URL: statistics, orders, products, add/edit, CSV import, review moderation (`README.md:74-75`).
  - S11 — A live order feed over WebSocket, with a chime (`README.md:76`).
  - S12 — Product management with up to 5 images per product, processed to square WebP; products are hidden, not deleted (`README.md:77-79`).
  - S13 — Bulk CSV import with a preview and per-row validation (`README.md:80`).
  - S14 — Order status changes that email the customer automatically (`README.md:81`).
  - S15 — A pick list in every order, saved per line on the server (`README.md:82-84`).
  - S16 — Review moderation: nothing is published before approval (`README.md:85`).
  - S17 — The admin code is lazy-loaded, never downloaded by shoppers (`README.md:86`).
  - S18 — Three emails: a new-order alert to the store, an order confirmation to the customer, a status-change update (`README.md:89-90`).
- Out of scope:
  - Anything that needs the store to be live: hosting, a real domain, and real customers. The project is not launched and runs locally only.
  - Real payments: the code has none; customers pay in cash or by card at pickup or on delivery (`client/src/js/features/home/FAQ.js:23`).

## Target Users
- Primary users: the shop's customers, using the public storefront.
- Secondary users: the shop owner, using the admin side to manage products, orders, and reviews.

## Acceptance Criteria
Each criterion must be provable by a test. Number them `AC01`, `AC02`, and so on.

- AC01 — Running locally, a customer completes an order with delivery, the order appears in the admin side, and the confirmation email is written to the server log with `MAIL_ENABLED=false`. A real send through Gmail is not part of AC01. No automated test proves it yet (see Open Questions).

## Open Questions
- Everything else about version 1 is not decided yet.
- Value proposition: not given yet; `{{VALUE_POINT}}` is kept until it is.
- README may be outdated; verify S1-S18 against the code in Phase B and list any feature that is missing or extra.
- AC01 (a customer completes an order with delivery) has no automated test.
- No script writes to a remote database or to cloud storage today; when one is added, it gets a deny pattern in the same commit (`AGENTS.md`, Guardrails).
- Project terms for `.doc/glossary.md` are not given yet; they are proposed and confirmed in Phase B.
