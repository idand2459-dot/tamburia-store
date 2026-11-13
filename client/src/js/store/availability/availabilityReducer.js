/**
 * Availability reducer: the ids of cart products that are not in the catalog, as a sorted array
 * (a Set cannot be serialized; selectUnavailableIdSet builds one for the components).
 */
import { AVAILABILITY_LOADED, AVAILABILITY_CLEARED } from './availabilityActions';

export const initialAvailabilityState = { unavailableIds: [] };

/** True when both arrays hold the same ids in the same order. */
function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Returns the next availability state for an action. */
export function availabilityReducer(state = initialAvailabilityState, action) {
  switch (action.type) {
    case AVAILABILITY_LOADED:
      if (sameIds(state.unavailableIds, action.unavailableIds)) return state;
      return { ...state, unavailableIds: action.unavailableIds };

    case AVAILABILITY_CLEARED:
      if (state.unavailableIds.length === 0) return state;
      return { ...state, unavailableIds: [] };

    default:
      return state;
  }
}
