/**
 * לשונית ההזמנות: סיכום לפי סטטוס, סינון, ייצוא וכרטיס הזמנה נפתח.
 *
 * הסינון וההזמנה הפתוחה הם state מקומי של הלשונית — הם לא מעניינים
 * אף לשונית אחרת.
 */
import { useState } from 'react';
import { STATUS_CONFIG, formatDate } from './adminConstants';

/** מציג את לשונית ההזמנות. */
function OrdersTab({ orders, onStatusChange, onDeleteOrder, onExport, ordersError }) {
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('all');

  const filteredOrders = orders.filter(o => orderFilter === 'all' || o.status === orderFilter);

  return (
    <div>
      <div className="orders-stats">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="orders-stat-card" style={{ borderTop: `3px solid ${cfg.color}` }}>
            <div className="stat-number" style={{ color: cfg.color }}>{orders.filter(o => o.status === key).length}</div>
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
            📊 ייצא לאקסל
          </button>
        )}
      </div>
      {ordersError && <div className="admin-error">⚠️ {ordersError}</div>}
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
                    <span className="order-delivery-badge">{order.delivery_method === 'pickup' ? '🏪 איסוף' : '🚚 משלוח'}</span>
                    <span className="order-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    <span className="order-expand-btn">{isExpanded ? '▲' : '▼'}</span>
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
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <button key={key} className={`status-btn ${order.status === key ? 'active' : ''}`}
                              style={order.status === key ? { background: cfg.color, color: 'white' } : {}}
                              onClick={() => onStatusChange(order.id, key)}>{cfg.label}</button>
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
