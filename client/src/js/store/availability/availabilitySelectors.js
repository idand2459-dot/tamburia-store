/**
 * Availability selectors.
 */

/* התקרה של פרמטר ids בשרת. עגלה או רשימת מועדפים לא מגיעות לשם
   בפועל; מעבר לזה פשוט לא נבדק, וזו אותה נפילה-לטובה של כישלון רשת. */
const MAX_IDS = 100;

/**
 * The ids to ask the server about, as the string the request needs: the first 100 distinct ids of
 * the cart lines, sorted. The key is a string, not an array, so that an unchanged cart gives an
 * equal value and the effect that checks availability does not run again on every keystroke.
 */
export const selectAvailabilityKey = (state) => (
  [...new Set(state.cart.items.map((item) => item.id).filter(Boolean))]
    .slice(0, MAX_IDS).sort((a, b) => a - b).join(',')
);

export const selectUnavailableIds = (state) => state.availability.unavailableIds;

// The same array always gives the same Set, so a component that selects it is not rendered again
// for a new object with the same content.
let lastIds = null;
let lastSet = null;

/** The unavailable ids as a Set (what the cart screens call `.has` on). */
export const selectUnavailableIdSet = (state) => {
  const ids = state.availability.unavailableIds;
  if (ids !== lastIds) {
    lastIds = ids;
    lastSet = new Set(ids);
  }
  return lastSet;
};

const NO_VARIANTS = [];
let linesIds = null;
let linesVariants = null;
let lastLines = null;

/** The key of a cart line's variant in unavailableVariants. */
export const variantKey = (id, selectedVariant) => `${id}:${selectedVariant}`;

/**
 * What blocks cart lines, as Sets: { ids, variants }. The same arrays always give the same object.
 * Use isLineUnavailable to ask about one line.
 */
export const selectUnavailableLines = (state) => {
  const { unavailableIds: ids, unavailableVariants: variants = NO_VARIANTS } = state.availability;
  if (ids !== linesIds || variants !== linesVariants || lastLines === null) {
    linesIds = ids;
    linesVariants = variants;
    lastLines = { ids: new Set(ids), variants: new Set(variants) };
  }
  return lastLines;
};

/** Whether this cart line cannot be bought: its product is blocked, or its own variant is. */
export const isLineUnavailable = (lines, item) => lines.ids.has(item.id)
  || (Boolean(item.selectedVariant) && lines.variants.has(variantKey(item.id, item.selectedVariant)));
