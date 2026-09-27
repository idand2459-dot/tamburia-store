/**
 * הפס הצף בתחתית המסך בטלפון: מחיר וכפתור הוספה.
 *
 * מוצג רק כשכפתור ההוספה האמיתי יצא מהמסך — ההחלטה עצמה נעשית
 * ב-ProductPage, שמחזיק את ה-IntersectionObserver ואת הכמות, כך
 * ששני הכפתורים מוסיפים בדיוק את אותו דבר.
 *
 * ה-class על ה-body הוא מה שמרים את כפתורי הוואטסאפ והחזרה-למעלה
 * מעל הפס במקום להסתיר אותם. הוא נוסף כאן ולא ב-ProductPage מפני
 * שהוא חייב לירד בדיוק כשהפס נעלם, וזה בדיוק אורך החיים של הרכיב.
 * ב-CSS ההרמה יושבת בתוך שאילתת ה-768px, ולכן במסך רחב — שבו הפס
 * לא מוצג בכלל — שום דבר לא זז.
 */
import { useEffect } from 'react';
import { ShoppingCart, Check } from 'lucide-react';

/** מציג את פס הקנייה הצף. */
function ProductBuyBar({ price, quantity, inStock, added, onAdd }) {
  useEffect(() => {
    document.body.classList.add('has-buy-bar');
    return () => document.body.classList.remove('has-buy-bar');
  }, []);

  return (
    <div className="product-buy-bar">
      <span className="product-buy-bar-price">
        ₪{price}
        {quantity > 1 && <span className="product-buy-bar-qty">× {quantity}</span>}
      </span>

      <button
        type="button"
        className={`product-buy-bar-add ${added ? 'is-added' : ''}`}
        onClick={onAdd}
        disabled={!inStock}>
        {!inStock ? 'אזל מהמלאי'
          : added ? <><Check size={18} aria-hidden="true" /> נוסף לעגלה</>
          : <><ShoppingCart size={18} aria-hidden="true" /> הוסף לעגלה</>}
      </button>
    </div>
  );
}

export default ProductBuyBar;
