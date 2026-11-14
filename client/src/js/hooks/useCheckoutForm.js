/**
 * טופס ההזמנה: פרטי הלקוח, השליחה לשרת ומסך התודה.
 *
 * The cart is not held here: its lines, totals and delivery method are read from the Redux store
 * (the store is the single owner), and a successful order empties it through the same store. The
 * form fields themselves are React state of whoever calls this hook (StoreLayout), because they
 * must outlive the cart drawer, which unmounts when it is closed.
 *
 * הסכומים והמחירים נשלחים לשרת כדי שיהיה מה להשוות אליו, לא כדי
 * שיישמרו: השרת שולף את המחיר של כל פריט מהקטלוג, מחשב מהם את
 * הסכומים, ומתעלם ממה שהגיע בגוף הבקשה.
 *
 * מכאן גם הטיפול ב-409. מחיר שהשתנה בזמן שהמוצר שכב בעגלה אינו תקלה
 * ואינו ניסיון רמייה, אבל הוא כן אומר שהלקוח עומד לאשר סכום אחר ממה
 * שהוא רואה. השרת דוחה, מחזיר את המחירים העדכניים ב-details, והעגלה
 * מתקנת את עצמה כאן — כך שהניסיון השני כבר מציג את הסכום הנכון.
 * The repricing itself (matching by id and variant) is the cart reducer's CART_REPRICED, which also
 * records the change for the customer to acknowledge; the order is not sent while one is pending,
 * nor while a cart line is unavailable (the same blockers the cart step shows), so opening the
 * checkout directly cannot skip them.
 *
 * A 409 with details.reason 'out_of_stock' or 'option_unavailable' means the cart holds a line that
 * is not sold now: the message is shown and the cart is checked again, which flags and blocks it.
 *
 * ── An order that may or may not have been created ──
 * Every submission carries a request_id, and the exact body that was sent is kept with it in
 * localStorage (store/persistence.js) from just before the request leaves. The server creates at
 * most one order per request_id, so sending that same body again is always safe.
 *
 * The body holds the customer's details, so it is kept for 48 hours at most, counted from the
 * first submission (submittedAt is set once and every resend stores the same value). Then the
 * details are removed and only an "expired" record stays: the request_id, when it was sent, the
 * item count and the total. See the next bullets.
 *   - The attempt is removed once the outcome is known: the order was created (also when the server
 *     answers a retry with the original), or the server refused it with a 4xx, which proves that no
 *     order was created. A 429 is not such a refusal: see below.
 *   - It is kept when the outcome is unknown: a timeout, a network failure, a 5xx or an answer that
 *     is not JSON. Within 48 hours only the customer's own decision resolves it.
 *   - After 48 hours the order cannot be sent again: nothing is left to send, and the notice says the
 *     outcome is unknown and sends the customer to the store. Nothing is sent by itself, no new
 *     request_id is made, and a new order stays blocked until the customer cancels the notice. The
 *     time is checked when the page loads, before every send (also from another tab's record), and
 *     by one timer set for the due time, so a page that stays open loses the details on time too;
 *     a browser that was closed is covered by the check on load.
 *   - It is kept on a 429 too (the rate limit), with the server's message shown. The limit refuses
 *     a request without looking at it, so it does not tell whether an earlier send of this order
 *     was saved. The customer sends the same attempt again later; nothing retries by itself.
 *   - While one is kept a new order cannot be sent. The customer chooses between sending the
 *     original again (retryPendingOrder) and cancelling it (cancelPendingOrder), whose
 *     confirmation warns that an order may be duplicated. Nothing here ever makes a new request_id
 *     for an order that may already exist.
 *   - A 422 means the server holds an order under this id that differs from the body, which the
 *     verbatim resend should never cause. The attempt is kept, flagged as a conflict, and only
 *     cancelling is offered.
 * When localStorage cannot hold the attempt it still works in memory, and the message then does
 * not promise that a reload is safe.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { createOrder, ApiError } from '../services/orderService';
import { clearCart, repriceCart } from '../store/cart/cartActions';
import {
  selectCartItems, selectSubtotal, selectDeliveryFee, selectTotal, selectDeliveryMethod,
  selectPendingPriceChanges,
} from '../store/cart/cartSelectors';
import { checkAvailability } from '../store/availability/availabilityActions';
import {
  selectAvailabilityKey, selectUnavailableLines, isLineUnavailable,
} from '../store/availability/availabilitySelectors';
import { newRequestId } from '../utils/requestId';
import {
  readCheckoutAttempt, writeCheckoutAttempt, clearCheckoutAttempt, expireCheckoutAttempt,
  isCheckoutAttemptDue, CHECKOUT_ATTEMPT_RETENTION_MS,
} from '../store/persistence';

const UNCERTAIN_SAVED = 'לא קיבלנו אישור מהשרת, וייתכן שההזמנה כבר התקבלה. '
  + 'אפשר לשלוח אותה שוב: לא תיווצר הזמנה כפולה, גם אחרי רענון הדף.';
const UNCERTAIN_UNSAVED = 'לא קיבלנו אישור מהשרת, וייתכן שההזמנה כבר התקבלה. '
  + 'אפשר לשלוח אותה שוב: לא תיווצר הזמנה כפולה. אל תרעננו ואל תסגרו את הדף עד שנקבל אישור, '
  + 'כי לא הצלחנו לשמור את ההזמנה במכשיר.';
/** Added after the server's own text when it refused the order because of the rate limit (429). */
const RATE_LIMITED_HINT = 'אפשר לשלוח את אותה הזמנה שוב בעוד כמה דקות: לא תיווצר הזמנה כפולה.';
const CANNOT_START ='לא ניתן לשלוח הזמנה בדפדפן הזה. נסו דפדפן אחר או התקשרו לחנות.';

/** Whether the cart lines are the lines of the order body that was sent (the same products, options and counts). */
function sameLines(cartItems, sentItems) {
  return cartItems.length === sentItems.length && cartItems.every((item, i) => {
    const sent = sentItems[i];
    return item.id === sent.id
      && (item.selectedVariant || null) === (sent.selectedVariant || null)
      && (item.selectedColor || null) === (sent.selectedColor || null)
      && (item.selectedSize || null) === (sent.selectedSize || null)
      && (item.quantity || 1) === sent.quantity;
  });
}

/** The in-memory state of an attempt read from storage: it is stored, and not in conflict. */
function fromStored(stored) {
  return { ...stored, persisted: true, conflict: false };
}

/** What the customer needs to recognise an unresolved order: when, how many items, how much. */
function summaryOf(pending) {
  if (!pending) return null;
  const { body, submittedAt, persisted, conflict } = pending;
  if (pending.expired) {
    // No body any more: the counts were kept in the record when the details were removed.
    return { submittedAt, itemCount: pending.itemCount, total: pending.total, persisted, conflict: false, expired: true };
  }
  return {
    submittedAt,
    itemCount: body.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    total: body.total,
    persisted,
    conflict,
  };
}

/** מנהל את טופס ההזמנה ואת שליחתה. */
export function useCheckoutForm() {
  const dispatch = useDispatch();
  const store = useStore();
  const cart = useSelector(selectCartItems);
  const subtotal = useSelector(selectSubtotal);
  const deliveryFee = useSelector(selectDeliveryFee);
  const total = useSelector(selectTotal);
  const deliveryMethod = useSelector(selectDeliveryMethod);
  const pendingPriceChanges = useSelector(selectPendingPriceChanges);
  const unavailableLines = useSelector(selectUnavailableLines);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [cartKeptAfterOrder, setCartKeptAfterOrder] = useState(false);

  // The unresolved attempt, read once when the page loads; see the header. The ref is what the
  // handlers read, since a second click can arrive before React has rendered the first one.
  const [pending, setPending] = useState(() => {
    const stored = readCheckoutAttempt();
    return stored && fromStored(stored);
  });
  const pendingRef = useRef(pending);
  const inFlight = useRef(false);

  /** Keeps the state and the ref in step. */
  const setPendingAttempt = useCallback((next) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  /**
   * Ends the retention of the unresolved order when its 48 hours are up: the details leave the
   * state and the storage, and the expired record takes their place. Returns the attempt as it is
   * now (null when there is none). A request that is in flight is left alone; the code that
   * settles it calls this again when it keeps the attempt.
   */
  const expireIfDue = useCallback(() => {
    const current = pendingRef.current;
    if (!current || current.expired || inFlight.current) return current;
    if (!isCheckoutAttemptDue(current.submittedAt)) return current;
    const { record, stored } = expireCheckoutAttempt(current);
    const next = { ...record, persisted: stored, conflict: false };
    setPendingAttempt(next);
    return next;
  }, [setPendingAttempt]);

  // One timer, set for the moment the details are due to go, so a page that stays open does not
  // keep them. It is cleared when the attempt changes or the component unmounts.
  useEffect(() => {
    if (!pending || pending.expired) return undefined;
    const wait = pending.submittedAt + CHECKOUT_ATTEMPT_RETENTION_MS - Date.now();
    const timer = setTimeout(expireIfDue, Math.min(Math.max(wait, 0), 2_000_000_000));
    return () => clearTimeout(timer);
  }, [pending, expireIfDue]);

  /** מנקה את תוצאת השליחה, כדי שפתיחה הבאה של העגלה תתחיל מחדש. */
  const clearOrderSuccess = useCallback(() => {
    setOrderSuccess(null);
    setOrderError('');
    setCartKeptAfterOrder(false);
  }, []);

  /**
   * Sends an attempt (a first submission, or the original one again) and settles it by what came
   * back. The attempt is stored before the request leaves, so closing the tab mid-request leaves
   * something to recover.
   */
  const sendAttempt = useCallback(async (attempt) => {
    inFlight.current = true;
    setSubmittingOrder(true);
    setOrderError('');

    const persisted = writeCheckoutAttempt(attempt);
    const current = { ...attempt, persisted, conflict: false };
    setPendingAttempt(current);

    let saved;
    try {
      saved = await createOrder(attempt.body);
    } catch (error) {
      inFlight.current = false;
      setSubmittingOrder(false);

      // A 429 is the rate limit refusing this request before it was looked at. It says nothing
      // about an earlier send of the same order (one that timed out may have been saved), so the
      // attempt stays exactly as it was: same body, same request_id. Nothing is sent again by
      // itself; the customer sends it again by hand, later, from the unresolved-order notice.
      if (error instanceof ApiError && error.status === 429) {
        setOrderError(`${error.message} ${RATE_LIMITED_HINT}`);
        expireIfDue();
        return;
      }

      // The server refused: for a 4xx it never created the order, so the attempt is over. 408 is
      // the exception, since a proxy may send it for a request the server did receive.
      const refused = error instanceof ApiError && error.status < 500 && error.status !== 408;
      if (!refused) {
        // Timeout, network failure, 5xx or an answer that is not JSON: unknown. Keep the attempt.
        setOrderError(persisted ? UNCERTAIN_SAVED : UNCERTAIN_UNSAVED);
        expireIfDue();
        return;
      }

      setOrderError(error.message);

      if (error.status === 422) {
        // The server holds a different order under this id: keep the attempt, offer only cancel.
        setPendingAttempt({ ...current, conflict: true });
        expireIfDue();
        return;
      }

      clearCheckoutAttempt();
      setPendingAttempt(null);

      // 409 is the case where the answer has something to add to the cart and not only to the
      // screen: the current prices, so the total shown matches what the server will accept.
      if (error.status === 409 && Array.isArray(error.details?.prices)) {
        dispatch(repriceCart(error.details.prices));
      } else if (error.status === 409
        && (error.details?.reason === 'out_of_stock' || error.details?.reason === 'option_unavailable')) {
        dispatch(checkAvailability(selectAvailabilityKey(store.getState())));
      }
      return;
    }

    inFlight.current = false;
    setSubmittingOrder(false);
    clearCheckoutAttempt();
    setPendingAttempt(null);
    setOrderSuccess(saved);

    // The cart is emptied only if it is still the order that was sent: when the customer changed it
    // while an earlier order was unresolved, what is in it now is a new draft, not this order.
    if (sameLines(store.getState().cart.items, attempt.body.items)) {
      dispatch(clearCart());
      setCartKeptAfterOrder(false);
      setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
      setDeliveryAddress(''); setOrderNotes('');
    } else {
      setCartKeptAfterOrder(true);
    }
  }, [dispatch, store, setPendingAttempt, expireIfDue]);

  /** שולח את ההזמנה לשרת. הסכומים מחושבים מחדש בשרת. */
  const handlePlaceOrder = useCallback(async () => {
    if (inFlight.current) return;
    if (!customerName || !customerPhone) return;
    if (deliveryMethod === 'delivery' && !deliveryAddress) return;
    if (pendingPriceChanges.length > 0 || cart.some((item) => isLineUnavailable(unavailableLines, item))) return;

    // An earlier order is unresolved (perhaps stored by another tab): a new one is not sent. Reading
    // the storage and checking the one in memory also end the retention of one that ran out.
    const unresolved = readCheckoutAttempt();
    const inMemory = expireIfDue();
    if (unresolved || inMemory) {
      if (unresolved && !inMemory) setPendingAttempt(fromStored(unresolved));
      return;
    }

    let requestId;
    try {
      requestId = newRequestId();
    } catch {
      setOrderError(CANNOT_START);
      return;
    }

    const body = {
      request_id: requestId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      delivery_method: deliveryMethod,
      delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : null,
      notes: orderNotes,
      items: cart.map((i) => ({
        id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1,
        // תווית הגרסה נוסעת לשרת: היא מה שקובע מאיזו גרסה יילקח המחיר,
        // ובלעדיה לא היה לו איך לתמחר מוצר עם גרסאות
        selectedVariant: i.selectedVariant || null,
        selectedColor: i.selectedColor || null, selectedSize: i.selectedSize || null,
      })),
      subtotal, delivery_fee: deliveryFee, total,
    };

    // הזמנה שנדחתה אינה מרוקנת את העגלה ואינה מציגה מסך תודה. קודם
    // הכול קרה ללא תנאי, כך שדחייה בשרת נראתה ללקוח כהצלחה והעגלה
    // שלו נמחקה — אובדן נתונים שנראה כמו הזמנה שהתקבלה.
    await sendAttempt({ requestId, body, submittedAt: Date.now() });
  }, [
    cart, subtotal, deliveryFee, total, deliveryMethod,
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    pendingPriceChanges, unavailableLines, sendAttempt, setPendingAttempt, expireIfDue,
  ]);

  /**
   * Sends the unresolved order again, exactly as it was sent the first time: the same body, the same
   * request_id and the same submittedAt. An order whose 48 hours are up has no body and is not sent.
   */
  const retryPendingOrder = useCallback(async () => {
    if (inFlight.current) return;
    let attempt = expireIfDue();
    if (!attempt) {
      const stored = readCheckoutAttempt();
      if (!stored) return;
      attempt = fromStored(stored);
      setPendingAttempt(attempt);
    }
    if (attempt.expired || attempt.conflict || !attempt.body) return;
    await sendAttempt({ requestId: attempt.requestId, body: attempt.body, submittedAt: attempt.submittedAt });
  }, [sendAttempt, expireIfDue, setPendingAttempt]);

  /** Drops the unresolved order. The caller has shown the duplicate warning. */
  const cancelPendingOrder = useCallback(() => {
    if (inFlight.current) return;
    clearCheckoutAttempt();
    setPendingAttempt(null);
    setOrderError('');
  }, [setPendingAttempt]);

  const pendingOrder = useMemo(() => summaryOf(pending), [pending]);

  return useMemo(() => ({
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
    submittingOrder, handlePlaceOrder,
    pendingOrder, retryPendingOrder, cancelPendingOrder,
    orderSuccess, clearOrderSuccess, orderError, cartKeptAfterOrder,
  }), [
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    submittingOrder, handlePlaceOrder, pendingOrder, retryPendingOrder, cancelPendingOrder,
    orderSuccess, clearOrderSuccess, orderError, cartKeptAfterOrder,
  ]);
}
