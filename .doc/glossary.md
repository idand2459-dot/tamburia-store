<!-- Template: fill in during adaptation. Keep every section heading; replace each {{...}} line. -->
# Glossary

The naming rule ([naming.md](../.claude/rules/naming.md)) requires every shared term to be defined here before it is used in code, docs, or plans.

## Purpose
- Define canonical domain terms and approved short forms used across code, docs, and plans.

## Core Terms
{{CORE_TERMS}} — the project's own terms, one bullet each, in the format `term — definition. Not synonym1, synonym2.` Not given yet: they are proposed and confirmed in Phase B (see Open Questions in [product-definition.md](product-definition.md)).

- order — a customer's request for products, with pickup or delivery; the database table `orders` (`server/services/order.service.js:65-78`). UI label: "הזמנות" (`client/src/js/pages/admin/adminConstants.js:66`). Not purchase, sale, or cart.
- delivery method — how the customer receives the order: `pickup` (self pickup) or `delivery` (`server/validators/order.validator.js:22`). UI labels: "איסוף עצמי" and "משלוח" (`client/src/js/features/cart/DeliveryOptions.js:20`, `:28`). Not shipping method.
- order status — one of `new`, `processing`, `ready_for_pickup` (pickup only), `shipped` (delivery only), `completed` (`server/validators/order.validator.js:20`, `:31-34`). UI labels: "חדשה", "בטיפול", "מוכנה לאיסוף", "נשלחה", "הושלמה" (`client/src/js/pages/admin/adminConstants.js:35-39`). Not state or stage.
- delivery area — the cities where delivery is allowed; an address outside them is rejected (`server/validators/order.validator.js:84`). UI label: "אזור המשלוח" (`client/src/js/features/cart/CheckoutFormView.js:198`).
- pick list — the order's lines that the admin ticks off as they are prepared (`picked_items`); ticking does not change the status (`server/services/order.service.js:130-137`). UI label: "רשימת ליקוט", as the list's accessible name (`client/src/js/pages/admin/PickList.js:112`). Not checklist.
- hidden product — a product with `active = false`: still in the database, but not in the store for customers (`server/services/product.service.js:5-8`). UI label: "מוסתר מהחנות" (`client/src/js/pages/admin/AdminProductCard.js:197`). Not deleted or archived.
- variant — a version of a product with its own label and price (`product.variants`); the chosen one sets the price (`server/services/pricing.service.js:62-74`). UI label: "גרסאות" (`client/src/js/components/ProductCard.js:132`). Not option or model.
- review — a customer's rating and text about the store or a product; saved as not approved until the admin approves it (`server/services/review.service.js:45-48`). UI labels: "ביקורת" (`client/src/js/features/catalog/ReviewsCarousel.js:151`) and "ביקורות" (`client/src/js/pages/admin/adminConstants.js:71`). Not comment or feedback.
- store — the single classic Redux object that holds the storefront's shared state (`cart`, `wishlist`, `availability`); built in `client/src/js/store/index.js` (phase P4R). Not context, global state.
- action — a plain object with a `type` constant and a payload that describes one thing that happened (for example `CART_ITEM_ADDED`); the only way to change the store. Not event, command.
- reducer — a pure function `(state, action) => state` that returns the next state for one domain and the same reference when nothing changes; one file per domain. Not handler.
- selector — a pure function `(state) => value` that reads or derives a value from the store (for example `selectCartCount`); components read the store only through selectors. Not getter.
- thunk — an action creator that returns a function, run by `redux-thunk`, for the two flows with side effects (`toggleWishlist`, `checkAvailability`). Not async action, saga.
- availability — which products saved in the customer's cart are no longer in the catalog (`unavailableIds`); fetched from the server by id (`client/src/js/hooks/useAvailability.js`, moved to the store in P4R). Not stock, in-stock status.

## Naming Alignment
- Keep this glossary aligned with naming decisions in [naming.md](../.claude/rules/naming.md).
- If a new domain term is introduced, add it here before broad usage.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
