/**
 * מסך התודה: מספר ההזמנה, פרטיה ודרכי יצירת קשר.
 *
 * מושך את תוצאת ההזמנה מ-StoreContext ומקבל בפרופס רק את הסגירה,
 * שהיא עניין של הניתוב ולא של המצב המשותף.
 *
 * "מה קורה עכשיו" מתאר רק מה שהמערכת באמת עושה: החנות מקבלת מייל על
 * כל הזמנה, והלקוח מקבל אישור רק אם השאיר כתובת מייל — שתי השורות
 * האלה נגזרות מ-server/services/order.service.js ולא מהבטחה.
 */
import {
  Check, ClipboardList, Store, Truck, Mail, Phone, Smartphone, MessageCircle,
} from 'lucide-react';
import { useStore } from '../../context/storeContext';
import { ADDRESS, PHONES, whatsappUrl } from '../../utils/storeInfo';
import { formatPrice } from '../../utils/pricing';

/** מציג את אישור ההזמנה. */
function OrderSuccessView({ closeCart }) {
  const { orderSuccess } = useStore();

  const isPickup = orderSuccess.delivery_method === 'pickup';

  return (
    <div className="order-success">
      {/* רגע ההצלחה היחיד באתר שצבוע ירוק, כמו הווי בכרטיס המוצר */}
      <span className="order-success-mark" aria-hidden="true">
        <Check size={40} strokeWidth={2.5} />
      </span>

      <h3 className="order-success-title">ההזמנה התקבלה!</h3>
      <p className="order-success-id">#{orderSuccess.id}</p>

      <dl className="order-success-details">
        <div>
          <dt>שם</dt>
          <dd>{orderSuccess.customer_name}</dd>
        </div>
        <div>
          <dt>טלפון</dt>
          <dd>{orderSuccess.customer_phone}</dd>
        </div>
        <div>
          <dt>אופן קבלה</dt>
          <dd>{isPickup ? 'איסוף עצמי' : 'משלוח'}</dd>
        </div>
        <div>
          <dt>סה"כ</dt>
          <dd className="order-success-total">{formatPrice(orderSuccess.total)}</dd>
        </div>
      </dl>

      <ul className="order-success-next">
        <li>
          <ClipboardList size={17} aria-hidden="true" />
          <span>ההזמנה הועברה לחנות ואנחנו מתחילים לטפל בה</span>
        </li>
        <li>
          {isPickup
            ? <><Store size={17} aria-hidden="true" /><span>איסוף מ{ADDRESS.full}, בשעות הפעילות</span></>
            : <><Truck size={17} aria-hidden="true" /><span>משלוח ל{orderSuccess.delivery_address}</span></>}
        </li>
        {orderSuccess.customer_email && (
          <li>
            <Mail size={17} aria-hidden="true" />
            <span>אישור נשלח ל{orderSuccess.customer_email}</span>
          </li>
        )}
      </ul>

      <div className="order-success-contact">
        <p>לכל שאלה ניתן לפנות אלינו:</p>
        <div className="order-success-btns">
          {/* טלפון החנות הוא הפנייה הראשית ולכן האדום; הפלאפון שלידו
              והוואטסאפ הם אותו כפתור בשני צבעים אחרים. */}
          <a href={`tel:${PHONES.store.tel}`} className="order-success-btn order-success-btn--primary">
            <Phone size={17} aria-hidden="true" /> {PHONES.store.display}
          </a>
          <a href={`tel:${PHONES.mobile.tel}`} className="order-success-btn">
            <Smartphone size={17} aria-hidden="true" /> {PHONES.mobile.display}
          </a>
          <a
            href={whatsappUrl(`שלום, שאלה לגבי הזמנה מספר ${orderSuccess.id}`)}
            target="_blank" rel="noopener noreferrer"
            className="order-success-btn order-success-btn--whatsapp">
            <MessageCircle size={17} aria-hidden="true" /> וואטסאפ
          </a>
        </div>
      </div>

      <button type="button" className="cart-cta cart-cta--outline" onClick={closeCart}>סגור</button>
    </div>
  );
}

export default OrderSuccessView;
