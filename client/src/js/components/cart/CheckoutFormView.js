/**
 * שלב הפרטים: טופס הלקוח, בדיקת אזור החלוקה ושליחת ההזמנה.
 *
 * מושך את שדות הטופס מ-StoreContext ומקבל בפרופס רק את מעבר השלבים,
 * שהוא עניין של הניתוב ולא של המצב המשותף.
 *
 * הכפתור אינו כאן אלא ב-CheckoutFormFooter שלמטה, כי הוא יושב בשורה
 * התחתונה הדביקה של המגירה. שני הרכיבים מחשבים את deliveryInvalid מאותה
 * פונקציה טהורה ומאותו קונטקסט, ולכן אין מצב שהכפתור יהיה פתוח בזמן
 * שהשדה מציג שגיאה.
 */
import { Ban, Check, AlertTriangle, CheckCircle } from 'lucide-react';
import { Spinner } from '../LoadingStates';
import { useStore } from '../../context/storeContext';
import { formatPrice } from '../../utils/pricing';

const ALLOWED_CITIES = ['פתח תקווה', 'פתח-תקווה', 'גני תקווה', 'גני-תקווה', 'קריית אונו', 'קרית אונו', 'קריית-אונו', 'קרית-אונו'];

/** בודק אם הכתובת נמצאת באזור החלוקה. */
function checkAllowedCity(address) {
  if (!address) return true;
  const lower = address.toLowerCase();
  return ALLOWED_CITIES.some(city => lower.includes(city.toLowerCase()));
}

/** האם הכתובת שהוזנה מחוץ לאזור החלוקה. */
function isDeliveryInvalid({ deliveryMethod, deliveryAddress }) {
  return Boolean(deliveryMethod === 'delivery' && deliveryAddress && !checkAllowedCity(deliveryAddress));
}

/** האם אפשר לשלוח את הטופס במצבו הנוכחי. */
function canSubmit(store) {
  const { customerName, customerPhone, deliveryMethod, deliveryAddress, submittingOrder } = store;
  if (!customerName || !customerPhone || submittingOrder) return false;
  if (deliveryMethod === 'delivery' && (!deliveryAddress || isDeliveryInvalid(store))) return false;
  return true;
}

/** מציג את טופס ההזמנה. */
function CheckoutFormView({ setCartStep }) {
  const store = useStore();
  const {
    cartCount, total, deliveryMethod,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
  } = store;

  /** מעדכן את הכתובת למשלוח. */
  function handleAddressChange(e) {
    setDeliveryAddress(e.target.value);
  }

  const deliveryInvalid = isDeliveryInvalid(store);

  return (
    <div className="checkout-form">
      <button type="button" className="checkout-back" onClick={() => setCartStep('cart')}>
        ← חזרה לעגלה
      </button>

      <div className="checkout-recap">
        <span>{cartCount} פריטים</span>
        <span className="checkout-recap-total">סה"כ {formatPrice(total)}</span>
      </div>

      <div className="checkout-fields">
        <div className="checkout-field">
          <label htmlFor="checkout-name">שם מלא <span className="checkout-req" aria-hidden="true">*</span></label>
          <input
            id="checkout-name"
            placeholder="ישראל ישראלי"
            maxLength={30}
            autoComplete="name"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
        </div>

        <div className="checkout-field">
          <label htmlFor="checkout-phone">טלפון <span className="checkout-req" aria-hidden="true">*</span></label>
          <input
            id="checkout-phone"
            placeholder="050-0000000"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
          />
        </div>

        <div className="checkout-field">
          <label htmlFor="checkout-email">אימייל</label>
          <input
            id="checkout-email"
            placeholder="example@email.com"
            type="email"
            autoComplete="email"
            value={customerEmail}
            onChange={e => setCustomerEmail(e.target.value)}
          />
        </div>

        {deliveryMethod === 'delivery' && (
          <div className="checkout-field">
            <label htmlFor="checkout-address">כתובת למשלוח <span className="checkout-req" aria-hidden="true">*</span></label>
            <input
              id="checkout-address"
              placeholder="רחוב, מספר, עיר"
              autoComplete="street-address"
              value={deliveryAddress}
              onChange={handleAddressChange}
              className={deliveryInvalid ? 'is-invalid' : ''}
            />
            {deliveryInvalid && (
              <p className="checkout-error">
                <Ban size={16} aria-hidden="true" />
                <span>
                  מצטערים, אנחנו משלחים לפתח תקווה, גני תקווה וקריית אונו בלבד.
                  <br />לאיסוף עצמי — חזרו לעגלה ובחרו "איסוף עצמי".
                </span>
              </p>
            )}
            {!deliveryInvalid && deliveryAddress && (
              <p className="checkout-ok"><Check size={15} aria-hidden="true" /> אזור המשלוח תקין</p>
            )}
          </div>
        )}

        <div className="checkout-field">
          <label htmlFor="checkout-notes">הערות להזמנה</label>
          <textarea
            id="checkout-notes"
            placeholder="הערות מיוחדות..."
            value={orderNotes}
            onChange={e => setOrderNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * הכפתור שיושב בשורה התחתונה של המגירה, והתראת השרת שמעליו.
 */
function CheckoutFormFooter() {
  const store = useStore();
  const { deliveryMethod, deliveryAddress, submittingOrder, handlePlaceOrder, orderError } = store;

  /** שולח את הטופס לשרת. */
  function handleSubmit() {
    // קו הגנה אחרון: הכפתור כבר חסום כש-deliveryInvalid דולק, וההודעה
    // ללקוח מוצגת ליד שדה הכתובת. הבדיקה נשארת למקרה שתנאי ה-disabled
    // ישתנה בעתיד, אבל בלי הודעה משלה — היא לא יכולה להגיע למסך.
    if (deliveryMethod === 'delivery' && !checkAllowedCity(deliveryAddress)) return;
    handlePlaceOrder();
  }

  return (
    <div className="checkout-submit">
      {/* דחייה מהשרת — העגלה נשארת מלאה כדי שאפשר יהיה לנסות שוב */}
      {orderError && (
        <p className="checkout-alert" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{orderError}</span>
        </p>
      )}

      <button
        type="button"
        className="cart-cta"
        disabled={!canSubmit(store)}
        onClick={handleSubmit}>
        {submittingOrder
          ? <><Spinner size="small" color="white" /> שולח הזמנה…</>
          : <><CheckCircle size={18} aria-hidden="true" /> שלח הזמנה</>}
      </button>
    </div>
  );
}

export { CheckoutFormFooter };
export default CheckoutFormView;
