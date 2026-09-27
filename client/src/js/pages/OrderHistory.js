/**
 * חלון ההזמנות שלי — חיפוש הזמנות לפי מספר טלפון.
 *
 * צבעי הסטטוסים נלקחים מהטוקנים של האתר דרך מחלקה לכל סטטוס, ולא
 * מהקסים שהיו כאן בקובץ: כתום וכחול שלא קיימים בשום מקום אחר באתר
 * הופיעו כאן ליד האדום והסגול של המותג. מה שנשאר בקובץ הוא התווית
 * והאייקון — נתונים — והצבע הוא עניין של _order-history-card.css.
 */
import { useState } from 'react';
import {
  ClipboardList, Search, Inbox, Settings, Truck, CheckCircle,
  Store, ChevronDown, Phone, MessageCircle,
} from 'lucide-react';
import Drawer from '../components/Drawer';
import { Spinner } from '../components/LoadingStates';
import { PHONES, whatsappUrl } from '../utils/storeInfo';

const STATUS_CONFIG = {
  new: { label: 'התקבלה', Icon: Inbox },
  processing: { label: 'בטיפול', Icon: Settings },
  shipped: { label: 'נשלחה', Icon: Truck },
  completed: { label: 'הושלמה', Icon: CheckCircle },
};

/** מציג את חלון חיפוש ההזמנות של הלקוח. */
function OrderHistory({ onClose }) {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  /** מחפש בשרת הזמנות לפי מספר הטלפון שהוזן. */
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

  /** ממיר תאריך לתצוגה בעברית. */
  function formatDate(d) {
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <Drawer title="ההזמנות שלי" icon={ClipboardList} onClose={onClose}>
      <div className="order-history">
        <p className="order-history-desc">הכניסו את מספר הטלפון שלכם לצפייה בהזמנות</p>

        <form onSubmit={handleSearch} className="order-history-search">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="050-0000000"
            aria-label="מספר טלפון"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="order-history-input"
            dir="ltr"
          />
          <button type="submit" className="order-history-search-btn" disabled={loading}>
            {/* ה-Spinner של האתר ולא Loader של Lucide: זה שהיה כאן
                היה אייקון עומד, כלומר מצב טעינה שלא זז. */}
            {loading
              ? <><Spinner size="small" color="white" /> מחפש…</>
              : <><Search size={17} aria-hidden="true" /> חפש</>}
          </button>
        </form>

        {searched && orders !== null && (
          orders.length === 0 ? (
            <div className="order-history-empty">
              <span className="order-history-empty-icon" aria-hidden="true">
                <Search size={26} strokeWidth={1.5} />
              </span>
              <p className="order-history-empty-title">לא נמצאו הזמנות למספר הזה</p>
              <p className="order-history-empty-text">
                אפשר לנסות מספר אחר, או להתקשר אלינו:{' '}
                <a href={`tel:${PHONES.store.tel}`}>{PHONES.store.display}</a>
              </p>
            </div>
          ) : (
            <div className="order-history-list">
              <p className="order-history-count">{orders.length} הזמנות</p>

              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className={`order-history-card ${isExpanded ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="order-history-toggle"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                      <span className="order-history-card-main">
                        <span className="order-history-id">#{order.id}</span>
                        <span className="order-history-meta">
                          {formatDate(order.created_at)} · {order.items.length} פריטים
                        </span>
                      </span>

                      <span className="order-history-card-side">
                        <span className={`order-history-status order-history-status--${order.status || 'new'}`}>
                          <cfg.Icon size={14} aria-hidden="true" /> {cfg.label}
                        </span>
                        <span className="order-history-total">₪{order.total}</span>
                      </span>

                      <ChevronDown className="order-history-chevron" size={18} aria-hidden="true" />
                    </button>

                    {/* אותה טכניקת 0fr → 1fr של האקורדיון בשאלות
                        הנפוצות: גובה שנפתח לגובה התוכן עצמו, בלי מספר
                        פיקסלים קבוע ובלי מדידה בקוד. */}
                    <div className="order-history-body-wrap">
                      <div className="order-history-body">
                        <p className="order-history-delivery">
                          {order.delivery_method === 'pickup'
                            ? <><Store size={15} aria-hidden="true" /> איסוף עצמי</>
                            : <><Truck size={15} aria-hidden="true" /> משלוח — {order.delivery_address || ''}</>}
                        </p>

                        <ul className="order-history-items">
                          {order.items.map((item, i) => (
                            <li key={i}>
                              <span className="order-history-item-name">
                                {item.name}{item.selectedColor ? ` (${item.selectedColor})` : ''}
                              </span>
                              <span className="order-history-item-qty">×{item.quantity}</span>
                              <span className="order-history-item-price">₪{item.price * item.quantity}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="order-history-sums">
                          <span>מוצרים ₪{order.subtotal}</span>
                          <span>משלוח {order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
                          <strong>סה"כ ₪{order.total}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <div className="order-history-contact">
          <p>שאלה על הזמנה? דברו איתנו:</p>
          <div className="order-history-contact-btns">
            <a href={`tel:${PHONES.store.tel}`} className="order-history-btn order-history-btn--primary">
              <Phone size={17} aria-hidden="true" /> {PHONES.store.display}
            </a>
            <a
              href={whatsappUrl()}
              target="_blank" rel="noopener noreferrer"
              className="order-history-btn order-history-btn--whatsapp">
              <MessageCircle size={17} aria-hidden="true" /> וואטסאפ
            </a>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export default OrderHistory;
