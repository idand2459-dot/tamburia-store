# Naming

Applies to API routes, domain entities, services, files, and data fields.
These describe the conventions already in the code; follow them, and do not rename
existing files or fields to match a different convention.

- Use the canonical term from `.doc/glossary.md`, never a synonym. Define any new shared term there before using it.
- Server files: singular entity, then the layer, camelCase for multi-word entities: `product.routes.js`, `order.controller.js`, `pigmentFormula.routes.js`.
- API paths: plural, kebab-case for multi-word: `/api/products`, `/api/pigment-formulas`.
- Client files: React components in PascalCase (`components/Drawer.js`); hooks, services and utils in camelCase (`hooks/useCart.js`, `services/productService.js`, `utils/pickList.js`); a test sits next to its file as `<name>.test.js`.
- CSS partials: an underscore and kebab-case, at the path `client/src/css/CONVENTIONS.md` gives them: `_product-card.css`.
- Data fields: database columns are snake_case (`image_url`, `in_stock`), and the API returns database records with those column names. JSON fields that are not database records, for example `imageUrls`, are camelCase, as are JavaScript variables and functions.
- Keep route and file names aligned by domain name (for example `pigmentFormula.routes.js` serves `/api/pigment-formulas`).
