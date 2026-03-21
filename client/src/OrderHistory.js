import { useState } from 'react';

const STATUS_CONFIG = {
  new:        { label: 'התקבלה',  emoji: '📥', color: '#2563eb', bg: '#eff6ff' },
  processing: { label: 'בטיפול',  emoji: '⚙️', color: '#d97706', bg: '#fffbeb' },
  shipped:    { label: 'נשלחה',   emoji: '🚚', color: '#7c3aed', bg: '#f5f3ff' },
  completed:  { label: 'הושלמה', emoji: '✅', color: '#16a34a', bg: '#f0fdf4' },
};

function OrderHistory({ onClose }) {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/orders/by-phone/${phone.replace(/\D/g, '')}`);
      const data = await res.json();
      setOrders(data);
    } catch {
      setOrders([]);
    }
    setLoading(false);
    setSearched(true);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <>
      <div className="order-history-overlay" onClick={onClose} />
      <div className="order-history-modal">
        <div className="order-history-header">
          <button className="cart-close-btn" onClick={onClose}>✕</button>
          <h3>📋 היסטוריית הזמנות</h3>
        </div>

        <div className="order-history-body">
          <p className="order-history-desc">הכנס את מספר הטלפון שלך לצפייה בהזמנות</p>

          <form onSubmit={handleSearch} className="order-history-form">
            <div className="order-history-input-wrap">
              <input
                type="tel"
                placeholder="050-0000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="order-history-input"
                dir="ltr"
              />
              <button type="submit" className="order-history-search-btn" disabled={loading}>
                {loading ? '⏳' : '🔍 חפש'}
              </button>
            </div>
          </form>

          {searched && orders !== null && (
            <>
              {orders.length === 0 ? (
                <div className="order-history-empty">
                  <span>🔍</span>
                  <p>לא נמצאו הזמנות למספר זה</p>
                  <small>נסה מספר אחר או פנה אלינו בטלפון</small>
                </div>
              ) : (
                <div className="order-history-list">
                  <div className="order-history-count">{orders.length} הזמנות נמצאו</div>
                  {orders.map(order => {
                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
                    const isExpanded = expandedOrder === order.id;
                    return (
                      <div key={order.id} className="order-history-card">
                        <div className="order-history-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                          <div className="order-history-card-right">
                            <span className="order-history-id">#{order.id}</span>
                            <div>
                              <div className="order-history-date">{formatDate(order.created_at)}</div>
                              <div className="order-history-items-count">{order.items.length} פריטים</div>
                            </div>
                          </div>
                          <div className="order-history-card-left">
                            <span className="order-history-total">₪{order.total}</span>
                            <span className="order-history-status" style={{ color: cfg.color, background: cfg.bg }}>
                              {cfg.emoji} {cfg.label}
                            </span>
                            <span className="order-expand-btn">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="order-history-card-body">
                            <div className="order-history-delivery">
                              {order.delivery_method === 'pickup' ? '🏪 איסוף עצמי' : `🚚 משלוח — ${order.delivery_address || ''}`}
                            </div>
                            <table className="order-history-table">
                              <thead>
                                <tr><th>מוצר</th><th>כמות</th><th>מחיר</th></tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, i) => (
                                  <tr key={i}>
                                    <td>{item.name}{item.selectedColor ? ` (${item.selectedColor})` : ''}</td>
                                    <td>{item.quantity}</td>
                                    <td>₪{item.price * item.quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="order-history-totals">
                              <span>מוצרים: ₪{order.subtotal}</span>
                              <span>משלוח: {order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
                              <strong>סה"כ: ₪{order.total}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="order-history-contact">
            <p>שאלה על הזמנה? דברו איתנו:</p>
            <div className="order-history-contact-btns">
              <a href="tel:039315750" className="order-history-btn">📞 03-9315750</a>
              <a href={`https://wa.me/972506735040`} target="_blank" rel="noopener noreferrer" className="order-history-btn whatsapp">💬 וואטסאפ</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default OrderHistory;