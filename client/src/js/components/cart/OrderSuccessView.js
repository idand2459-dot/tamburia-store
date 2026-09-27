/**
 * מסך התודה: מספר ההזמנה, פרטיה ודרכי יצירת קשר.
 *
 * מושך את תוצאת ההזמנה מ-StoreContext ומקבל בפרופס רק את הסגירה,
 * שהיא עניין של הניתוב ולא של המצב המשותף.
 */
import {
  PartyPopper, Store, Truck, CheckCircle, Mail, Phone, Smartphone, MessageCircle,
} from 'lucide-react';
import { useStore } from '../../context/storeContext';
import { PHONES, whatsappUrl } from '../../utils/storeInfo';

/** מציג את אישור ההזמנה. */
function OrderSuccessView({ closeCart }) {
  const { orderSuccess } = useStore();

  return (
    <div className="order-success">
      <span className="success-icon"><PartyPopper size={48} aria-hidden="true" /></span>
      <h3>ההזמנה התקבלה בהצלחה!</h3>
      <p className="success-order-num">מספר הזמנה: <strong>#{orderSuccess.id}</strong></p>
      <div className="success-details">
        <div><span>שם:</span> {orderSuccess.customer_name}</div>
        <div><span>טלפון:</span> {orderSuccess.customer_phone}</div>
        <div><span>אופן קבלה:</span> {orderSuccess.delivery_method === 'pickup' ? <><Store size={16} aria-hidden="true" /> איסוף עצמי</> : <><Truck size={16} aria-hidden="true" /> משלוח</>}</div>
        <div><span>סה"כ:</span> ₪{orderSuccess.total}</div>
      </div>
      <div className="success-message">
        <p><CheckCircle size={18} aria-hidden="true" /> ההזמנה שלך נשלחה ואנחנו מתחילים לטפל בה!</p>
        {orderSuccess.customer_email && (
          <p><Mail size={18} aria-hidden="true" /> אישור נשלח למייל: <strong>{orderSuccess.customer_email}</strong></p>
        )}
      </div>
      <div className="success-contact">
        <p>לכל שאלה ניתן לפנות אלינו:</p>
        <div className="success-contact-btns">
          <a href={`tel:${PHONES.store.tel}`} className="success-contact-btn"><Phone size={18} aria-hidden="true" /> {PHONES.store.display}</a>
          <a href={`tel:${PHONES.mobile.tel}`} className="success-contact-btn"><Smartphone size={18} aria-hidden="true" /> {PHONES.mobile.display}</a>
          <a href={whatsappUrl(`שלום, שאלה לגבי הזמנה מספר ${orderSuccess.id}`)}
            target="_blank" rel="noopener noreferrer" className="success-contact-btn whatsapp">
            <MessageCircle size={18} aria-hidden="true" /> וואטסאפ
          </a>
        </div>
      </div>
      <button className="cart-cta" onClick={closeCart}>סגור</button>
    </div>
  );
}

export default OrderSuccessView;
