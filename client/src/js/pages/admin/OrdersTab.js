/**
 * לשונית ההזמנות: סיכום לפי סטטוס, סינון, ייצוא וכרטיס הזמנה נפתח.
 *
 * הסינון וההזמנה הפתוחה הם state מקומי של הלשונית — הם לא מעניינים
 * אף לשונית אחרת.
 */
import { useState } from 'react';
import { BarChart3, AlertTriangle, Store, Truck, ChevronUp, ChevronDown } from 'lucide-react';
import { STATUS_CONFIG, statusesForMethod, formatDate } from './adminConstants';

/** מציג את לשונית ההזמנות. */
function OrdersTab({ orders, onStatusChange, onDeleteOrder, onExport, ordersError }) {
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('all');

  const filteredOrders = orders.filter(o => orderFilter === 'all' || o.status === orderFilter);

  return (
    <div>
      <div className="orders-stats">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`orders-stat-card is-${key}`}>
            <div className="stat-number">{orders.filter(o => o.status === key).length}</div>
            <div className="stat-label">{cfg.label}</div>
          </div>
        ))}
      </div>
      <div className="orders-filter">
        <button className={`admin-cat-btn ${orderFilter === 'all' ? 'active' : ''}`} onClick={() => setOrderFilter('all')}>הכל <span className="admin-cat-count">{orders.length}</span></button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key} className={`admin-cat-btn ${orderFilter === key ? 'active' : ''}`} onClick={() => setOrderFilter(key)}>
            {cfg.label} <span className="admin-cat-count">{orders.filter(o => o.status === key).length}</span>
          </button>
        ))}
        {orders.length > 0 && (
          <button className="export-orders-btn" onClick={onExport} title="ייצא לאקסל">
            <BarChart3 size={18} aria-hidden="true" /> ייצא לאקסל
          </button>
        )}
      </div>
      {ordersError && <div className="admin-error"><AlertTriangle size={18} aria-hidden="true" /> {ordersError}</div>}
      {filteredOrders.length === 0 ? <div className="admin-empty">אין הזמנות עדיין</div> : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                  <div className="order-card-right">
                    <span className="order-id">#{order.id}</span>
                    <div><div className="order-customer-name">{order.customer_name}</div><div className="order-meta">{order.customer_phone} • {formatDate(order.created_at)}</div></div>
                  </div>
                  <div className="order-card-left">
                    <span className="order-total-badge">₪{order.total}</span>
                    <span className="order-delivery-badge">{order.delivery_method === 'pickup' ? <><Store size={16} aria-hidden="true" /> איסוף</> : <><Truck size={16} aria-hidden="true" /> משלוח</>}</span>
                    <span className={`order-status-badge order-status-badge--${order.status || 'new'}`}>{cfg.label}</span>
                    <span className="order-expand-btn">{isExpanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="order-card-body">
                    <div className="order-details-grid">
                      <div className="order-detail-item"><span className="order-detail-label">שם</span><span>{order.customer_name}</span></div>
                      <div className="order-detail-item"><span className="order-detail-label">טלפון</span><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></div>
                      {order.customer_email && <div className="order-detail-item"><span className="order-detail-label">אימייל</span><span>{order.customer_email}</span></div>}
                      {order.delivery_address && <div className="order-detail-item"><span className="order-detail-label">כתובת</span><span>{order.delivery_address}</span></div>}
                      {order.notes && <div className="order-detail-item full"><span className="order-detail-label">הערות</span><span>{order.notes}</span></div>}
                    </div>
                    <div className="order-items">
                      <strong>פריטים:</strong>
                      <table className="order-items-table">
                        <thead><tr><th>מוצר</th><th>צבע</th><th>כמות</th><th>מחיר</th></tr></thead>
                        <tbody>{order.items.map((item, i) => <tr key={i}><td>{item.name}</td><td>{item.selectedColor||'—'}</td><td>{item.quantity}</td><td>₪{item.price * item.quantity}</td></tr>)}</tbody>
                      </table>
                      <div className="order-totals">
                        <span>מוצרים: ₪{order.subtotal}</span>
                        <span>משלוח: {order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
                        <strong>סה"כ: ₪{order.total}</strong>
                      </div>
                    </div>
                    <div className="order-actions">
                      <div className="order-status-select">
                        <label>שנה סטטוס:</label>
                        <div className="status-buttons">
                          {statusesForMethod(order.delivery_method).map(key => (
                            <button key={key} className={`status-btn status-btn--${key} ${order.status === key ? 'active' : ''}`}
                              onClick={() => onStatusChange(order.id, key)}>{STATUS_CONFIG[key].label}</button>
                          ))}
                        </div>
                      </div>
                      <button className="delete-btn" onClick={() => onDeleteOrder(order.id)}>מחק הזמנה</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OrdersTab;
