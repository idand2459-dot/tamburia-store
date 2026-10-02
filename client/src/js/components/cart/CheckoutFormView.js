/**
 * שלב הפרטים: טופס הלקוח, בדיקת אזור החלוקה ושליחת ההזמנה.
 *
 * מושך את שדות הטופס מ-StoreContext ומקבל בפרופס רק את מעבר השלבים,
 * שהוא עניין של הניתוב ולא של המצב המשותף.
 *
 * הכפתור אינו כאן אלא ב-CheckoutFormFooter שלמטה, כי הוא יושב בשורה
 * התחתונה הדביקה של המגירה. שני הרכיבים מחשבים את השגיאות מאותה
 * פונקציה טהורה ומאותו קונטקסט, ולכן מה שהכפתור דוחה הוא בדיוק מה
 * שהשדות מציגים.
 *
 * הכפתור לא חסום כשחסר משהו, כמו שהיה. כפתור חסום לא אומר למה, וקורא
 * מסך לא מגיע אליו בכלל. עכשיו לחיצה עם שדה חסר מציגה הודעה ליד כל
 * שדה, מסמנת אותו aria-invalid, ומעבירה את המיקוד לראשון שבהם — קורא
 * המסך מקריא את התווית ואת ההודעה יחד, דרך aria-describedby.
 */
import { Ban, Check, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
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

/**
 * מחזיר את השגיאות בטופס, לפי סדר השדות על המסך.
 *
 * אורך הטלפון זהה לבדיקה בשרת (order.validator, 9 עד 15 ספרות), כדי
 * שהלקוח ישמע על טעות כאן ולא מסירוב אחרי השליחה. כתובת מחוץ לאזור
 * אינה כאן: היא מוצגת מיד בזמן ההקלדה, בהודעה משלה.
 */
function checkoutErrors({ customerName, customerPhone, customerEmail, deliveryMethod, deliveryAddress }) {
  const errors = {};
  if (!customerName.trim()) errors.name = 'יש למלא שם מלא';

  const digits = customerPhone.replace(/\D/g, '');
  if (!customerPhone.trim()) errors.phone = 'יש למלא מספר טלפון';
  else if (digits.length < 9 || digits.length > 15) errors.phone = 'מספר הטלפון צריך להכיל 9 עד 15 ספרות';

  if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
    errors.email = 'כתובת האימייל אינה תקינה';
  }

  if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
    errors.address = 'יש למלא כתובת למשלוח';
  }
  return errors;
}

/** המזהה של השדה ושל ההודעה שלו, לפי שם השדה. */
const fieldId = (name) => `checkout-${name}`;
const errorId = (name) => `checkout-${name}-error`;

/** מחזיר את מאפייני הנגישות של שדה: חובה, שגוי, ולאיזו הודעה הוא קשור. */
function fieldProps(name, error, { required = false, extraDescription } = {}) {
  const described = [error && errorId(name), extraDescription].filter(Boolean).join(' ');
  return {
    id: fieldId(name),
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described || undefined,
  };
}

/** הודעת השגיאה שמתחת לשדה. */
function FieldError({ name, error }) {
  if (!error) return null;
  return (
    <p className="checkout-error" id={errorId(name)}>
      <AlertCircle size={15} aria-hidden="true" />
      <span>{error}</span>
    </p>
  );
}

/** מציג את טופס ההזמנה. showErrors נדלק בלחיצה הראשונה על "שלח". */
function CheckoutFormView({ setCartStep, showErrors = false }) {
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
  // השגיאות מוצגות רק אחרי ניסיון שליחה — טופס שצועק על שדות ריקים
  // לפני שהתחילו למלא אותו רק מפריע. אחרי זה הן מתעדכנות בזמן ההקלדה.
  const errors = showErrors ? checkoutErrors(store) : {};

  return (
    <div className="checkout-form">
      <button type="button" className="checkout-back" onClick={() => setCartStep('cart')}>
        <span aria-hidden="true">←</span> חזרה לעגלה
      </button>

      <div className="checkout-recap">
        <span>{cartCount} פריטים</span>
        <span className="checkout-recap-total">סה"כ {formatPrice(total)}</span>
      </div>

      <p className="checkout-required-note">
        שדות המסומנים ב-<span className="checkout-req" aria-hidden="true">*</span>
        <span className="visually-hidden">כוכבית</span> הם שדות חובה
      </p>

      <div className="checkout-fields">
        <div className="checkout-field">
          <label htmlFor={fieldId('name')}>שם מלא <span className="checkout-req" aria-hidden="true">*</span></label>
          <input
            {...fieldProps('name', errors.name, { required: true })}
            placeholder="ישראל ישראלי"
            maxLength={30}
            autoComplete="name"
            className={errors.name ? 'is-invalid' : ''}
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
          <FieldError name="name" error={errors.name} />
        </div>

        <div className="checkout-field">
          <label htmlFor={fieldId('phone')}>טלפון <span className="checkout-req" aria-hidden="true">*</span></label>
          <input
            {...fieldProps('phone', errors.phone, { required: true })}
            placeholder="050-0000000"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={errors.phone ? 'is-invalid' : ''}
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
          />
          <FieldError name="phone" error={errors.phone} />
        </div>

        <div className="checkout-field">
          <label htmlFor={fieldId('email')}>אימייל</label>
          <input
            {...fieldProps('email', errors.email)}
            placeholder="example@email.com"
            type="email"
            autoComplete="email"
            className={errors.email ? 'is-invalid' : ''}
            value={customerEmail}
            onChange={e => setCustomerEmail(e.target.value)}
          />
          <FieldError name="email" error={errors.email} />
        </div>

        {deliveryMethod === 'delivery' && (
          <div className="checkout-field">
            <label htmlFor={fieldId('address')}>כתובת למשלוח <span className="checkout-req" aria-hidden="true">*</span></label>
            <input
              {...fieldProps('address', errors.address, {
                required: true,
                extraDescription: deliveryInvalid ? 'checkout-address-area' : undefined,
              })}
              aria-invalid={errors.address || deliveryInvalid ? true : undefined}
              placeholder="רחוב, מספר, עיר"
              autoComplete="street-address"
              value={deliveryAddress}
              onChange={handleAddressChange}
              className={errors.address || deliveryInvalid ? 'is-invalid' : ''}
            />
            <FieldError name="address" error={errors.address} />
            {/* מוצגת בזמן ההקלדה ולא רק בשליחה, ולכן אזור חי: קורא המסך
                שומע אותה כשהיא מופיעה, בלי שהמיקוד יזוז. */}
            <div aria-live="polite">
              {deliveryInvalid && (
                <p className="checkout-error" id="checkout-address-area">
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
          </div>
        )}

        <div className="checkout-field">
          <label htmlFor={fieldId('notes')}>הערות להזמנה</label>
          <textarea
            id={fieldId('notes')}
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
 * onInvalid מדליק את הצגת השגיאות בטופס שמעליו (CartModal מחזיק אותה).
 */
function CheckoutFormFooter({ onInvalid }) {
  const store = useStore();
  const { submittingOrder, handlePlaceOrder, orderError } = store;

  /** בודק את הטופס, ושולח רק אם הוא תקין. */
  function handleSubmit() {
    const firstInvalid = Object.keys(checkoutErrors(store))[0]
      || (isDeliveryInvalid(store) ? 'address' : null);

    if (firstInvalid) {
      onInvalid?.();
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
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
        disabled={submittingOrder}
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
