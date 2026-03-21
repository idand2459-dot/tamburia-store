import { useState } from 'react';
import { Spinner } from './LoadingStates';

// ערים מורשות למשלוח
const ALLOWED_CITIES = ['פתח תקווה', 'פתח-תקווה', 'גני תקווה', 'גני-תקווה', 'קריית אונו', 'קרית אונו', 'קריית-אונו', 'קרית-אונו'];

function checkAllowedCity(address) {
  if (!address) return true; // לא בודק אם ריק
  const lower = address.toLowerCase();
  return ALLOWED_CITIES.some(city => lower.includes(city.toLowerCase()));
}

function CartModal({
  cart, cartStep, setCartStep, closeCart,
  deliveryMethod, setDeliveryMethod,
  subtotal, deliveryFee, total, cartCount,
  updateQuantity, removeFromCart,
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  customerEmail, setCustomerEmail,
  deliveryAddress, setDeliveryAddress,
  orderNotes, setOrderNotes,
  submittingOrder, handlePlaceOrder,
  orderSuccess
}) {
  const [addressError, setAddressError] = useState('');

  function handleAddressChange(e) {
    setDeliveryAddress(e.target.value);
    setAddressError('');
  }

  function handleSubmit() {
    if (deliveryMethod === 'delivery') {
      if (!checkAllowedCity(deliveryAddress)) {
        setAddressError('מצטערים, אנחנו משלחים לפתח תקווה, גני תקווה וקריית אונו בלבד 🚚');
        return;
      }
    }
    handlePlaceOrder();
  }

  const deliveryInvalid = deliveryMethod === 'delivery' && deliveryAddress && !checkAllowedCity(deliveryAddress);

  return (
    <>
      <div className="cart-overlay" onClick={closeCart} />
      <div className="cart-modal">
        <div className="cart-modal-header">
          <button className="cart-close-btn" onClick={closeCart}>✕</button>
          <h3>{cartStep === 'cart' ? '🛒 העגלה שלי' : cartStep === 'details' ? '📋 פרטי הזמנה' : '✅ ההזמנה התקבלה!'}</h3>
        </div>

        {cartStep === 'cart' && (
          <>
            {cart.length === 0 ? (
              <div className="cart-empty"><span>🛒</span><p>העגלה ריקה</p></div>
            ) : (
              <>
                <ul className="cart-items-list">
                  {cart.map((item, index) => (
                    <li key={index} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.name}{item.selectedColor ? ` — ${item.selectedColor}` : ''}</span>
                        <span className="cart-item-price">₪{item.price * (item.quantity || 1)}</span>
                      </div>
                      <div className="cart-item-qty">
                        <button onClick={() => updateQuantity(index, -1)}>−</button>
                        <span>{item.quantity || 1}</span>
                        <button onClick={() => updateQuantity(index, 1)}>+</button>
                      </div>
                      <button className="cart-item-remove" onClick={() => removeFromCart(index)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className="delivery-section">
                  <h4>אופן קבלת ההזמנה</h4>
                  <div className="delivery-options">
                    <div className={`delivery-option ${deliveryMethod === 'pickup' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('pickup')}>
                      <div className="delivery-option-top"><span className="delivery-icon">🏪</span><div><strong>איסוף עצמי</strong><span className="delivery-free">חינם</span></div></div>
                      <p className="delivery-desc">בר כוכבא 52, פתח תקווה</p>
                      <p className="delivery-desc">באותו יום בשעות הפעילות</p>
                    </div>
                    <div className={`delivery-option ${deliveryMethod === 'delivery' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('delivery')}>
                      <div className="delivery-option-top"><span className="delivery-icon">🚚</span><div><strong>שליח עד הבית</strong><span className="delivery-price">₪20</span></div></div>
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
                  <button className="clear-btn" onClick={() => { setDeliveryMethod(null); }}>רוקן עגלה</button>
                </div>
              </>
            )}
          </>
        )}

        {cartStep === 'details' && (
          <div className="order-form">
            <button className="order-back-btn" onClick={() => setCartStep('cart')}>← חזור לעגלה</button>
            <div className="order-summary-mini"><span>{cartCount} פריטים</span><span className="order-total-mini">סה"כ: ₪{total}</span></div>
            <div className="order-fields">
              <div className="order-field">
                <label>שם מלא *</label>
                <input placeholder="ישראל ישראלי" value={customerName} onChange={e => setCustomerName(e.target.value)} />
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
                      🚫 מצטערים, אנחנו משלחים לפתח תקווה, גני תקווה וקריית אונו בלבד.
                      <br />לאיסוף עצמי — חזור ובחר "איסוף עצמי".
                    </div>
                  )}
                  {!deliveryInvalid && deliveryAddress && (
                    <div className="delivery-area-ok">✓ אזור המשלוח תקין</div>
                  )}
                </div>
              )}
              <div className="order-field">
                <label>הערות להזמנה</label>
                <textarea placeholder="הערות מיוחדות..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <button
              className={`checkout-btn ${(!customerName || !customerPhone || (deliveryMethod === 'delivery' && (!deliveryAddress || deliveryInvalid)) || submittingOrder) ? 'disabled' : ''}`}
              disabled={!customerName || !customerPhone || (deliveryMethod === 'delivery' && (!deliveryAddress || deliveryInvalid)) || submittingOrder}
              onClick={handleSubmit}>
              {submittingOrder ? <span className="checkout-btn-loading"><Spinner size="small" color="white" /> שולח הזמנה...</span> : '✅ שלח הזמנה'}
            </button>
          </div>
        )}

        {cartStep === 'success' && orderSuccess && (
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
        )}
      </div>
    </>
  );
}

export default CartModal;