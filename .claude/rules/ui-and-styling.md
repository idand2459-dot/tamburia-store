# UI and Styling

## Libraries
- `lucide-react` for icons — reuse the same icon for the same concept across features.
- There is no toast library. Do not add one without the owner's decision.

## Styling
- `client/src/` is styled with plain CSS, split into ITCSS partials under `client/src/css/`.
- `client/src/css/CONVENTIONS.md` is the CSS rulebook: one partial per component, folder per domain, file size, order inside a partial, breakpoints, and imports. Follow it; do not restate it here.
- `client/src/css/app.css` only imports partials, and its import order is the cascade. Never reorder it.
- Inline `style` only for values computed at runtime (a colour from data, a delay, a percentage), preferably as a CSS custom property (`style={{ '--pick-done': … }}`). Static styling belongs in a partial.

## Design tokens
- Colors and shared values are tokens in `client/src/css/base/_variables.css`; a new literal hex value appears only inside a token definition.
