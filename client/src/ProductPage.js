import { useState, useEffect } from 'react';

function ProductPage({ product, onBack, onAddToCart, onSelectProduct }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ reviewer_name: '', rating: 5, text: '' });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

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
    plumbing: 'אינסטלציה', adhesives: 'דבקים', locks: 'צילינדרים ומנעולים', faucets: 'ברזים'
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

          {/* דירוג מוצר */}
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
        </div>
      </div>

      {/* ביקורות על המוצר */}
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