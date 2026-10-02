/**
 * כרטיס הזמנה אחת במסך הניהול.
 *
 * הכרטיס הסגור מראה את כל מה שצריך כדי לטפל בהזמנה בלי לפתוח אותה:
 * מספר, מתי, סטטוס, אופן קבלה, סכום, שם וטלפון — ומתחתיהם שני
 * כפתורים. אחד הוא הצעד הבא של ההזמנה הזאת ולא רשימת סטטוסים לבחור
 * מתוכה, כי בכל מצב יש בדיוק צעד אחד שהגיוני לעשות; השני מתקשר
 * ללקוח. זה מה שמאפשר לטפל בהזמנה בלחיצה אחת.
 *
 * הטלפון בכותרת הוא טקסט ולא קישור, מפני שהכותרת כולה היא כפתור
 * הפתיחה ואסור לקנן קישור בתוך כפתור. ההתקשרות היא כפתור "התקשר"
 * שלידו, שהוא באמת <a href="tel:">.
 *
 * שינוי הסטטוס הידני נמצא בתצוגה הפתוחה ולא למעלה: הוא לתיקון טעות,
 * ולא הדרך הרגילה להתקדם. הרשימה בו מוגבלת לסטטוסים שמתאימים לאופן
 * הקבלה של ההזמנה — אותו כלל שהשרת אוכף.
 */
import {
  Store, Truck, Phone, ChevronDown, Settings, PackageCheck, Truck as TruckIcon, CheckCircle,
} from 'lucide-react';
import { STATUS_CONFIG, statusesForMethod, formatDate, timeAgo } from './adminConstants';
import { formatPrice, lineTotal } from '../../utils/pricing';

/* הצעד הבא לכל סטטוס. ב-processing הוא תלוי באופן הקבלה — הזמנת
   איסוף עצמי הופכת למוכנה בחנות, הזמנת משלוח יוצאת לדרך — ולכן שם
   יושב אובייקט לפי שיטה ולא צעד בודד. completed הוא הסוף, ואין לו
   כפתור. */
const NEXT_STEP = {
  new: { status: 'processing', label: 'התחל טיפול', Icon: Settings },
  processing: {
    pickup: { status: 'ready_for_pickup', label: 'מוכנה לאיסוף', Icon: PackageCheck },
    delivery: { status: 'shipped', label: 'נשלחה', Icon: TruckIcon },
  },
  ready_for_pickup: { status: 'completed', label: 'הושלמה', Icon: CheckCircle },
  shipped: { status: 'completed', label: 'הושלמה', Icon: CheckCircle },
  completed: null,
};

/** מחזיר את הצעד הבא של ההזמנה, או null כשאין מה לעשות. */
function nextStepOf(order) {
  const step = NEXT_STEP[order.status];
  if (!step) return null;
  return step.status ? step : step[order.delivery_method] || null;
}

/** מחזיר את תיאור אופן הקבלה, עם האייקון המתאים. */
function methodOf(order) {
  return order.delivery_method === 'pickup'
    ? { label: 'איסוף', Icon: Store }
    : { label: 'משלוח', Icon: Truck };
}

/** בונה את שורת הווריאנט, הצבע והמידה של פריט, או מחרוזת ריקה. */
function itemOptions(item) {
  return [item.selectedColor, item.selectedSize].filter(Boolean).join(' · ');
}

/** מציג כרטיס הזמנה אחת. */
function OrderCard({ order, isOpen, onToggle, onStatusChange, onDelete }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
  const next = nextStepOf(order);
  const method = methodOf(order);
  const fullDate = formatDate(order.created_at);

  return (
    <article className={`order-card ${order.status === 'new' ? 'is-new' : ''} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="order-card-head"
        aria-expanded={isOpen}
        onClick={onToggle}>
        <span className="order-card-line">
          <span className="order-card-number">#{order.id}</span>
          <span className={`order-card-status order-card-status--${order.status || 'new'}`}>
            <cfg.Icon size={16} aria-hidden="true" /> {cfg.label}
          </span>
          <ChevronDown className="order-card-chevron" size={22} aria-hidden="true" />
        </span>

        <span className="order-card-line">
          <span className="order-card-name">{order.customer_name}</span>
          <span className="order-card-total">{formatPrice(order.total)}</span>
        </span>

        <span className="order-card-line order-card-line--meta">
          <span className="order-card-phone">{order.customer_phone}</span>
          <span className="order-card-method">
            <method.Icon size={16} aria-hidden="true" /> {method.label}
          </span>
          <time className="order-card-age" dateTime={order.created_at} title={fullDate}>
            {timeAgo(order.created_at)}
          </time>
        </span>
      </button>

      <div className="order-card-actions">
        {next && (
          <button
            type="button"
            className="order-next-btn"
            onClick={() => onStatusChange(order.id, next.status)}>
            <next.Icon size={20} aria-hidden="true" /> {next.label}
          </button>
        )}

        <a className="order-call-btn" href={`tel:${order.customer_phone}`}>
          <Phone size={20} aria-hidden="true" /> התקשר
        </a>
      </div>

      {isOpen && (
        <div className="order-card-body">
          <ul className="order-items">
            {order.items.map((item, i) => (
              <li key={i} className="order-item">
                <span className="order-item-name">
                  {item.name}
                  {itemOptions(item) && <span className="order-item-options">{itemOptions(item)}</span>}
                </span>
                <span className="order-item-qty">×{item.quantity}</span>
                <span className="order-item-price">{formatPrice(lineTotal(item.price, item.quantity))}</span>
              </li>
            ))}
          </ul>

          <dl className="order-facts">
            <div className="order-fact">
              <dt>התקבלה</dt>
              <dd>{fullDate}</dd>
            </div>
            <div className="order-fact">
              <dt>סכום מוצרים</dt>
              <dd>{formatPrice(order.subtotal)}{order.delivery_fee > 0 && ` + ${formatPrice(order.delivery_fee)} משלוח`}</dd>
            </div>
            {order.delivery_address && (
              <div className="order-fact order-fact--wide">
                <dt>כתובת</dt>
                <dd>{order.delivery_address}</dd>
              </div>
            )}
            {order.customer_email && (
              <div className="order-fact order-fact--wide">
                <dt>אימייל</dt>
                <dd>{order.customer_email}</dd>
              </div>
            )}
            {order.notes && (
              <div className="order-fact order-fact--wide">
                <dt>הערות</dt>
                <dd>{order.notes}</dd>
              </div>
            )}
          </dl>

          <div className="order-card-fix">
            <label className="order-status-fix">
              שנה סטטוס
              <select
                value={order.status}
                onChange={(e) => onStatusChange(order.id, e.target.value)}>
                {statusesForMethod(order.delivery_method).map(key => (
                  <option key={key} value={key}>{STATUS_CONFIG[key].label}</option>
                ))}
              </select>
            </label>

            <button type="button" className="order-delete-btn" onClick={() => onDelete(order.id)}>
              מחק הזמנה
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default OrderCard;
