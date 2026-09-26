/**
 * גלריית המוצר: התמונה הראשית, החצים, הנקודות והתמונות הקטנות.
 *
 * מחזיק את התמונה המוצגת ואת רשימת התמונות השבורות, כי שתיהן לא
 * מעניינות שום חלק אחר בעמוד. איפוס התמונה המוצגת במעבר מוצר נעשה
 * כאן ולא בהורה, מאותה סיבה — זה ה-state של הרכיב הזה.
 */
import { useState, useEffect } from 'react';

/** גוזר את רשימת התמונות של המוצר, בלי כפילויות. */
function imagesOf(product) {
  const all = [];
  if (product.image_url) all.push(product.image_url);
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => { if (img && !all.includes(img)) all.push(img); });
  }
  return all;
}

/** מציג את גלריית התמונות של המוצר. */
function ProductGallery({ product }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // תמונות שהשרת לא מצא. חלק מהרשומות מפנות לקבצים שלא הועלו, ובלי
  // זה הדפדפן מצייר אייקון של תמונה שבורה במקום הפלייסהולדר.
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const markBroken = (src) => setBrokenImages((prev) => new Set(prev).add(src));

  useEffect(() => { setCurrentImageIndex(0); }, [product.id]);

  const allImages = imagesOf(product);
  const hasMultipleImages = allImages.length > 1;

  /** עובר לתמונה הקודמת בגלריה. */
  function prevImage() { setCurrentImageIndex(i => i === 0 ? allImages.length - 1 : i - 1); }
  /** עובר לתמונה הבאה בגלריה. */
  function nextImage() { setCurrentImageIndex(i => i === allImages.length - 1 ? 0 : i + 1); }

  return (
    <div className="product-page-gallery">
      <div className="product-page-image-wrap">
        {allImages.length > 0 && !brokenImages.has(allImages[currentImageIndex])
          ? <img
              src={allImages[currentImageIndex]}
              alt={product.name}
              className="product-page-image"
              onError={() => markBroken(allImages[currentImageIndex])}
            />
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
              <img src={img} alt={`תמונה ${i + 1}`} onError={() => markBroken(img)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
