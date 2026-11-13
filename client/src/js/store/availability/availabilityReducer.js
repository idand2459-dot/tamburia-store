/**
 * Availability reducer: which cart lines cannot be bought.
 *
 * unavailableIds are whole products (not in the catalog, out of stock, or without a price), and
 * every cart line of such a product is blocked. unavailableVariants are single variants of a
 * product that is otherwise sold ("<id>:<variant label>"), and block only the line with that
 * variant. Both are arrays, since a Set cannot be serialized; selectUnavailableLines builds the
 * Sets for the components.
 */
import { AVAILABILITY_LOADED, AVAILABILITY_CLEARED } from './availabilityActions';

export const initialAvailabilityState = { unavailableIds: [], unavailableVariants: [] };

/** True when both arrays hold the same values in the same order. */
function same(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Returns the next availability state for an action. */
export function availabilityReducer(state = initialAvailabilityState, action) {
  switch (action.type) {
    case AVAILABILITY_LOADED: {
      const variants = action.unavailableVariants || [];
      if (same(state.unavailableIds, action.unavailableIds) && same(state.unavailableVariants || [], variants)) return state;
      return { ...state, unavailableIds: action.unavailableIds, unavailableVariants: variants };
    }

    case AVAILABILITY_CLEARED:
      if (state.unavailableIds.length === 0 && !state.unavailableVariants?.length) return state;
      return { ...state, unavailableIds: [], unavailableVariants: [] };

    default:
      return state;
  }
}
