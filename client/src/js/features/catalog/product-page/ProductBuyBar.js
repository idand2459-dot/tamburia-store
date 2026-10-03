/**
 * הפס הצף בתחתית המסך בטלפון: מחיר וכפתור הוספה.
 *
 * מוצג רק כשכפתור ההוספה האמיתי יצא מהמסך — ההחלטה עצמה נעשית
 * ב-ProductDetails, שמחזיק את ה-IntersectionObserver ואת הכמות, כך
 * ששני הכפתורים מוסיפים בדיוק את אותו דבר.
 *
 * ה-class על ה-body הוא מה שמרים את כפתורי הוואטסאפ והחזרה-למעלה
 * מעל הפס במקום להסתיר אותם. הוא נוסף כאן ולא ב-ProductDetails מפני
 * שהוא חייב לירד בדיוק כשהפס נעלם, וזה בדיוק אורך החיים של הרכיב.
 * ב-CSS ההרמה יושבת בתוך שאילתת ה-768px, ולכן במסך רחב — שבו הפס
 * לא מוצג בכלל — שום דבר לא זז.
 */
import { useEffect } from 'react';
import { ShoppingCart, Check, Phone } from 'lucide-react';
import { PHONES } from '../../../utils/storeInfo';
import { NO_PRICE_LABEL, CALL_FOR_PRICE_LABEL, formatPrice } from '../../../utils/pricing';

/**
 * מציג את פס הקנייה הצף.
 *
 * price הוא null למוצר שהמחיר שלו במסד 0, ואז הפס מציג "מחיר
 * בחנות" וקישור התקשרות במקום ההוספה — אותה החלפה שבשורת
 * הקנייה למעלה, כדי שהפס לא יציע מה שהעמוד לא מאפשר.
 */
function ProductBuyBar({ price, quantity, inStock, added, onAdd }) {
  useEffect(() => {
    document.body.classList.add('has-buy-bar');
    return () => document.body.classList.remove('has-buy-bar');
  }, []);

  return (
    <div className="product-buy-bar">
      <span className={`product-buy-bar-price ${price === null ? 'is-no-price' : ''}`}>
        {price === null ? NO_PRICE_LABEL : formatPrice(price)}
        {price !== null && quantity > 1 && <span className="product-buy-bar-qty">× {quantity}</span>}
      </span>

      {price === null ? (
        <a className="product-buy-bar-call" href={`tel:${PHONES.store.tel}`}>
          <Phone size={18} aria-hidden="true" /> {CALL_FOR_PRICE_LABEL}
        </a>
      ) : (
        <button
          type="button"
          className={`product-buy-bar-add ${added ? 'is-added' : ''}`}
          onClick={onAdd}
          disabled={!inStock}>
          {!inStock ? 'אזל מהמלאי'
            : added ? <><Check size={18} aria-hidden="true" /> נוסף לעגלה</>
            : <><ShoppingCart size={18} aria-hidden="true" /> הוסף לעגלה</>}
        </button>
      )}
    </div>
  );
}

export default ProductBuyBar;
