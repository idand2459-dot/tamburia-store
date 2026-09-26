/**
 * מסך התודה: מספר ההזמנה, פרטיה ודרכי יצירת קשר.
 *
 * מושך את תוצאת ההזמנה מ-StoreContext ומקבל בפרופס רק את הסגירה,
 * שהיא עניין של הניתוב ולא של המצב המשותף.
 */
import { useStore } from '../../context/storeContext';

/** מציג את אישור ההזמנה. */
function OrderSuccessView({ closeCart }) {
  const { orderSuccess } = useStore();

  return (
    <div className="order-success">
      <span className="success-icon">🎉</span>
      <h3>ההזמנה התקבלה בהצלחה!</h3>
      <p className="success-order-num">מספר הזמנה: <strong>#{orderSuccess.id}</strong></p>
      <div className="success-details">
        <div><span>שם:</span> {orderSuccess.customer_name}</div>
        <div><span>טלפון:</span> {orderSuccess.customer_phone}</div>
        <div><span>אופן קבלה:</span> {orderSuccess.delivery_method === 'pickup' ? '🏪 איסוף עצמי' : '🚚 משלוח'}</div>
        <div><span>סה"כ:</span> ₪{orderSuccess.total}</div>
      </div>
      <div className="success-message">
        <p>✅ ההזמנה שלך נשלחה ואנחנו מתחילים לטפל בה!</p>
        {orderSuccess.customer_email && (
          <p>📧 אישור נשלח למייל: <strong>{orderSuccess.customer_email}</strong></p>
        )}
      </div>
      <div className="success-contact">
        <p>לכל שאלה ניתן לפנות אלינו:</p>
        <div className="success-contact-btns">
          <a href="tel:039315750" className="success-contact-btn">📞 03-9315750</a>
          <a href="tel:0506735040" className="success-contact-btn">📱 050-6735040</a>
          <a href={`https://wa.me/972506735040?text=שלום, שאלה לגבי הזמנה מספר ${orderSuccess.id}`}
            target="_blank" rel="noopener noreferrer" className="success-contact-btn whatsapp">
            💬 וואטסאפ
          </a>
        </div>
      </div>
      <button className="checkout-btn" onClick={closeCart}>סגור</button>
    </div>
  );
}

export default OrderSuccessView;
