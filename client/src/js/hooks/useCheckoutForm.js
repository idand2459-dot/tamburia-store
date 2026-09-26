/**
 * טופס ההזמנה: פרטי הלקוח, השליחה לשרת ומסך התודה.
 *
 * מקבל את מצב העגלה כארגומנט ולא מחזיק עותק משלו — הסכומים והפריטים
 * שייכים ל-useCart, וכפילות שלהם כאן הייתה יכולה להיפרד ממנו. בסיום
 * הזמנה מוצלחת הטופס גם מרוקן את העגלה, ולכן הוא צריך את הסטרים שלה.
 *
 * הסכומים נשלחים לשרת לצורך תיעוד בלבד — השרת מחשב אותם מחדש מתוך
 * הפריטים ומתעלם ממה שהגיע בגוף הבקשה.
 */
import { useState, useMemo, useCallback } from 'react';

/** מנהל את טופס ההזמנה ואת שליחתה. */
export function useCheckoutForm(cartState) {
  const {
    cart, subtotal, deliveryFee, total,
    deliveryMethod, setCart, setDeliveryMethod,
  } = cartState;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  /** מנקה את מסך התודה, כדי שפתיחה הבאה של העגלה תתחיל מחדש. */
  const clearOrderSuccess = useCallback(() => setOrderSuccess(null), []);

  /** שולח את ההזמנה לשרת. הסכומים מחושבים מחדש בשרת. */
  const handlePlaceOrder = useCallback(async () => {
    if (!customerName || !customerPhone) return;
    if (deliveryMethod === 'delivery' && !deliveryAddress) return;

    setSubmittingOrder(true);
    const order = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      delivery_method: deliveryMethod,
      delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : null,
      notes: orderNotes,
      items: cart.map((i) => ({
        id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1,
        selectedColor: i.selectedColor || null, selectedSize: i.selectedSize || null,
      })),
      subtotal, delivery_fee: deliveryFee, total,
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const saved = await res.json();

    setSubmittingOrder(false);
    setOrderSuccess(saved);
    setCart([]);
    setDeliveryMethod(null);
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setDeliveryAddress(''); setOrderNotes('');
  }, [
    cart, subtotal, deliveryFee, total, deliveryMethod,
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    setCart, setDeliveryMethod,
  ]);

  return useMemo(() => ({
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
    submittingOrder, handlePlaceOrder,
    orderSuccess, clearOrderSuccess,
  }), [
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    submittingOrder, handlePlaceOrder, orderSuccess, clearOrderSuccess,
  ]);
}
