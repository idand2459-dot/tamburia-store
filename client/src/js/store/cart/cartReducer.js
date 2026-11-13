/**
 * Cart reducer: the lines of the cart and the delivery method.
 *
 * addItem treats a line as the same when id, color, size and variant all match (P7.3: the variant
 * used to be ignored, which merged two sizes of a product into one line). addBundle still matches
 * by id alone, as the old useCart hook did; that is deliberate and left for a later review.
 * The repricing matches by id and variant, as the checkout always did.
 *
 * The reducer is pure and returns the same state object when an action changes nothing, so a
 * component that selects part of the cart is not rendered again for nothing.
 */
import {
  CART_ITEM_ADDED, CART_BUNDLE_ADDED, CART_ITEM_REMOVED, CART_QUANTITY_CHANGED,
  CART_CLEARED, CART_REPRICED, DELIVERY_METHOD_SET, PRICE_CHANGES_ACKNOWLEDGED,
} from './cartActions';
import { toAgorot } from '../../utils/pricing';

export const initialCartState = { items: [], deliveryMethod: null, priceChanges: [] };

/**
 * מחזיר את העגלה עם המחירים החדשים, ואת רשימת שינויי המחיר שממתינים לאישור הלקוח.
 *
 * ההתאמה היא לפי מזהה *וגרסה*: אותו מוצר יכול לשבת בעגלה בשתי שורות
 * בשתי גרסאות במחירים שונים, והתאמה לפי מזהה בלבד הייתה נותנת לשתיהן
 * את אותו מחיר.
 *
 * שורה שהמחיר שלה באמת השתנה (באגורות) נרשמת כשינוי אחד לכל מוצר וגרסה:
 * "from" הוא המחיר שהלקוח ראה לפני השינוי הראשון שעוד לא אושר, ו-"to" הנוכחי.
 * שינוי שחזר למחיר המקורי נמחק. מחירים שלא השתנו לא נוגעים בכלום,
 * וה-state החוזר הוא אותו אובייקט.
 */
function applyPrices(state, prices) {
  let priceChanges = state.priceChanges || [];
  let changed = false;

  const items = state.items.map((item) => {
    const variant = item.selectedVariant || null;
    const match = prices.find((p) => p.id === item.id && (p.selectedVariant || null) === variant);
    if (!match || toAgorot(match.price) === toAgorot(item.price)) return item;

    changed = true;
    const pending = priceChanges.find((c) => c.id === item.id && (c.selectedVariant || null) === variant);
    const from = pending ? pending.from : item.price;
    const others = priceChanges.filter((c) => c !== pending);
    priceChanges = toAgorot(from) === toAgorot(match.price)
      ? others
      : [...others, { id: item.id, selectedVariant: variant, name: item.name, from, to: match.price }];
    return { ...item, price: match.price };
  });

  return changed ? { ...state, items, priceChanges } : state;
}

/**
 * The pending price changes that still have a line: a change belongs to a product and a variant,
 * so it stays while any line (of any colour or size) has that product and variant. Returns the
 * same array when nothing is dropped, so nothing is written for nothing.
 */
function pruneChanges(items, priceChanges) {
  if (!priceChanges || priceChanges.length === 0) return priceChanges;
  const kept = priceChanges.filter((change) => items.some(
    (item) => item.id === change.id && (item.selectedVariant || null) === (change.selectedVariant || null),
  ));
  return kept.length === priceChanges.length ? priceChanges : kept;
}

/** The state with these lines, and without the pending price changes of lines that are gone. */
function withItems(state, items) {
  const priceChanges = pruneChanges(items, state.priceChanges);
  return priceChanges === state.priceChanges ? { ...state, items } : { ...state, items, priceChanges };
}

/** Returns the next cart state for an action. */
export function cartReducer(state = initialCartState, action) {
  switch (action.type) {
    case CART_ITEM_ADDED: {
      const { product, quantity } = action;
      // The variant is part of the line: another size of the same product is another line, at its
      // own price. A line saved before variants were recorded has none, which counts as null.
      const same = (i) => i.id === product.id
        && i.selectedColor === product.selectedColor
        && i.selectedSize === product.selectedSize
        && (i.selectedVariant ?? null) === (product.selectedVariant ?? null);

      const items = state.items.some(same)
        ? state.items.map((i) => (same(i) ? { ...i, quantity: (i.quantity || 1) + quantity } : i))
        : [...state.items, { ...product, quantity }];
      return { ...state, items };
    }

    case CART_BUNDLE_ADDED: {
      let updated = [...state.items];
      for (const item of action.items) {
        const exists = updated.find((i) => i.id === item.id);
        if (exists) {
          updated = updated.map((i) => (
            i.id === item.id ? { ...i, quantity: (i.quantity || 1) + item.quantity } : i
          ));
        } else {
          updated = [...updated, { ...item, selectedColor: null }];
        }
      }
      return { ...state, items: updated };
    }

    case CART_ITEM_REMOVED: {
      if (action.index < 0 || action.index >= state.items.length) return state;
      return withItems(state, state.items.filter((_, i) => i !== action.index));
    }

    case CART_QUANTITY_CHANGED: {
      if (action.index < 0 || action.index >= state.items.length) return state;
      const items = state.items
        .map((item, i) => {
          if (i !== action.index) return item;
          const next = (item.quantity || 1) + action.delta;
          return next <= 0 ? null : { ...item, quantity: next };
        })
        .filter(Boolean);
      return withItems(state, items);
    }

    case CART_CLEARED:
      if (state.items.length === 0 && state.deliveryMethod === null && !state.priceChanges?.length) return state;
      return { items: [], deliveryMethod: null, priceChanges: [] };

    case CART_REPRICED:
      return applyPrices(state, action.prices);

    case PRICE_CHANGES_ACKNOWLEDGED:
      if (!state.priceChanges?.length) return state;
      return { ...state, priceChanges: [] };

    case DELIVERY_METHOD_SET:
      if (state.deliveryMethod === action.method) return state;
      return { ...state, deliveryMethod: action.method };

    default:
      return state;
  }
}
