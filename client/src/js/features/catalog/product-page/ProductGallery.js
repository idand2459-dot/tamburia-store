/**
 * גלריית המוצר: התמונה הראשית, החצים והתמונות הקטנות.
 *
 * מחזיק את התמונה המוצגת ואת רשימת התמונות השבורות, כי שתיהן לא
 * מעניינות שום חלק אחר בעמוד. איפוס התמונה המוצגת במעבר מוצר נעשה
 * כאן ולא בהורה, מאותה סיבה — זה ה-state של הרכיב הזה.
 *
 * למוצר בלי תמונה מוצג אייקון הקטגוריה מ-CATEGORY_ICONS, כמו בכרטיס
 * המוצר ברשת, ולא בלוק אפור עם המילים "אין תמונה".
 *
 * החלקה בטלפון היא תוספת קטנה על אותו state: הפרש ה-X בין תחילת
 * הנגיעה לסופה, בלי גרירה ובלי אנימציה. בעברית הרצועה רצה מימין
 * לשמאל, ולכן התמונה הבאה שוכנת *שמאלה* מהנוכחית — מי שמושך את
 * הרצועה ימינה (dx חיובי) מביא אותה, וזה גם הכפתור שבצד שמאל.
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Info } from 'lucide-react';
import CATEGORY_ICONS from '../../../utils/categoryIcons';

/* מתחת לזה זו נגיעה ולא החלקה. */
const SWIPE_MIN_PX = 40;

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

  const touchStartX = useRef(null);

  useEffect(() => { setCurrentImageIndex(0); }, [product.id]);

  const allImages = imagesOf(product);
  const hasMultipleImages = allImages.length > 1;
  const currentImage = allImages[currentImageIndex];
  const showImage = Boolean(currentImage) && !brokenImages.has(currentImage);
  const Icon = CATEGORY_ICONS[product.category];

  /** עובר לתמונה הקודמת בגלריה. */
  function prevImage() { setCurrentImageIndex(i => i === 0 ? allImages.length - 1 : i - 1); }
  /** עובר לתמונה הבאה בגלריה. */
  function nextImage() { setCurrentImageIndex(i => i === allImages.length - 1 ? 0 : i + 1); }

  /** שומר את נקודת ההתחלה של הנגיעה. */
  function handleTouchStart(e) {
    touchStartX.current = e.changedTouches[0].clientX;
  }

  /** מחליף תמונה אם הנגיעה הייתה החלקה לרוחב. */
  function handleTouchEnd(e) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || !hasMultipleImages) return;

    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (dx > 0) nextImage(); else prevImage();
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery-frame">
        <div
          className="product-gallery-window"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {showImage
            ? <img
                src={currentImage}
                alt={product.name}
                className="product-gallery-image"
                onError={() => markBroken(currentImage)}
              />
            : <div className="product-gallery-empty">
                {Icon && <Icon size={72} strokeWidth={1.25} aria-hidden="true" />}
                <span>אין עדיין תמונה למוצר הזה</span>
              </div>
          }
        </div>

        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="product-gallery-arrow product-gallery-arrow--prev"
              onClick={prevImage}
              aria-label="התמונה הקודמת">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="product-gallery-arrow product-gallery-arrow--next"
              onClick={nextImage}
              aria-label="התמונה הבאה">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* מוצרים שמגיעים מספק אחר בכל פעם — ראש מקלחת, למשל — מצולמים
          בפריט מייצג. הערה כאן, מתחת לתמונות עצמן, במקום שבו מסתכלים
          עליהן, ולא בתוך התיאור שרבים אינם קוראים. */}
      {product.image_illustrative && (
        <p className="product-gallery-note">
          <Info size={16} aria-hidden="true" />
          התמונה להמחשה. המותג והעיצוב עשויים להשתנות לפי המלאי — המידות והתכונות כמתואר.
        </p>
      )}

      {hasMultipleImages && (
        <div className="product-gallery-thumbs">
          {allImages.map((img, i) => (
            <button
              key={i}
              type="button"
              className={`product-gallery-thumb ${i === currentImageIndex ? 'is-active' : ''}`}
              aria-label={`תמונה ${i + 1}`}
              aria-pressed={i === currentImageIndex}
              onClick={() => setCurrentImageIndex(i)}>
              <img src={img} alt="" onError={() => markBroken(img)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
