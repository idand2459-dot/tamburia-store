# CSS conventions — Technic Tambur

These rules apply to every CSS change in this project from now on.
Every redesign step must follow them. If a step's instructions conflict
with these rules, follow these rules and say so in the report.

## 1. One partial = one component
- Each partial owns one component or one page section, and is named
  after it: `_hero.css`, `_ticker.css`, `_product-card.css`,
  `_category-grid.css`, `_faq.css`.
- ITCSS folders stay: `base/` (tokens, reset, typography),
  `layout/` (page skeleton: navbar, footer, grid/containers),
  `components/` (reusable UI used in many places: buttons, modals,
  reveal, product card), `features/` (page- or feature-specific
  sections).
- **`features/` is grouped by domain, one subfolder per domain.** A
  feature partial lives in the folder for the thing it belongs to, and
  nothing sits loose in `features/` itself:

  | folder | what it holds |
  |---|---|
  | `admin/` | the admin panel, one partial per tab or control, plus the admin login |
  | `home/` | the home page's bands, top to bottom |
  | `calculators/` | the paint and project calculators |
  | `category/` | a category page: banner, layout, filters, toolbar |
  | `product/` | a product page, outermost first |
  | `cart/` | the cart flow, the order lookup and the wishlist |
  | `reviews/` | the review form, opened from both the home page and a product page |
  | `pages/` | the static pages: about, contact, returns, 404 |

  A partial that belongs to a new domain gets a **new folder**, not a
  loose file at the top of `features/`. A partial shared by two domains
  goes in the folder of the domain that owns the component, or in its own
  folder when neither does (that is why `reviews/` exists) — and if it is
  reusable UI rather than a feature, it belongs in `components/`.
- When a component is redesigned, it gets its own partial. New rules are
  never appended to a large shared file.

## 2. File size
- Target: **≤ 300 lines** per partial. Hard ceiling: **400**.
- Above that, split by sub-component (e.g. `_admin.css` →
  `_admin-layout.css`, `_admin-orders.css`, `_admin-products.css`, …).

## 3. Order inside every partial (always the same)
```
/* ==========================================================
   <Component name> — one line on what it is
   ========================================================== */

1. Block        .product-card { … }
2. Elements     .product-card__image, .product-card-title … (top to bottom as they appear on screen)
3. States       :hover, :focus-visible, .is-active, .is-disabled, .is-visible
4. Variants     .product-card--compact …
5. Animations   @keyframes used only by this component
6. Responsive   ONE block per breakpoint, at the end, largest → smallest
7. Dark mode    ONE @media (prefers-color-scheme: dark) block
8. Reduced motion  ONE @media (prefers-reduced-motion: reduce) block
```
- **No media queries scattered through the file.** All rules for a
  breakpoint live in that breakpoint's single block at the bottom.
- No duplicate selectors in the same file (merge them).
- No `!important` unless overriding a third-party style — and then with
  a comment explaining why.

## 4. Breakpoints (use only these)
| Name | Query |
|------|-------|
| xl   | `(max-width: 1200px)` |
| lg   | `(max-width: 900px)` |
| md   | `(max-width: 768px)` |
| sm   | `(max-width: 560px)` |
| xs   | `(max-width: 430px)` |

(CSS variables can't be used inside `@media`, so these are a convention,
documented in a comment at the top of `base/_variables.css`.)
If an existing rule uses a different value (e.g. 768, 860, 480), map it
to the nearest one **only if the visual result doesn't change**; if it
would, keep the original value and note it.

## 5. Colors and values
- Colors come from tokens in `base/_variables.css` (`var(--color-…)`).
  New literal hex values only inside a token definition.
- Colors that need transparency: each such brand color also gets an
  RGB-triple token, e.g. `--color-navy-950-rgb: 7, 11, 20;`, used as
  `rgba(var(--color-navy-950-rgb), 0.94)`. No literal `rgba(7, 11, 20, …)`.
- Plain white and black are exempt from that rule: they are not brand
  colors, they never change, and `rgba(255, 255, 255, 0.1)` reads more
  clearly than the token form.
- Spacing, radii, shadows, transitions: tokens where one exists.

## 6. No dead code
- When a step replaces styles, it deletes the old ones in the same
  commit.
- A selector with no matching class in any JSX file is dead — remove it
  (verify with a search across `client/src/js/` first).

## 7. Imports
- `app.css` only imports; no rules in it.
- Import order = cascade order. New partials go in the right ITCSS block,
  at the path their domain folder gives them (§1). A partial that must
  override another is imported after it, with a one-line comment saying
  why.
- Grouping `features/` into folders did **not** reorder the imports, and
  neither should a later move: cascade order is behaviour. Files from one
  folder are deliberately non-adjacent in `app.css` where the cascade
  needs them apart, and the comments there say why.
