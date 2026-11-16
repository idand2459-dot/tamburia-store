/**
 * חלון העגלה: העטיפה שמחליפה בין שלושת שלבי ההזמנה.
 *
 * Reads the cart from the Redux store. The checkout form (its fields, the submit state and the
 * order result) arrives as the `checkout` prop from StoreLayout, which owns it so that it
 * survives this drawer being unmounted. The cart step and the closing arrive as props too,
 * because the steps follow the URL and so belong to the frame.
 *
 * המגירה נשארת מורכבת בין השלבים — רק הכותרת, הגוף והשורה התחתונה
 * מתחלפים. לכן מעבר מהעגלה לפרטים אינו מריץ את ההחלקה מחדש ואינו
 * מחזיר את המיקוד לכפתור שפתח.
 */
import { useState } from 'react';
import { ShoppingCart, ClipboardList, CheckCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectCartItems } from '../../store/cart/cartSelectors';
import Drawer from '../../components/Drawer';
import CartStepView, { CartStepFooter } from './CartStepView';
import CheckoutFormView, { CheckoutFormFooter } from './CheckoutFormView';
import OrderSuccessView from './OrderSuccessView';

const HEADS = {
  cart: { title: 'העגלה שלי', icon: ShoppingCart },
  details: { title: 'פרטי הזמנה', icon: ClipboardList },
  success: { title: 'אישור הזמנה', icon: CheckCircle },
};

/** מציג את חלון העגלה ואת השלב הפעיל. */
function CartModal({ cartStep, setCartStep, closeCart, checkout }) {
  const cart = useSelector(selectCartItems);
  const { orderSuccess } = checkout;

  const head = HEADS[cartStep] || HEADS.cart;

  // הטופס והכפתור הם שני רכיבים (הכפתור יושב בשורה התחתונה), וזה הדגל
  // שמחבר ביניהם: לחיצה על "שלח" עם שדה חסר מדליקה את ההודעות בטופס.
  const [showErrors, setShowErrors] = useState(false);

  // מסך התודה אינו מחזיק שורה תחתונה: הסגירה ודרכי הקשר הם התוכן שלו.
  // עגלה ריקה גם לא — אין מה לסכם.
  const footer = cartStep === 'details'
    ? <CheckoutFormFooter onInvalid={() => setShowErrors(true)} checkout={checkout} />
    : cartStep === 'cart' && cart.length > 0
      ? <CartStepFooter setCartStep={setCartStep} />
      : null;

  return (
    <Drawer title={head.title} icon={head.icon} onClose={closeCart} footer={footer}>
      {cartStep === 'cart' && <CartStepView closeCart={closeCart} />}

      {cartStep === 'details' && <CheckoutFormView setCartStep={setCartStep} showErrors={showErrors} checkout={checkout} />}

      {cartStep === 'success' && orderSuccess && <OrderSuccessView closeCart={closeCart} checkout={checkout} />}
    </Drawer>
  );
}

export default CartModal;
