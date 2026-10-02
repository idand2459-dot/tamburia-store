/**
 * כרטיס מוצר אחד ברשת — הכרטיס המשותף לכל מקום שמציג מוצרים.
 *
 * כרגע עמוד הקטגוריה משתמש בו; המוצרים הדומים והנצפים לאחרונה שבעמוד
 * המוצר יעברו אליו בשלב הבא.
 *
 * ה-className, ה-style וה-ref שהוא מקבל הם מה שמאפשר לו להיות אלמנט
 * החשיפה בעצמו — <Reveal as={ProductCard} …> — ולא להיעטף ב-div שהיה
 * הופך לפריט הרשת במקומו ושובר את מידות הכרטיס. ב-React 19 ref הוא prop
 * רגיל, ולכן אין צורך ב-forwardRef.
 *
 * הניווט הוא קישור אמיתי ולא onClick על div: שם המוצר עטוף ב-Link,
 * וה-::after שלו ב-CSS נמתח על כל הכרטיס. מכאן שכל הכרטיס לחיץ, אבל
 * יש בו תחנת Tab אחת במקום כרטיס שמתחזה לקישור — ולחיצה אמצעית,
 * Ctrl+לחיצה ו"פתח בלשונית חדשה" עובדות כמו בכל קישור אחר. שני
 * הכפתורים יושבים מעל אותו ::after ולכן אינם מנווטים.
 */
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { SUBCATEGORY_NAMES } from '../features/catalog/categories';
import CATEGORY_ICONS from '../utils/categoryIcons';
import { orderablePrice, NO_PRICE_LABEL, UNAVAILABLE_LABEL, formatPrice } from '../utils/pricing';

/* כמה זמן הכפתור מראה וי אחרי הוספה. מספיק כדי להיראות, קצר מכדי
   להיראות כמו מצב תקוע. */
const ADDED_MS = 1200;

/** מציג כרטיס מוצר אחד. */
function ProductCard({
  product, categoryId, onAddToCart, inWishlist, onToggleWishlist,
  unavailable = false,
  className = '', style, ref,
}) {
  const [added, setAdded] = useState(false);
  // תמונה שבורה: state ולא הסתרה ישירה של האלמנט כמו קודם. הכרטיסים
  // ממויינים מחדש בלי להיווצר מחדש, ומחיקת style בזמן רינדור הייתה
  // נשארת על הכרטיס גם אחרי שהוא הוצב על מוצר אחר.
  const [imageFailed, setImageFailed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const Icon = CATEGORY_ICONS[categoryId];
  /* unavailable מגיע רק מרשימות ששמורות אצל הלקוח — המועדפים והנצפים
     לאחרונה. רשת שנשלפה מהשרת מכילה ממילא רק מוצרים שנמכרים. */
  const inStock = product.in_stock !== false && !unavailable;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const showImage = Boolean(product.image_url) && !imageFailed;
  // מוצר בלי מחיר במסד — לא מוצג "₪0" ולא ניתן להוסיף אותו
  // לעגלה. הכלל עצמו ב-utils/pricing.js.
  const price = orderablePrice(product);
  const subcategory = SUBCATEGORY_NAMES[product.subcategory];

  function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock || unavailable || price === null) return;
    onAddToCart(product);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_MS);
  }

  function handleWishlist(e) {
    e.preventDefault();
    e.stopPropagation();
    onToggleWishlist(product);
  }

  return (
    <article
      ref={ref}
      style={style}
      className={[
        'product-card',
        unavailable ? 'product-card--unavailable' : inStock ? '' : 'product-card--out',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="product-card-window">
        {showImage ? (
          <img
            className="product-card-image"
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          /* אייקון הקטגוריה, לא האות הראשונה של שם המוצר: אות ענקית
             נראתה כמו תוכן ולא כמו "אין עדיין תמונה". */
          <span className="product-card-fallback" aria-hidden="true">
            {Icon && <Icon size={40} strokeWidth={1.5} />}
          </span>
        )}

        <button
          type="button"
          className={`product-card-wish ${inWishlist ? 'is-active' : ''}`}
          aria-label={inWishlist ? `הסר מהמועדפים: ${product.name}` : `הוסף למועדפים: ${product.name}`}
          aria-pressed={inWishlist}
          onClick={handleWishlist}
        >
          <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        {/* תגית אחת בלבד: מוצר שאינו בקטלוג אינו גם "אזל מהמלאי" */}
        {unavailable
          ? <span className="product-card-badge">{UNAVAILABLE_LABEL}</span>
          : !inStock && <span className="product-card-badge">אזל מהמלאי</span>}
      </div>

      <div className="product-card-body">
        {/* מרונדר תמיד, גם ריק: אחרת מוצר בלי תת-קטגוריה היה מרים את
            השם שלו שורה מעל שכניו */}
        <span className="product-card-sub">{subcategory}</span>

        <h3 className="product-card-name">
          <Link className="product-card-link" to={`/product/${product.id}`}>{product.name}</Link>
        </h3>

        {product.sku && <span className="product-card-sku">מק"ט: {product.sku}</span>}

        {/* נדחף לתחתית הכרטיס, כך ששורות המחיר של כל הכרטיסים בשורה
            אחת מיושרות גם כשלחלקם יש מק"ט ולחלקם אין */}
        <div className="product-card-foot">
          <p className={`product-card-price ${price === null ? 'is-no-price' : ''}`}>
            {price === null ? NO_PRICE_LABEL : variants.length > 0 ? (
              <>
                מ-{formatPrice(price)}
                <span className="product-card-variants"> · {variants.length} גרסאות</span>
              </>
            ) : (
              <>{formatPrice(price)}</>
            )}
          </p>

          <button
            type="button"
            className={`product-card-cart ${added ? 'is-added' : ''}`}
            aria-label={unavailable
              ? `${product.name}: ${UNAVAILABLE_LABEL}, לא ניתן להוסיף לעגלה`
              : price === null
                ? `${product.name}: ${NO_PRICE_LABEL}, לא ניתן להוסיף לעגלה`
                : `הוסף לעגלה: ${product.name}`}
            onClick={handleAdd}
            disabled={!inStock || unavailable || price === null}
          >
            {added
              ? <Check size={18} aria-hidden="true" />
              : <ShoppingCart size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
