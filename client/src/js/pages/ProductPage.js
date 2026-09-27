/**
 * עמוד המוצר: מרכיב את הגלריה, הבוררים, חוות הדעת והמוצרים הדומים.
 *
 * כאן נשאר רק מה שיותר מחלק אחד צריך: הגרסה, הצבע והמידה שנבחרו
 * (כי מהם מורכב הפריט שנכנס לעגלה), הכמות — שגם שורת הקנייה וגם הפס
 * הצף בטלפון מוסיפים לפיה — מצב ההוספה והמועדפים, השליפות, והאיפוס
 * במעבר בין מוצרים. כל חלק שמחזיק state שרק הוא צריך — התמונה
 * המוצגת בגלריה, מצב טופס הביקורת — מחזיק אותו בעצמו.
 *
 * הבדיקה שלפני ההוספה לעגלה לא פותחת יותר alert של הדפדפן: היא
 * מסמנת איזה בורר חסר (missing) ומעבירה אליו את המיקוד, והבורר עצמו
 * מציג את השורה האדומה.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, Share2 } from 'lucide-react';
import { toggleWishlist, isInWishlist } from '../utils/wishlistUtils';
import categories from '../features/catalog/categories';
import ProductBreadcrumb from '../features/catalog/product-page/ProductBreadcrumb';
import ProductGallery from '../features/catalog/product-page/ProductGallery';
import ProductVariantSelector from '../features/catalog/product-page/ProductVariantSelector';
import ProductBuyRow from '../features/catalog/product-page/ProductBuyRow';
import ProductTrustRow from '../features/catalog/product-page/ProductTrustRow';
import ProductBuyBar from '../features/catalog/product-page/ProductBuyBar';
import ProductReviewsSection from '../features/catalog/product-page/ProductReviewsSection';
import RelatedProducts from '../features/catalog/product-page/RelatedProducts';
import Stars from '../features/catalog/product-page/Stars';

const MAX_RECENT = 6;
const MAX_RELATED = 3;

/* כמה זמן הכפתור מראה "נוסף לעגלה". מספיק כדי להיראות, קצר מכדי
   להיראות כמו מצב תקוע — בערך כמו כרטיס המוצר ברשת. */
const ADDED_MS = 1500;

/** קורא את רשימת המוצרים שנצפו לאחרונה. */
function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('tamburia-recent')) || []; }
  catch { return []; }
}

/** מוסיף מוצר לראש רשימת הנצפים לאחרונה. */
function addToRecentlyViewed(product) {
  const recent = getRecentlyViewed().filter(p => p.id !== product.id);
  const updated = [{ id: product.id, name: product.name, price: product.price, image_url: product.image_url, in_stock: product.in_stock, category: product.category }, ...recent].slice(0, MAX_RECENT);
  localStorage.setItem('tamburia-recent', JSON.stringify(updated));
}

/**
 * מדווח כשהאלמנט שב-ref יצא מהמסך.
 *
 * זה מה שמחליט אם הפס הצף בטלפון מוצג. בדפדפן בלי IntersectionObserver
 * התשובה נשארת "בתוך המסך", כלומר הפס פשוט לא יופיע — כפתור ההוספה
 * האמיתי תמיד שם, וה-CSS מציג את הפס רק בטלפון בכל מקרה.
 */
function useOutOfView(ref, resetKey) {
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    setOutOfView(false);
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== 'function') return;

    const observer = new IntersectionObserver(
      ([entry]) => setOutOfView(!entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, resetKey]);

  return outOfView;
}

/** מציג את עמוד המוצר. */
function ProductPage({ product, onAddToCart, onSelectProduct }) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(hasVariants ? product.variants[0] : null);
  const [quantity, setQuantity] = useState(1);
  const [missing, setMissing] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [inWishlist, setInWishlist] = useState(false);

  const addBtnRef = useRef(null);
  const reviewsRef = useRef(null);
  const variantRef = useRef(null);
  const colorRef = useRef(null);
  const sizeRef = useRef(null);
  const addedTimer = useRef(null);

  const inStock = product.in_stock !== false;
  const category = categories.find(c => c.id === product.category);
  const price = selectedVariant ? selectedVariant.price : product.price;
  const showBuyBar = useOutOfView(addBtnRef, product.id);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  useEffect(() => {
    setSelectedColor(null); setSelectedSize(null); setAddedToCart(false);
    setQuantity(1); setMissing(null);
    setSelectedVariant(hasVariants ? product.variants[0] : null);

    addToRecentlyViewed(product);
    setRecentlyViewed(getRecentlyViewed().filter(p => p.id !== product.id));
    setInWishlist(isInWishlist(product.id));

    // הסינון לפי קטגוריה נעשה בשרת ולא כאן. קודם נשלף כל הקטלוג רק
    // כדי למצוא שלושה מוצרים — 4 מבוקשים כדי שאפשר יהיה להוציא את
    // המוצר הנוכחי ועדיין להישאר עם שלושה. limit גורם לשרת להחזיר
    // { products, pagination } במקום מערך, ולכן שתי הצורות נתמכות.
    fetch(`/api/products?category=${encodeURIComponent(product.category)}&limit=${MAX_RELATED + 1}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.products || []);
        setRelatedProducts(list.filter(p => p.id !== product.id).slice(0, MAX_RELATED));
      })
      .catch(() => {});

    fetch(`/api/reviews?type=product&product_id=${product.id}`)
      .then(r => r.json()).then(setReviews).catch(() => {});
  }, [product.id]);

  /** מחזיר את שם הבורר הראשון שחסרה בו בחירה, או null. */
  function firstMissingChoice() {
    if (hasVariants && !selectedVariant) return 'variant';
    if (product.colors && product.colors.length > 0 && !selectedColor) return 'color';
    if (product.sizes && product.sizes.length > 0 && !selectedSize) return 'size';
    return null;
  }

  /** מוסיף את המוצר לעגלה לאחר בחירת הגרסה, הצבע והמידה. */
  function handleAddToCart() {
    const missingChoice = firstMissingChoice();
    if (missingChoice) {
      setMissing(missingChoice);
      const focusTarget = { variant: variantRef, color: colorRef, size: sizeRef }[missingChoice];
      focusTarget.current?.focus();
      return;
    }

    const variantLabel = selectedVariant ? selectedVariant.label : null;
    onAddToCart({ ...product, price, selectedColor, selectedSize, selectedVariant: variantLabel }, quantity);
    setAddedToCart(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedToCart(false), ADDED_MS);
  }

  /** משתף את המוצר בוואטסאפ. */
  function handleShare() {
    const url = window.location.href;
    const text = `היי! ראיתי את המוצר הזה בטכניק טמבור ונראה לי מעניין 🔧\n*${product.name}* — ₪${product.price}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  /** גולל לחוות הדעת, מסיכום הדירוג שליד שם המוצר. */
  function scrollToReviews() {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="product-page">
      <ProductBreadcrumb categoryId={product.category} productName={product.name} />

      <div className="product-page-content">
        <ProductGallery product={product} />

        {/* Details */}
        <div className="product-page-details">
          <div className="product-detail-head">
            {category && (
              <Link className="product-detail-category" to={`/category/${category.id}`}>
                {category.name}
              </Link>
            )}

            <div className="product-detail-name-row">
              <h1 className="product-detail-name">{product.name}</h1>
              <button
                type="button"
                className="product-detail-share"
                onClick={handleShare}
                aria-label="שיתוף בוואטסאפ">
                <Share2 size={18} aria-hidden="true" />
              </button>
            </div>

            {product.sku && <p className="product-detail-sku">מק"ט: {product.sku}</p>}

            {avgRating && (
              <button type="button" className="product-detail-rating" onClick={scrollToReviews}>
                <Stars rating={Math.round(avgRating)} />
                <span className="product-detail-rating-avg">{avgRating}</span>
                <span className="product-detail-rating-count">({reviews.length} ביקורות)</span>
              </button>
            )}
          </div>

          <div className="product-detail-pricing">
            <span className="product-detail-price">₪{price}</span>
            {hasVariants && !selectedVariant && (
              <span className="product-detail-price-note">בחר גרסה</span>
            )}
            <span className={`product-detail-stock ${inStock ? 'product-detail-stock--in' : 'product-detail-stock--out'}`}>
              {inStock
                ? <><Check size={14} aria-hidden="true" /> יש במלאי</>
                : 'אזל מהמלאי'}
            </span>
          </div>

          <ProductVariantSelector
            product={product}
            hasVariants={hasVariants}
            selectedVariant={selectedVariant}
            onSelectVariant={v => { setSelectedVariant(v); setMissing(null); }}
            selectedColor={selectedColor}
            onSelectColor={c => { setSelectedColor(c); setMissing(null); }}
            selectedSize={selectedSize}
            onSelectSize={s => { setSelectedSize(s); setMissing(null); }}
            missing={missing}
            variantRef={variantRef}
            colorRef={colorRef}
            sizeRef={sizeRef}>
            {product.description && (
              <div className="product-detail-description">
                <h2>תיאור המוצר</h2>
                <p>{product.description}</p>
              </div>
            )}
          </ProductVariantSelector>

          <ProductBuyRow
            quantity={quantity}
            onQuantity={setQuantity}
            inStock={inStock}
            added={addedToCart}
            onAdd={handleAddToCart}
            addRef={addBtnRef}
            productName={product.name}
            inWishlist={inWishlist}
            onToggleWishlist={() => setInWishlist(toggleWishlist(product))}
          />

          <ProductTrustRow />
        </div>
      </div>

      <ProductReviewsSection ref={reviewsRef} productId={product.id} reviews={reviews} />

      <RelatedProducts
        recentlyViewed={recentlyViewed}
        relatedProducts={relatedProducts}
        onSelectProduct={onSelectProduct}
      />

      {showBuyBar && (
        <ProductBuyBar
          price={price}
          quantity={quantity}
          inStock={inStock}
          added={addedToCart}
          onAdd={handleAddToCart}
        />
      )}
    </div>
  );
}

export default ProductPage;
