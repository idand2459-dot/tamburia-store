/**
 * חלון העגלה: העטיפה שמחליפה בין שלושת שלבי ההזמנה.
 *
 * מושך את מצב העגלה וההזמנה מ-StoreContext, ולא מקבל אותו בפרופס —
 * אותו כיוון שכבר נעשה ב-Navbar וב-Footer. מה שכן מגיע בפרופס הוא
 * שלב העגלה והסגירה, כי השלבים נגזרים מהכתובת ולכן שייכים למסגרת.
 */
import { X, ShoppingCart, ClipboardList, CheckCircle } from 'lucide-react';
import { useStore } from '../../context/storeContext';
import CartStepView from './CartStepView';
import CheckoutFormView from './CheckoutFormView';
import OrderSuccessView from './OrderSuccessView';

/** מציג את חלון העגלה ואת השלב הפעיל. */
function CartModal({ cartStep, setCartStep, closeCart }) {
  const { orderSuccess } = useStore();

  return (
    <>
      <div className="cart-overlay" onClick={closeCart} />
      <div className="cart-modal">
        <div className="cart-modal-header">
          <button className="cart-close-btn" onClick={closeCart} aria-label="סגור עגלה"><X size={20} aria-hidden="true" /></button>
          <h3>
            {cartStep === 'cart' ? <><ShoppingCart size={20} aria-hidden="true" /> העגלה שלי</>
              : cartStep === 'details' ? <><ClipboardList size={20} aria-hidden="true" /> פרטי הזמנה</>
              : <><CheckCircle size={20} aria-hidden="true" /> ההזמנה התקבלה!</>}
          </h3>
        </div>

        {cartStep === 'cart' && <CartStepView setCartStep={setCartStep} />}

        {cartStep === 'details' && <CheckoutFormView setCartStep={setCartStep} />}

        {cartStep === 'success' && orderSuccess && <OrderSuccessView closeCart={closeCart} />}
      </div>
    </>
  );
}

export default CartModal;
