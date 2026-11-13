/**
 * Cart reducer: the lines of the cart and the delivery method.
 *
 * The merge rules are the ones the old useCart hook (removed in P4R) had, copied unchanged: addItem treats a line
 * as the same when id, color and size match (the variant is not part of it), and addBundle matches
 * by id alone. The repricing matches by id and variant, as the checkout always did.
 *
 * The reducer is pure and returns the same state object when an action changes nothing, so a
 * component that selects part of the cart is not rendered again for nothing.
 */
import {
  CART_ITEM_ADDED, CART_BUNDLE_ADDED, CART_ITEM_REMOVED, CART_QUANTITY_CHANGED,
  CART_CLEARED, CART_REPRICED, DELIVERY_METHOD_SET,
} from './cartActions';

export const initialCartState = { items: [], deliveryMethod: null };

/**
 * מחזיר את העגלה עם המחירים שהשרת החזיר.
 *
 * ההתאמה היא לפי מזהה *וגרסה*: אותו מוצר יכול לשבת בעגלה בשתי שורות
 * בשתי גרסאות במחירים שונים, והתאמה לפי מזהה בלבד הייתה נותנת לשתיהן
 * את אותו מחיר.
 */
function applyPrices(cart, prices) {
  return cart.map((item) => {
    const match = prices.find((p) => p.id === item.id
      && (p.selectedVariant || null) === (item.selectedVariant || null));
    return match ? { ...item, price: match.price } : item;
  });
}

/** Returns the next cart state for an action. */
export function cartReducer(state = initialCartState, action) {
  switch (action.type) {
    case CART_ITEM_ADDED: {
      const { product, quantity } = action;
      const same = (i) => i.id === product.id
        && i.selectedColor === product.selectedColor
        && i.selectedSize === product.selectedSize;

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
      return { ...state, items: state.items.filter((_, i) => i !== action.index) };
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
      return { ...state, items };
    }

    case CART_CLEARED:
      if (state.items.length === 0 && state.deliveryMethod === null) return state;
      return { items: [], deliveryMethod: null };

    case CART_REPRICED:
      return { ...state, items: applyPrices(state.items, action.prices) };

    case DELIVERY_METHOD_SET:
      if (state.deliveryMethod === action.method) return state;
      return { ...state, deliveryMethod: action.method };

    default:
      return state;
  }
}
