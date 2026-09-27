/**
 * חלון העגלה: העטיפה שמחליפה בין שלושת שלבי ההזמנה.
 *
 * מושך את מצב העגלה וההזמנה מ-StoreContext, ולא מקבל אותו בפרופס —
 * אותו כיוון שכבר נעשה ב-Navbar וב-Footer. מה שכן מגיע בפרופס הוא
 * שלב העגלה והסגירה, כי השלבים נגזרים מהכתובת ולכן שייכים למסגרת.
 *
 * המגירה נשארת מורכבת בין השלבים — רק הכותרת, הגוף והשורה התחתונה
 * מתחלפים. לכן מעבר מהעגלה לפרטים אינו מריץ את ההחלקה מחדש ואינו
 * מחזיר את המיקוד לכפתור שפתח.
 */
import { ShoppingCart, ClipboardList, CheckCircle } from 'lucide-react';
import { useStore } from '../../context/storeContext';
import Drawer from '../Drawer';
import CartStepView, { CartStepFooter } from './CartStepView';
import CheckoutFormView from './CheckoutFormView';
import OrderSuccessView from './OrderSuccessView';

const HEADS = {
  cart: { title: 'העגלה שלי', icon: ShoppingCart },
  details: { title: 'פרטי הזמנה', icon: ClipboardList },
  success: { title: 'אישור הזמנה', icon: CheckCircle },
};

/** מציג את חלון העגלה ואת השלב הפעיל. */
function CartModal({ cartStep, setCartStep, closeCart }) {
  const { cart, orderSuccess } = useStore();

  const head = HEADS[cartStep] || HEADS.cart;

  // עגלה ריקה אינה מחזיקה שורה תחתונה — אין מה לסכם.
  const footer = cartStep === 'cart' && cart.length > 0
    ? <CartStepFooter setCartStep={setCartStep} />
    : null;

  return (
    <Drawer title={head.title} icon={head.icon} onClose={closeCart} footer={footer}>
      {cartStep === 'cart' && <CartStepView closeCart={closeCart} />}

      {cartStep === 'details' && <CheckoutFormView setCartStep={setCartStep} />}

      {cartStep === 'success' && orderSuccess && <OrderSuccessView closeCart={closeCart} />}
    </Drawer>
  );
}

export default CartModal;
