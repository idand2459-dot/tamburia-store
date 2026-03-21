import { useState, useEffect } from 'react';

const MAX_RECENT = 6;

function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('tamburia-recent')) || []; }
  catch { return []; }
}

function addToRecentlyViewed(product) {
  const recent = getRecentlyViewed().filter(p => p.id !== product.id);
  const updated = [{ id: product.id, name: product.name, price: product.price, image_url: product.image_url, in_stock: product.in_stock }, ...recent].slice(0, MAX_RECENT);
  localStorage.setItem('tamburia-recent', JSON.stringify(updated));
}

function ProductPage({ product, onBack, onAddToCart, onSelectProduct }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ reviewer_name: '', rating: 5, text: '' });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  const allImages = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => { if (img && !allImages.includes(img)) allImages.push(img); });
  }

  const inStock = product.in_stock !== false;
  const hasMultipleImages = allImages.length > 1;

  useEffect(() => {
    setSelectedColor(null); setCurrentImageIndex(0); setAddedToCart(false);
    setReviewSubmitted(false); setShowReviewForm(false);

    // שמור בהיסטוריה וטען
    addToRecentlyViewed(product);
    setRecentlyViewed(getRecentlyViewed().filter(p => p.id !== product.id));

    fetch('/api/products').then(r => r.json()).then(data => {
      setRelatedProducts(data.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3));
    });

    fetch(`/api/reviews?type=product&product_id=${product.id}`)
      .then(r => r.json()).then(setReviews).catch(() => {});
  }, [product.id]);

  function prevImage() { setCurrentImageIndex(i => i === 0 ? allImages.length - 1 : i - 1); }
  function nextImage() { setCurrentImageIndex(i => i === allImages.length - 1 ? 0 : i + 1); }

  function handleAddToCart() {
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert('אנא בחר צבע לפני ההוספה לעגלה'); return;
    }
    onAddToCart({ ...product, selectedColor });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  function handleShare() {
    const url = window.location.href;
    const text = `היי! ראיתי את המוצר הזה בטכניק טמבור ונראה לי מעניין 🔧\n*${product.name}* — ₪${product.price}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewForm.reviewer_name || !reviewForm.text) return;
    await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reviewForm, type: 'product', product_id: product.id })
    });
    setReviewSubmitted(true);
    setShowReviewForm(false);
    setReviewForm({ reviewer_name: '', rating: 5, text: '' });
  }

  function renderStars(rating, interactive = false, onRate = null) {
    return (
      <div className="stars">
        {[1,2,3,4,5].map(s => (
          <span key={s} className={`star ${s <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
            onClick={() => interactive && onRate && onRate(s)}>★</span>
        ))}
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const colorMap = {
    'לבן': '#ffffff', 'שחור': '#1a1a1a', 'אפור': '#888888',
    'כחול': '#2563eb', 'אדום': '#dc2626', 'ירוק': '#16a34a',
    'צהוב': '#eab308', 'כתום': '#ea580c', 'חום': '#92400e',
    'בז': '#d4b896', 'כסף': '#c0c0c0', 'זהב': '#d4af37',
    'ורוד': '#ec4899', 'סגול': '#9333ea', 'תכלת': '#38bdf8',
  };

  const CATEGORY_LABELS = {
    painting: 'מוצרי צביעה', kitchen: 'מוצרי מטבח', bathroom: 'מוצרי אמבטיה',
    tools: 'כלי עבודה', cleaning: 'ניקיון', garden: 'גינה',
    plumbing: 'אינסטלציה', adhesives: 'דבקים', locks: 'צילינדרים ומנעולים',
    faucets: 'ברזים', electrical: 'מוצרי חשמל', home: 'בית'
  };

  return (
    <div className="product-page">
      <button className="back-btn product-page-back" onClick={onBack}>← חזרה למוצרים</button>

      <div className="product-page-content">
        {/* Gallery */}
        <div className="product-page-gallery">
          <div className="product-page-image-wrap">
            {allImages.length > 0
              ? <img src={allImages[currentImageIndex]} alt={product.name} className="product-page-image" />
              : <div className="product-page-no-image">אין תמונה</div>
            }
            {hasMultipleImages && (
              <>
                <button className="gallery-arrow gallery-arrow-right" onClick={prevImage}>‹</button>
                <button className="gallery-arrow gallery-arrow-left" onClick={nextImage}>›</button>
                <div className="gallery-dots">
                  {allImages.map((_, i) => (
                    <button key={i} className={`gallery-dot ${i === currentImageIndex ? 'active' : ''}`} onClick={() => setCurrentImageIndex(i)} />
                  ))}
                </div>
              </>
            )}
          </div>
          {hasMultipleImages && (
            <div className="gallery-thumbnails">
              {allImages.map((img, i) => (
                <button key={i} className={`gallery-thumb ${i === currentImageIndex ? 'active' : ''}`} onClick={() => setCurrentImageIndex(i)}>
                  <img src={img} alt={`תמונה ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

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
              {renderStars(Math.round(avgRating))}
              <span className="product-rating-avg">{avgRating}</span>
              <span className="product-rating-count">({reviews.length} ביקורות)</span>
            </div>
          )}

          <p className="product-page-price">₪{product.price}</p>

          <div className={`product-page-stock ${inStock ? 'in-stock' : 'out-of-stock'}`}>
            <span className="stock-dot" />
            {inStock ? 'יש במלאי' : 'אזל מהמלאי'}
          </div>

          {product.description && (
            <div className="product-page-description">
              <h3>תיאור המוצר</h3>
              <p>{product.description}</p>
            </div>
          )}

          {product.colors && product.colors.length > 0 && (
            <div className="product-page-colors">
              <h3>בחר צבע {selectedColor && <span className="selected-color-name">— {selectedColor}</span>}</h3>
              <div className="color-circles">
                {product.colors.map(color => (
                  <button key={color}
                    className={`color-circle ${selectedColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: colorMap[color] || '#ccc', border: color === 'לבן' ? '2px solid #ddd' : '2px solid transparent' }}
                    onClick={() => setSelectedColor(color)} title={color} />
                ))}
              </div>
            </div>
          )}

          <button
            className={`product-page-add-btn ${!inStock ? 'disabled' : ''} ${addedToCart ? 'added' : ''}`}
            onClick={handleAddToCart} disabled={!inStock}>
            {!inStock ? 'אזל מהמלאי' : addedToCart ? '✓ נוסף לעגלה!' : '🛒 הוסף לעגלה'}
          </button>

          {/* שתף בוואטסאפ */}
          <button className="product-share-btn" onClick={handleShare}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            שתף בוואטסאפ
          </button>
        </div>
      </div>

      {/* ביקורות */}
      <div className="product-reviews">
        <div className="product-reviews-header">
          <h2>ביקורות על המוצר</h2>
          <button className="add-review-btn" onClick={() => setShowReviewForm(!showReviewForm)}>
            {showReviewForm ? '✕ סגור' : '✍️ כתוב ביקורת'}
          </button>
        </div>

        {showReviewForm && (
          <div className="review-form-wrap">
            {reviewSubmitted ? (
              <div className="review-submitted"><span>🎉</span><p>תודה! הביקורת תפורסם לאחר אישור.</p></div>
            ) : (
              <form className="review-form" onSubmit={handleReviewSubmit}>
                <div className="review-form-fields">
                  <div className="review-field">
                    <label>שמך *</label>
                    <input placeholder="ישראל ישראלי" value={reviewForm.reviewer_name}
                      onChange={e => setReviewForm({...reviewForm, reviewer_name: e.target.value})} required />
                  </div>
                  <div className="review-field">
                    <label>דירוג *</label>
                    {renderStars(reviewForm.rating, true, r => setReviewForm({...reviewForm, rating: r}))}
                  </div>
                  <div className="review-field full">
                    <label>הביקורת שלך *</label>
                    <textarea placeholder="מה דעתך על המוצר?" rows={3} value={reviewForm.text}
                      onChange={e => setReviewForm({...reviewForm, text: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" className="review-submit-btn">✅ שלח ביקורת</button>
              </form>
            )}
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="no-product-reviews">אין ביקורות עדיין — היה הראשון!</p>
        ) : (
          <div className="product-reviews-list">
            {reviews.map(r => (
              <div key={r.id} className="product-review-item">
                <div className="product-review-top">
                  <div className="reviewer-avatar">{r.reviewer_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="reviewer-name">{r.reviewer_name}</div>
                    <div className="review-date">{new Date(r.created_at).toLocaleDateString('he-IL')}</div>
                  </div>
                  {renderStars(r.rating)}
                </div>
                <p className="product-review-text">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* צפית לאחרונה */}
      {recentlyViewed.length > 0 && (
        <div className="recently-viewed">
          <h2 className="related-title">צפית לאחרונה 👁️</h2>
          <div className="related-grid">
            {recentlyViewed.slice(0, 3).map(p => (
              <div key={p.id} className="related-card" onClick={() => onSelectProduct(p)}>
                {p.image_url ? <img src={p.image_url} alt={p.name} className="related-img" /> : <div className="related-no-img">🖼️</div>}
                <div className="related-info">
                  <span className="related-name">{p.name}</span>
                  <span className="related-price">₪{p.price}</span>
                  <span className={`related-stock ${p.in_stock !== false ? 'in' : 'out'}`}>{p.in_stock !== false ? 'יש במלאי' : 'אזל'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* מוצרים קשורים */}
      {relatedProducts.length > 0 && (
        <div className="related-products">
          <h2 className="related-title">מוצרים נוספים מאותה קטגוריה</h2>
          <div className="related-grid">
            {relatedProducts.map(p => (
              <div key={p.id} className="related-card" onClick={() => onSelectProduct(p)}>
                {p.image_url ? <img src={p.image_url} alt={p.name} className="related-img" /> : <div className="related-no-img">🖼️</div>}
                <div className="related-info">
                  <span className="related-name">{p.name}</span>
                  <span className="related-price">₪{p.price}</span>
                  <span className={`related-stock ${p.in_stock !== false ? 'in' : 'out'}`}>{p.in_stock !== false ? 'יש במלאי' : 'אזל'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductPage;