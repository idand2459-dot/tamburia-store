/**
 * שלב הפרטים: טופס הלקוח, בדיקת אזור החלוקה ושליחת ההזמנה.
 *
 * מושך את שדות הטופס מ-StoreContext ומקבל בפרופס רק את מעבר השלבים,
 * שהוא עניין של הניתוב ולא של המצב המשותף.
 */
import { Ban, Check, AlertTriangle, CheckCircle } from 'lucide-react';
import { Spinner } from '../LoadingStates';
import { useStore } from '../../context/storeContext';

const ALLOWED_CITIES = ['פתח תקווה', 'פתח-תקווה', 'גני תקווה', 'גני-תקווה', 'קריית אונו', 'קרית אונו', 'קריית-אונו', 'קרית-אונו'];

/** בודק אם הכתובת נמצאת באזור החלוקה. */
function checkAllowedCity(address) {
  if (!address) return true;
  const lower = address.toLowerCase();
  return ALLOWED_CITIES.some(city => lower.includes(city.toLowerCase()));
}

/** מציג את טופס ההזמנה ושולח אותה. */
function CheckoutFormView({ setCartStep }) {
  const {
    cartCount, total, deliveryMethod,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
    submittingOrder, handlePlaceOrder, orderError,
  } = useStore();

  /** מעדכן את הכתובת למשלוח. */
  function handleAddressChange(e) {
    setDeliveryAddress(e.target.value);
  }

  /** שולח את הטופס לשרת. */
  function handleSubmit() {
    // קו הגנה אחרון: הכפתור כבר חסום כש-deliveryInvalid דולק, וההודעה
    // ללקוח מוצגת ליד שדה הכתובת. הבדיקה נשארת למקרה שתנאי ה-disabled
    // ישתנה בעתיד, אבל בלי הודעה משלה — היא לא יכולה להגיע למסך.
    if (deliveryMethod === 'delivery' && !checkAllowedCity(deliveryAddress)) return;
    handlePlaceOrder();
  }

  const deliveryInvalid = deliveryMethod === 'delivery' && deliveryAddress && !checkAllowedCity(deliveryAddress);

  return (
    <div className="order-form">
      <button className="order-back-btn" onClick={() => setCartStep('cart')}>← חזור לעגלה</button>
      <div className="order-summary-mini"><span>{cartCount} פריטים</span><span className="order-total-mini">סה"כ: ₪{total}</span></div>
      <div className="order-fields">
        <div className="order-field">
          <label>שם מלא *</label>
          <input placeholder="ישראל ישראלי" maxLength={30} value={customerName} onChange={e => setCustomerName(e.target.value)} />
        </div>
        <div className="order-field">
          <label>טלפון *</label>
          <input placeholder="050-0000000" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
        </div>
        <div className="order-field">
          <label>אימייל</label>
          <input placeholder="example@email.com" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
        </div>
        {deliveryMethod === 'delivery' && (
          <div className="order-field">
            <label>כתובת למשלוח *</label>
            <input
              placeholder="רחוב, מספר, עיר"
              value={deliveryAddress}
              onChange={handleAddressChange}
              className={deliveryInvalid ? 'input-error' : ''}
            />
            {deliveryInvalid && (
              <div className="delivery-area-error">
                <Ban size={18} aria-hidden="true" /> מצטערים, אנחנו משלחים לפתח תקווה, גני תקווה וקריית אונו בלבד.
                <br />לאיסוף עצמי — חזור ובחר "איסוף עצמי".
              </div>
            )}
            {!deliveryInvalid && deliveryAddress && (
              <div className="delivery-area-ok"><Check size={16} aria-hidden="true" /> אזור המשלוח תקין</div>
            )}
          </div>
        )}
        <div className="order-field">
          <label>הערות להזמנה</label>
          <textarea placeholder="הערות מיוחדות..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} />
        </div>
      </div>
      {/* דחייה מהשרת — העגלה נשארת מלאה כדי שאפשר יהיה לנסות שוב */}
      {orderError && <div className="delivery-area-error"><AlertTriangle size={18} aria-hidden="true" /> {orderError}</div>}
      <button
        className={`checkout-btn ${(!customerName || !customerPhone || (deliveryMethod === 'delivery' && (!deliveryAddress || deliveryInvalid)) || submittingOrder) ? 'disabled' : ''}`}
        disabled={!customerName || !customerPhone || (deliveryMethod === 'delivery' && (!deliveryAddress || deliveryInvalid)) || submittingOrder}
        onClick={handleSubmit}>
        {submittingOrder ? <span className="checkout-btn-loading"><Spinner size="small" color="white" /> שולח הזמנה...</span> : <><CheckCircle size={18} aria-hidden="true" /> שלח הזמנה</>}
      </button>
    </div>
  );
}

export default CheckoutFormView;
