/**
 * עמוד המוצר: מרכיב את הגלריה, הבוררים, חוות הדעת והמוצרים הדומים.
 *
 * כאן נשאר רק מה שיותר מחלק אחד צריך: הגרסה, הצבע והמידה שנבחרו
 * (כי מהם מורכב הפריט שנכנס לעגלה), מצב ההוספה והמועדפים, השליפות,
 * והאיפוס במעבר בין מוצרים. כל חלק שמחזיק state שרק הוא צריך —
 * התמונה המוצגת בגלריה, מצב טופס הביקורת — מחזיק אותו בעצמו.
 */
import { useState, useEffect } from 'react';
import { toggleWishlist, isInWishlist } from '../utils/wishlistUtils';
import ProductGallery from '../features/catalog/product-page/ProductGallery';
import ProductVariantSelector from '../features/catalog/product-page/ProductVariantSelector';
import ProductReviewsSection from '../features/catalog/product-page/ProductReviewsSection';
import RelatedProducts from '../features/catalog/product-page/RelatedProducts';
import Stars from '../features/catalog/product-page/Stars';

const MAX_RECENT = 6;
const MAX_RELATED = 3;

const CATEGORY_LABELS = {
  painting: 'מוצרי צביעה', kitchen: 'מוצרי מטבח', bathroom: 'מוצרי אמבטיה',
  tools: 'כלי עבודה', cleaning: 'ניקיון', garden: 'גינה',
  plumbing: 'אינסטלציה', adhesives: 'דבקים', locks: 'צילינדרים ומנעולים',
  faucets: 'ברזים', electrical: 'מוצרי חשמל', home: 'בית'
};

/** קורא את רשימת המוצרים שנצפו לאחרונה. */
function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('tamburia-recent')) || []; }
  catch { return []; }
}

/** מוסיף מוצר לראש רשימת הנצפים לאחרונה. */
function addToRecentlyViewed(product) {
  const recent = getRecentlyViewed().filter(p => p.id !== product.id);
  const updated = [{ id: product.id, name: product.name, price: product.price, image_url: product.image_url, in_stock: product.in_stock }, ...recent].slice(0, MAX_RECENT);
  localStorage.setItem('tamburia-recent', JSON.stringify(updated));
}

/** מציג את עמוד המוצר. */
function ProductPage({ product, onBack, onAddToCart, onSelectProduct }) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(hasVariants ? product.variants[0] : null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [inWishlist, setInWishlist] = useState(false);

  const inStock = product.in_stock !== false;

  useEffect(() => {
    setSelectedColor(null); setSelectedSize(null); setAddedToCart(false);
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

  /** מוסיף את המוצר לעגלה לאחר בחירת הגרסה, הצבע והמידה. */
  function handleAddToCart() {
    if (hasVariants && !selectedVariant) {
      alert('אנא בחר גרסה לפני ההוספה לעגלה'); return;
    }
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert('אנא בחר צבע לפני ההוספה לעגלה'); return;
    }
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      alert('אנא בחר מידה לפני ההוספה לעגלה'); return;
    }
    const effectivePrice = selectedVariant ? selectedVariant.price : product.price;
    const variantLabel = selectedVariant ? selectedVariant.label : null;
    onAddToCart({ ...product, price: effectivePrice, selectedColor, selectedSize, selectedVariant: variantLabel });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  /** משתף את המוצר בוואטסאפ. */
  function handleShare() {
    const url = window.location.href;
    const text = `היי! ראיתי את המוצר הזה בטכניק טמבור ונראה לי מעניין 🔧\n*${product.name}* — ₪${product.price}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="product-page">
      <button className="back-btn product-page-back" onClick={onBack}>← חזרה למוצרים</button>

      <div className="product-page-content">
        <ProductGallery product={product} />

        {/* Details */}
        <div className="product-page-details">
          <div className="breadcrumb">
            <button onClick={onBack}>ראשי</button>
            <span>←</span>
            <button onClick={onBack}>{CATEGORY_LABELS[product.category] || product.category}</button>
            <span>←</span>
            <span className="breadcrumb-current">{product.name}</span>
          </div>

          <h1 className="product-page-name">{product.name}</h1>
          {product.sku && <p className="product-page-sku">מק"ט: <span>{product.sku}</span></p>}

          {avgRating && (
            <div className="product-rating-summary">
              <Stars rating={Math.round(avgRating)} />
              <span className="product-rating-avg">{avgRating}</span>
              <span className="product-rating-count">({reviews.length} ביקורות)</span>
            </div>
          )}

          <p className="product-page-price">
            ₪{selectedVariant ? selectedVariant.price : product.price}
            {hasVariants && !selectedVariant && <span className="price-from"> (בחר גרסה)</span>}
          </p>

          <div className={`product-page-stock ${inStock ? 'in-stock' : 'out-of-stock'}`}>
            <span className="stock-dot" />
            {inStock ? 'יש במלאי' : 'אזל מהמלאי'}
          </div>

          <ProductVariantSelector
            product={product}
            hasVariants={hasVariants}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            selectedSize={selectedSize}
            onSelectSize={setSelectedSize}>
            {product.description && (
              <div className="product-page-description">
                <h3>תיאור המוצר</h3>
                <p>{product.description}</p>
              </div>
            )}
          </ProductVariantSelector>

          <div className="product-page-actions">
            <button
              className={`product-page-add-btn ${!inStock ? 'disabled' : ''} ${addedToCart ? 'added' : ''}`}
              onClick={handleAddToCart} disabled={!inStock}>
              {!inStock ? 'אזל מהמלאי' : addedToCart ? '✓ נוסף לעגלה!' : '🛒 הוסף לעגלה'}
            </button>
            <button
              className={`product-wishlist-btn ${inWishlist ? 'active' : ''}`}
              onClick={() => { const added = toggleWishlist(product); setInWishlist(added); }}
              title={inWishlist ? 'הסר מרשימת המשאלות' : 'הוסף לרשימת המשאלות'}>
              {inWishlist ? '❤️' : '🤍'}
            </button>
          </div>

          {/* שתף בוואטסאפ */}
          <button className="product-share-btn" onClick={handleShare}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            שתף בוואטסאפ
          </button>
        </div>
      </div>

      <ProductReviewsSection productId={product.id} reviews={reviews} />

      <RelatedProducts
        recentlyViewed={recentlyViewed}
        relatedProducts={relatedProducts}
        onSelectProduct={onSelectProduct}
      />
    </div>
  );
}

export default ProductPage;
