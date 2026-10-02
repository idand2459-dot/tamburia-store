/**
 * לשונית ההזמנות: שורת סינון וכרטיס לכל הזמנה.
 *
 * הסינון וההזמנה הפתוחה הם state מקומי של הלשונית — הם לא מעניינים
 * אף לשונית אחרת.
 *
 * שורת הסיכום לפי סטטוס שהייתה כאן נמחקה. היא הציגה חמישה מספרים
 * שאיש לא פועל לפיהם, ואותם מספרים מופיעים עכשיו על שבבי הסינון
 * עצמם — שם הם גם אומרים למה הם טובים.
 */
import { useState } from 'react';
import { FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { STATUS_CONFIG } from './adminConstants';
import OrderCard from './OrderCard';

/* שבבי הסינון. "פתוחות" ראשון ומסומן בהתחלה: הזמנה שהושלמה היא
   היסטוריה, ומה שנשאר לעשות הוא כל השאר. "הכל" לידו למי שמחפש הזמנה
   מסוימת, ו"הושלמו" הוא שבב אחד משם. */
const OPEN_FILTER = { id: 'open', label: 'פתוחות' };
const ALL_FILTER = { id: 'all', label: 'הכל' };

const STATUS_FILTERS = Object.entries(STATUS_CONFIG).map(([id, cfg]) => ({
  id,
  /* לשון רבים על שבב שמסנן רשימה, יחיד על תווית שמתארת הזמנה אחת. */
  label: { new: 'חדשות', processing: 'בטיפול', ready_for_pickup: 'מוכנות לאיסוף', shipped: 'נשלחו', completed: 'הושלמו' }[id] || cfg.label,
}));

const FILTERS = [OPEN_FILTER, ALL_FILTER, ...STATUS_FILTERS];

/** מחזיר את ההזמנות שהשבב הנתון מציג. */
function applyFilter(orders, filter) {
  if (filter === 'all') return orders;
  if (filter === 'open') return orders.filter(o => o.status !== 'completed');
  return orders.filter(o => o.status === filter);
}

/** מציג את לשונית ההזמנות. */
function OrdersTab({ orders, onStatusChange, onDeleteOrder, onExport, ordersError }) {
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filter, setFilter] = useState('open');

  /* מהחדשה לישנה. השרת ממיין כך, אבל הסדר הוא החלטה של המסך הזה
     ולא משהו להסתמך עליו מרחוק. */
  const visible = applyFilter(orders, filter)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="admin-orders">
      <div className="orders-filter">
        <div className="orders-chips" role="group" aria-label="סינון הזמנות">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`orders-chip ${filter === id ? 'is-active' : ''}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}>
              {label}
              <span className="orders-chip-count">{applyFilter(orders, id).length}</span>
            </button>
          ))}
        </div>

        {orders.length > 0 && (
          <button type="button" className="orders-export-btn" onClick={onExport}>
            <FileSpreadsheet size={18} aria-hidden="true" /> ייצא לאקסל
          </button>
        )}
      </div>

      {ordersError && (
        <div className="admin-error">
          <AlertTriangle size={18} aria-hidden="true" /> {ordersError}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="admin-empty">
          {filter === 'open' ? 'אין הזמנות שמחכות לטיפול' : 'אין הזמנות להצגה'}
        </div>
      ) : (
        <div className="orders-list">
          {visible.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isOpen={expandedOrder === order.id}
              onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              onStatusChange={onStatusChange}
              onDelete={onDeleteOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersTab;
