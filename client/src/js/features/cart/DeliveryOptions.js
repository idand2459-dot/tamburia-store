/**
 * בחירת אופן קבלת ההזמנה — איסוף עצמי או משלוח.
 *
 * שני כרטיסים על רדיו אמיתי. קודם הם היו divים עם onClick, מה שאומר
 * שאי אפשר היה להגיע אליהם ב-Tab, לבחור בחצים או לשמוע מהקורא שיש
 * כאן בחירה בכלל. הקלט עצמו מוסתר לעין אבל נשאר תחנת מיקוד, ולכן כל
 * התנהגות המקלדת של רדיו מגיעה מהדפדפן ולא מקוד שלנו.
 *
 * הדמי 20 ₪ מוצג כאן ומחושב ב-useCart; שניהם נגזרים מאותו מספר בעולם
 * ולא אחד מהשני, ולכן שינוי מחיר משלוח נוגע בשני הקבצים.
 */
import { Store, Truck } from 'lucide-react';
import { useStore } from '../../context/storeContext';
import { ADDRESS } from '../../utils/storeInfo';

const OPTIONS = [
  {
    value: 'pickup',
    Icon: Store,
    name: 'איסוף עצמי',
    price: 'חינם',
    free: true,
    desc: `${ADDRESS.full} · באותו יום בשעות הפעילות`,
  },
  {
    value: 'delivery',
    Icon: Truck,
    name: 'משלוח',
    price: '₪20',
    free: false,
    desc: 'פתח תקווה · גני תקווה · קריית אונו',
  },
];

/** מציג את שני כרטיסי אופן הקבלה. */
function DeliveryOptions() {
  const { deliveryMethod, setDeliveryMethod } = useStore();

  return (
    <fieldset className="delivery-options">
      <legend className="delivery-options-title">אופן קבלת ההזמנה</legend>

      <div className="delivery-options-list">
        {OPTIONS.map(({ value, Icon, name, price, free, desc }) => (
          <label
            key={value}
            className={`delivery-option ${deliveryMethod === value ? 'is-selected' : ''}`}>
            <input
              type="radio"
              className="delivery-option-input"
              name="delivery-method"
              value={value}
              checked={deliveryMethod === value}
              onChange={() => setDeliveryMethod(value)}
            />
            {/* טבעת המיקוד. שכבה משלה ולא :has() על התווית: הפרויקט
                מצייר טבעות על אלמנט נמתח במקומות אחרים מאותה סיבה. */}
            <span className="delivery-option-ring" aria-hidden="true" />

            <span className="delivery-option-icon" aria-hidden="true">
              <Icon size={20} />
            </span>

            <span className="delivery-option-body">
              <span className="delivery-option-head">
                <span className="delivery-option-name">{name}</span>
                <span className={`delivery-option-price ${free ? 'delivery-option-price--free' : ''}`}>
                  {price}
                </span>
              </span>
              <span className="delivery-option-desc">{desc}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default DeliveryOptions;
