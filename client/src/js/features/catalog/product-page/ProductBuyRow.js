/**
 * שורת הקנייה: בורר הכמות, "הוסף לעגלה" והלב.
 *
 * הכמות עצמה שייכת ל-ProductPage, כי גם הפס הצף בטלפון מוסיף לעגלה
 * ושניהם חייבים להוסיף את אותה כמות. מה שכן יושב כאן הוא הגבולות:
 * הכפתורים כבויים בקצוות, ולכן אין דרך להגיע דרך הממשק לכמות
 * מחוץ לטווח.
 *
 * ה-ref שמגיע בפרופס יושב על כפתור ההוספה, וזה מה ש-ProductPage
 * עוקב אחריו כדי לדעת מתי להראות את הפס בטלפון. הוא עובר גם לקישור
 * ההתקשרות שמחליף אותו, כדי שהפס ימשיך להופיע בדיוק באותו גובה
 * גם עבור מוצר בלי מחיר.
 *
 * מוצר בלי מחיר במסד אינו ניתן להזמנה, ובמקום "הוסף לעגלה" יש
 * כאן קישור tel לחנות. כפתור כבוי לבדו היה מסתיים בלא כלום:
 * למוצר כזה יש מחיר, הוא פשוט לא באתר.
 */
import { Minus, Plus, ShoppingCart, Check, Heart, Phone } from 'lucide-react';
import { PHONES } from '../../../utils/storeInfo';
import { CALL_FOR_PRICE_LABEL } from '../../../utils/pricing';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

/** מציג את בורר הכמות, כפתור ההוספה וכפתור המועדפים. */
function ProductBuyRow({
  quantity, onQuantity, inStock, hasPrice = true, added, onAdd, addRef,
  productName, inWishlist, onToggleWishlist,
}) {
  return (
    <div className="product-buy">
      <div className="product-buy-qty" role="group" aria-label="כמות">
        <button
          type="button"
          aria-label="הפחת כמות"
          disabled={quantity <= MIN_QUANTITY}
          onClick={() => onQuantity(quantity - 1)}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="product-buy-qty-value" aria-live="polite">{quantity}</span>
        <button
          type="button"
          aria-label="הוסף כמות"
          disabled={quantity >= MAX_QUANTITY}
          onClick={() => onQuantity(quantity + 1)}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {!hasPrice ? (
        <a
          ref={addRef}
          className="product-buy-call"
          href={`tel:${PHONES.store.tel}`}>
          <Phone size={18} aria-hidden="true" /> {CALL_FOR_PRICE_LABEL}
        </a>
      ) : (
        <button
          ref={addRef}
          type="button"
          className={`product-buy-add ${added ? 'is-added' : ''}`}
          onClick={onAdd}
          disabled={!inStock}>
          {!inStock ? 'אזל מהמלאי'
            : added ? <><Check size={18} aria-hidden="true" /> נוסף לעגלה</>
            : <><ShoppingCart size={18} aria-hidden="true" /> הוסף לעגלה</>}
        </button>
      )}

      <button
        type="button"
        className="product-buy-wish"
        aria-pressed={inWishlist}
        aria-label={inWishlist ? `הסר מהמועדפים: ${productName}` : `הוסף למועדפים: ${productName}`}
        onClick={onToggleWishlist}>
        <Heart size={20} fill={inWishlist ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
  );
}

export default ProductBuyRow;
