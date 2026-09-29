/**
 * שלב העגלה: רשימת הפריטים, אופן קבלת ההזמנה וסיכום הסכומים.
 *
 * מושך את מצב העגלה מ-StoreContext ומקבל בפרופס רק את מעבר השלבים
 * והסגירה, שהם עניין של הניתוב ולא של המצב המשותף.
 *
 * הסיכום והכפתור אינם כאן אלא ב-CartStepFooter שלמטה, כי הם יושבים
 * בשורה התחתונה הדביקה של המגירה ולא בגוף הגולל. שני הרכיבים שואבים
 * מאותו קונטקסט, ולכן אין מצב שהסיכום למטה יסתור את השורות למעלה.
 *
 * פריט במחיר 0 הוא מוצר שהמחיר שלו במסד עוד לא הוקלד. באתר כבר אי
 * אפשר להוסיף מוצר כזה לעגלה, אבל עגלה נשמרת ב-localStorage וכזה
 * שנוסף קודם עדיין יושב בה — ולכן הוא מטופל גם כאן. השרת דוחה הזמנה
 * כזו ב-400, אז הכפתור חוסם אותה כאן במקום לשלוח אותה לסירוב.
 *
 * ופריט של מוצר שהוסתר מהקטלוג מאז שנוסף מטופל בדיוק באותו אופן,
 * ומאותה סיבה: הוא נראה תקין בעגלה, השרת ידחה אותו, ועדיף שהלקוח
 * יבין למה כאן. מי אלה — useAvailability, דרך ההקשר.
 */
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { useStore } from '../../context/storeContext';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { NO_PRICE_LABEL, UNAVAILABLE_LABEL } from '../../utils/pricing';
import DeliveryOptions from './DeliveryOptions';

/* פריט בעגלה נשפט לפי המחיר שנשמר בו ולא לפי המוצר: המוצר עצמו כבר
   אינו בהישג יד כאן, והמחיר שהועתק אליו בהוספה הוא מה שההזמנה תישלח
   איתו בפועל. */
const itemPriced = (item) => Number(item.price) > 0;

/** מרכיב את שורת הגרסה, הצבע והמידה של פריט — מה שנבחר ממנו. */
function itemMeta(item) {
  return [item.selectedVariant, item.selectedColor, item.selectedSize]
    .filter(Boolean).join(' · ');
}

/** מציג את תוכן העגלה ואת בחירת אופן הקבלה. */
function CartStepView({ closeCart }) {
  const { cart, updateQuantity, removeFromCart, unavailableIds } = useStore();

  if (cart.length === 0) {
    return (
      <div className="cart-empty">
        <span className="cart-empty-icon" aria-hidden="true">
          <ShoppingCart size={28} strokeWidth={1.5} />
        </span>
        <p className="cart-empty-title">העגלה ריקה</p>
        <p className="cart-empty-text">כל מה שתוסיפו יופיע כאן, ויחכה גם אחרי סגירת הדף.</p>
        <button type="button" className="cart-cta cart-cta--outline" onClick={closeCart}>
          להמשך קנייה
        </button>
      </div>
    );
  }

  return (
    <>
      <ul className="cart-rows">
        {cart.map((item, index) => {
          const Icon = CATEGORY_ICONS[item.category];
          const meta = itemMeta(item);
          const unavailable = unavailableIds.has(item.id);
          return (
            <li key={index} className={`cart-row ${unavailable ? 'is-unavailable' : ''}`}>
              <div className="cart-row-well">
                {item.image_url
                  ? <img className="cart-row-img" src={item.image_url} alt={item.name} />
                  : (
                    /* אייקון הקטגוריה, כמו בכרטיס המוצר ובגלריה */
                    <span className="cart-row-fallback" aria-hidden="true">
                      {Icon && <Icon size={22} strokeWidth={1.5} />}
                    </span>
                  )}
              </div>

              <div className="cart-row-main">
                <span className="cart-row-name">{item.name}</span>
                {meta && <span className="cart-row-meta">{meta}</span>}
                {unavailable && <span className="cart-row-flag">{UNAVAILABLE_LABEL}</span>}

                <div className="cart-row-foot">
                  <div className="cart-row-qty" role="group" aria-label={`כמות: ${item.name}`}>
                    <button type="button" aria-label="הפחת כמות" onClick={() => updateQuantity(index, -1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="cart-row-qty-value" aria-live="polite">{item.quantity || 1}</span>
                    <button type="button" aria-label="הוסף כמות" onClick={() => updateQuantity(index, 1)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <span className={`cart-row-total ${itemPriced(item) ? '' : 'is-no-price'}`}>
                    {itemPriced(item)
                      ? `₪${item.price * (item.quantity || 1)}`
                      : NO_PRICE_LABEL}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="cart-row-remove"
                onClick={() => removeFromCart(index)}
                aria-label={`הסר: ${item.name}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <DeliveryOptions />
    </>
  );
}

/**
 * הסיכום והכפתור שיושבים בשורה התחתונה של המגירה.
 *
 * "רוקן עגלה" נשאר עם אותו אישור שהיה לו — כלומר בלי אישור — ורק
 * מפסיק להיות בלוק אדום ברוחב מלא מתחת לכפתור האמיתי.
 */
function CartStepFooter({ setCartStep }) {
  const {
    cart, setCart, subtotal, total, deliveryMethod, setDeliveryMethod, unavailableIds,
  } = useStore();

  const unpriced = cart.filter((item) => !itemPriced(item));
  const unavailable = cart.filter((item) => unavailableIds.has(item.id));
  const canContinue = Boolean(deliveryMethod)
    && unpriced.length === 0
    && unavailable.length === 0;

  return (
    <div className="cart-summary">
      <div className="cart-summary-row">
        <span>סכום מוצרים</span>
        <span>₪{subtotal}</span>
      </div>
      {deliveryMethod && (
        <div className="cart-summary-row">
          <span>משלוח</span>
          {deliveryMethod === 'pickup'
            ? <span className="cart-summary-free">חינם</span>
            : <span>₪20</span>}
        </div>
      )}
      <div className="cart-summary-total">
        <span>סה"כ לתשלום</span>
        <span className="cart-summary-amount">₪{total}</span>
      </div>

      {/* חוסם אחד בכל פעם, לפי הסדר שבו הם נפתרים: מוצר שאינו בקטלוג
          אי אפשר לתקן בכלל, מוצר בלי מחיר אפשר להזמין בטלפון, ובחירת
          אופן קבלה היא רק צעד שטרם נעשה. שתי הודעות בבת אחת רק מבלבלות */}
      {unavailable.length > 0 ? (
        <p className="cart-summary-hint cart-summary-hint--blocking">
          {unavailable.length === 1
            ? `"${unavailable[0].name}" ${UNAVAILABLE_LABEL} — הסירו אותו מהעגלה, או התקשרו לחנות לבירור`
            : `${unavailable.length} מוצרים בעגלה אינם זמינים כרגע — הסירו אותם, או התקשרו לחנות לבירור`}
        </p>
      ) : unpriced.length > 0 ? (
        <p className="cart-summary-hint cart-summary-hint--blocking">
          {unpriced.length === 1
            ? `"${unpriced[0].name}" ללא מחיר באתר — הסירו אותו מהעגלה, או התקשרו לחנות להזמנה טלפונית`
            : `${unpriced.length} מוצרים בעגלה ללא מחיר באתר — הסירו אותם, או התקשרו לחנות להזמנה טלפונית`}
        </p>
      ) : !deliveryMethod && (
        <p className="cart-summary-hint">בחר אופן קבלה לפני המשך</p>
      )}

      <button
        type="button"
        className="cart-cta"
        disabled={!canContinue}
        onClick={() => canContinue && setCartStep('details')}>
        המשך לפרטים ←
      </button>

      <button
        type="button"
        className="cart-clear"
        onClick={() => { setCart([]); setDeliveryMethod(null); }}>
        רוקן עגלה
      </button>
    </div>
  );
}

export { CartStepFooter };
export default CartStepView;
