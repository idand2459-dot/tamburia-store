/**
 * רשימת הליקוט: שורות ההזמנה בתצוגה הפתוחה של כרטיס ההזמנה, כשכל
 * שורה היא תיבת סימון.
 *
 * הרשימה נועדה למי שעומד ליד המדף עם הטלפון ביד: תמונה כדי לזהות את
 * המוצר בלי לקרוא, כמות גדולה כי היא מה שטועים בו, ושורה שלמה שהיא
 * מטרת הלחיצה — לא תיבה קטנה בקצה. כל שורה היא <label> סביב
 * <input type="checkbox"> אמיתי, ולכן לחיצה בכל מקום בה מסמנת, רווח
 * במקלדת מסמן, וקורא מסך שומע את שם המוצר כשם התיבה.
 *
 * שורה מסומנת מקבלת רקע ירוק ו-V, ולא קו חוצה: את השם עוד צריך לקרוא
 * כשבודקים שוב מה כבר בשקית.
 *
 * התמונה נלקחת מהמוצר הנוכחי בקטלוג לפי ה-id שבשורה. מוצר שנמחק או
 * הוסתר מוצג עם אייקון הקטגוריה במקומה, כמו מוצר בלי תמונה —
 * ההזמנה עצמה נשארת כפי שנשמרה.
 *
 * השמירה וההחזרה בכישלון נמצאות ב-useAdminOrders (togglePicked); כאן
 * רק ההודעה, ליד הרשימה שנלחצה.
 */
import { useState } from 'react';
import { Check, Package } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { formatPrice, lineTotal } from '../../utils/pricing';
import { isPicked, pickProgress } from '../../utils/pickList';

/** בונה את שורת הגרסה, הצבע והמידה של פריט, או מחרוזת ריקה. */
function itemOptions(item) {
  return [item.selectedVariant, item.selectedColor, item.selectedSize].filter(Boolean).join(' · ');
}

/** התמונה הממוזערת של המוצר, או אייקון הקטגוריה כשאין מה להציג. */
function PickThumb({ product }) {
  const visible = product && product.active !== false;
  const Icon = CATEGORY_ICONS[product?.category] || Package;

  return (
    <span className="pick-thumb" aria-hidden="true">
      {visible && product.image_url
        ? <img src={product.image_url} alt="" loading="lazy" />
        : <Icon size={28} strokeWidth={1.5} />}
    </span>
  );
}

/** שורה אחת ברשימה: תיבה, תמונה, שם, פרטים, כמות וסכום. */
function PickLine({ item, product, picked, onChange }) {
  const options = itemOptions(item);

  return (
    <li className={`pick-line ${picked ? 'is-picked' : ''}`}>
      <label className="pick-line-label">
        <input
          type="checkbox"
          className="pick-input"
          checked={picked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="pick-box" aria-hidden="true">
          {picked && <Check size={22} strokeWidth={3} />}
        </span>

        <PickThumb product={product} />

        <span className="pick-text">
          <span className="pick-name">{item.name}</span>
          {options && <span className="pick-options">{options}</span>}
        </span>

        <span className="pick-amounts">
          <span className="pick-qty">
            <span className="visually-hidden">כמות</span> × {item.quantity}
          </span>
          <span className="pick-price">{formatPrice(lineTotal(item.price, item.quantity))}</span>
        </span>
      </label>
    </li>
  );
}

/**
 * ההתקדמות בכרטיס המכווץ: "3/5 הוכנו" ופס קטן. הפס הוא קישוט — הטקסט
 * שלידו אומר את אותו דבר — ולכן הוא aria-hidden.
 */
export function PickProgress({ order }) {
  const { done, total, complete } = pickProgress(order);
  if (total === 0) return null;

  return (
    <span className={`pick-progress ${complete ? 'is-complete' : ''}`}>
      <span className="pick-progress-bar" aria-hidden="true">
        <span className="pick-progress-fill" style={{ '--pick-done': `${(done / total) * 100}%` }} />
      </span>
      <span className="pick-progress-text">{done}/{total} הוכנו</span>
    </span>
  );
}

/** מציג את שורות ההזמנה כרשימת ליקוט. */
function PickList({ order, productsById, onTogglePicked }) {
  const [error, setError] = useState('');

  /** שומר סימון של שורה, ומציג את ההודעה אם השמירה נכשלה. */
  async function toggle(line, picked) {
    setError('');
    const message = await onTogglePicked(order.id, line, picked);
    if (message) setError(message);
  }

  return (
    <div className="pick-list-wrap">
      <ul className="pick-list" aria-label={`רשימת ליקוט להזמנה #${order.id}`}>
        {order.items.map((item, line) => (
          <PickLine
            key={line}
            item={item}
            product={productsById.get(item.id)}
            picked={isPicked(order, line)}
            onChange={(picked) => toggle(line, picked)}
          />
        ))}
      </ul>

      {error && <p className="pick-error" role="alert">{error}</p>}
    </div>
  );
}

export default PickList;
