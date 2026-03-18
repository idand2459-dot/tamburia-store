import { useState, useEffect } from 'react';

function ProductPage({ product, onBack, onAddToCart, onSelectProduct }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [addedToCart, setAddedToCart] = useState(false);

  const allImages = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => { if (img && !allImages.includes(img)) allImages.push(img); });
  }

  const inStock = product.in_stock !== false;
  const hasMultipleImages = allImages.length > 1;

  // טעינת מוצרים קשורים
  useEffect(() => {
    setSelectedColor(null);
    setCurrentImageIndex(0);
    setAddedToCart(false);
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        const related = data
          .filter(p => p.category === product.category && p.id !== product.id)
          .slice(0, 3);
        setRelatedProducts(related);
      });
  }, [product.id]);

  function prevImage() { setCurrentImageIndex(i => i === 0 ? allImages.length - 1 : i - 1); }
  function nextImage() { setCurrentImageIndex(i => i === allImages.length - 1 ? 0 : i + 1); }

  function handleAddToCart() {
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert('אנא בחר צבע לפני ההוספה לעגלה');
      return;
    }
    onAddToCart({ ...product, selectedColor });
    // אנימציה ✓
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

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
          {/* Breadcrumb */}
          <div className="breadcrumb">
            <button onClick={onBack}>ראשי</button>
            <span>←</span>
            <button onClick={onBack}>{CATEGORY_LABELS[product.category] || product.category}</button>
            <span>←</span>
            <span className="breadcrumb-current">{product.name}</span>
          </div>

          <h1 className="product-page-name">{product.name}</h1>
          {product.sku && <p className="product-page-sku">מק"ט: <span>{product.sku}</span></p>}
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
            onClick={handleAddToCart}
            disabled={!inStock}
          >
            {!inStock ? 'אזל מהמלאי' : addedToCart ? '✓ נוסף לעגלה!' : '🛒 הוסף לעגלה'}
          </button>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="related-products">
          <h2 className="related-title">מוצרים נוספים מאותה קטגוריה</h2>
          <div className="related-grid">
            {relatedProducts.map(p => (
              <div key={p.id} className="related-card" onClick={() => onSelectProduct(p)}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="related-img" />
                  : <div className="related-no-img">🖼️</div>
                }
                <div className="related-info">
                  <span className="related-name">{p.name}</span>
                  <span className="related-price">₪{p.price}</span>
                  <span className={`related-stock ${p.in_stock !== false ? 'in' : 'out'}`}>
                    {p.in_stock !== false ? 'יש במלאי' : 'אזל'}
                  </span>
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