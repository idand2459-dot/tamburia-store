/**
 * טופס ההזמנה: פרטי הלקוח, השליחה לשרת ומסך התודה.
 *
 * מקבל את מצב העגלה כארגומנט ולא מחזיק עותק משלו — הסכומים והפריטים
 * שייכים ל-useCart, וכפילות שלהם כאן הייתה יכולה להיפרד ממנו. בסיום
 * הזמנה מוצלחת הטופס גם מרוקן את העגלה, ולכן הוא צריך את הסטרים שלה.
 *
 * הסכומים והמחירים נשלחים לשרת כדי שיהיה מה להשוות אליו, לא כדי
 * שיישמרו: השרת שולף את המחיר של כל פריט מהקטלוג, מחשב מהם את
 * הסכומים, ומתעלם ממה שהגיע בגוף הבקשה.
 *
 * מכאן גם הטיפול ב-409. מחיר שהשתנה בזמן שהמוצר שכב בעגלה אינו תקלה
 * ואינו ניסיון רמייה, אבל הוא כן אומר שהלקוח עומד לאשר סכום אחר ממה
 * שהוא רואה. השרת דוחה, מחזיר את המחירים העדכניים ב-details, והעגלה
 * מתקנת את עצמה כאן — כך שהניסיון השני כבר מציג את הסכום הנכון.
 */
import { useState, useMemo, useCallback } from 'react';

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
    let res;
    let saved;
    try {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      saved = await res.json();
    } catch {
      // תקלת רשת, או תשובה שאינה JSON. בלי זה הספינר היה נתקע לנצח.
      setSubmittingOrder(false);
      setOrderError('לא הצלחנו לשלוח את ההזמנה. בדקו את החיבור ונסו שוב.');
      return;
    }

    if (!res.ok) {
      setSubmittingOrder(false);
      setOrderError(saved?.error || 'שליחת ההזמנה נכשלה. אפשר לנסות שוב.');

      // 409 הוא המקרה היחיד שבו לתשובה יש מה להוסיף לעגלה ולא רק
      // למסך: המחירים העדכניים, כדי שהסכום שמוצג יתיישר עם מה שהשרת
      // יקבל בפעם הבאה.
      if (res.status === 409 && Array.isArray(saved?.details?.prices)) {
        setCart((prev) => applyPrices(prev, saved.details.prices));
      }
      return;
    }

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
    orderSuccess, clearOrderSuccess, orderError,
  }), [
    customerName, customerPhone, customerEmail, deliveryAddress, orderNotes,
    submittingOrder, handlePlaceOrder, orderSuccess, clearOrderSuccess, orderError,
  ]);
}
