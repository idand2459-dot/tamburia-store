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
 * A 409 with details.reason 'out_of_stock' means the cart holds a product that is not sold now:
 * the message is shown and the cart is checked again, which flags and blocks those lines.
 */
import { useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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

/** מנהל את טופס ההזמנה ואת שליחתה. */
export function useCheckoutForm() {
  const dispatch = useDispatch();
  const cart = useSelector(selectCartItems);
  const subtotal = useSelector(selectSubtotal);
  const deliveryFee = useSelector(selectDeliveryFee);
  const total = useSelector(selectTotal);
  const deliveryMethod = useSelector(selectDeliveryMethod);
  const pendingPriceChanges = useSelector(selectPendingPriceChanges);
  const unavailableLines = useSelector(selectUnavailableLines);
  const availabilityKey = useSelector(selectAvailabilityKey);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState('');

  /** מנקה את תוצאת השליחה, כדי שפתיחה הבאה של העגלה תתחיל מחדש. */
  const clearOrderSuccess = useCallback(() => {
    setOrderSuccess(null);
    setOrderError('');
  }, []);

  /** שולח את ההזמנה לשרת. הסכומים מחושבים מחדש בשרת. */
  const handlePlaceOrder = useCallback(async () => {
    if (!customerName || !customerPhone) return;
    if (deliveryMethod === 'delivery' && !deliveryAddress) return;
    if (pendingPriceChanges.length > 0 || cart.some((item) => isLineUnavailable(unavailableLines, item))) return;

    setSubmittingOrder(true);
    setOrderError('');
    const order = {
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
    let saved;
    try {
      saved = await createOrder(order);
    } catch (error) {
      setSubmittingOrder(false);

      if (!(error instanceof ApiError)) {
        // תקלת רשת, או תשובה שאינה JSON. בלי זה הספינר היה נתקע לנצח.
        setOrderError('לא הצלחנו לשלוח את ההזמנה. בדקו את החיבור ונסו שוב.');
        return;
      }

      setOrderError(error.message);

      // 409 הוא המקרה היחיד שבו לתשובה יש מה להוסיף לעגלה ולא רק
      // למסך: המחירים העדכניים, כדי שהסכום שמוצג יתיישר עם מה שהשרת
      // יקבל בפעם הבאה.
      if (error.status === 409 && Array.isArray(error.details?.prices)) {
        dispatch(repriceCart(error.details.prices));
      } else if (error.status === 409 && error.details?.reason === 'out_of_stock') {
        dispatch(checkAvailability(availabilityKey));
      }
      return;
    }

    setSubmittingOrder(false);
    setOrderSuccess(saved);
    dispatch(clearCart());
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setDeliveryAddress(''); setOrderNotes('');
  }, [
    cart, subtotal, deliveryFee, total, deliveryMethod,
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    pendingPriceChanges, unavailableLines, availabilityKey, dispatch,
  ]);

  return useMemo(() => ({
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
    submittingOrder, handlePlaceOrder,
    orderSuccess, clearOrderSuccess, orderError,
  }), [
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    submittingOrder, handlePlaceOrder, orderSuccess, clearOrderSuccess, orderError,
  ]);
}
