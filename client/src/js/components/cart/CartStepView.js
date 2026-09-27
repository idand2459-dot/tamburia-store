/**
 * שלב העגלה: רשימת הפריטים, אופן קבלת ההזמנה וסיכום הסכומים.
 *
 * מושך את מצב העגלה מ-StoreContext ומקבל בפרופס רק את מעבר השלבים,
 * שהוא עניין של הניתוב ולא של המצב המשותף.
 */
import { ShoppingCart, X, Store, Truck } from 'lucide-react';
import { useStore } from '../../context/storeContext';
import { ADDRESS } from '../../utils/storeInfo';

/** מציג את תוכן העגלה ואת בחירת אופן הקבלה. */
function CartStepView({ setCartStep }) {
  const {
    cart, setCart, subtotal, total,
    updateQuantity, removeFromCart,
    deliveryMethod, setDeliveryMethod,
  } = useStore();

  if (cart.length === 0) {
    return <div className="cart-empty"><span><ShoppingCart size={48} aria-hidden="true" /></span><p>העגלה ריקה</p></div>;
  }

  return (
    <>
      <ul className="cart-items-list">
        {cart.map((item, index) => (
          <li key={index} className="cart-item">
            <div className="cart-item-info">
              <span className="cart-item-name">{item.name}{item.selectedVariant ? ` — ${item.selectedVariant}` : ''}{item.selectedColor ? ` — ${item.selectedColor}` : ''}{item.selectedSize ? ` — ${item.selectedSize}` : ''}</span>
              <span className="cart-item-price">₪{item.price * (item.quantity || 1)}</span>
            </div>
            <div className="cart-item-qty">
              <button onClick={() => updateQuantity(index, -1)}>−</button>
              <span>{item.quantity || 1}</span>
              <button onClick={() => updateQuantity(index, 1)}>+</button>
            </div>
            <button className="cart-item-remove" onClick={() => removeFromCart(index)} aria-label="הסר מהעגלה"><X size={18} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <div className="delivery-section">
        <h4>אופן קבלת ההזמנה</h4>
        <div className="delivery-options">
          <div className={`delivery-option ${deliveryMethod === 'pickup' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('pickup')}>
            <div className="delivery-option-top"><span className="delivery-icon"><Store size={24} aria-hidden="true" /></span><div><strong>איסוף עצמי</strong><span className="delivery-free">חינם</span></div></div>
            <p className="delivery-desc">{ADDRESS.full}</p>
            <p className="delivery-desc">באותו יום בשעות הפעילות</p>
          </div>
          <div className={`delivery-option ${deliveryMethod === 'delivery' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('delivery')}>
            <div className="delivery-option-top"><span className="delivery-icon"><Truck size={24} aria-hidden="true" /></span><div><strong>שליח עד הבית</strong><span className="delivery-price">₪20</span></div></div>
            <p className="delivery-desc">פתח תקווה • גני תקווה • קריית אונו</p>
          </div>
        </div>
      </div>
      <div className="cart-summary">
        <div className="cart-summary-row"><span>סכום מוצרים</span><span>₪{subtotal}</span></div>
        {deliveryMethod === 'delivery' && <div className="cart-summary-row"><span>משלוח</span><span>₪20</span></div>}
        {deliveryMethod === 'pickup' && <div className="cart-summary-row green"><span>משלוח</span><span>חינם</span></div>}
        <div className="cart-summary-total"><span>סה"כ לתשלום</span><span>₪{total}</span></div>
      </div>
      <div className="cart-actions">
        <button className={`checkout-btn ${!deliveryMethod ? 'disabled' : ''}`} disabled={!deliveryMethod}
          onClick={() => deliveryMethod && setCartStep('details')}>
          {!deliveryMethod ? 'בחר אופן קבלה לפני המשך' : 'המשך למילוי פרטים →'}
        </button>
        <button className="clear-btn" onClick={() => { setCart([]); setDeliveryMethod(null); }}>רוקן עגלה</button>
      </div>
    </>
  );
}

export default CartStepView;
