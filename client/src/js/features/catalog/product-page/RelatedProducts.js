/**
 * שתי רשתות המוצרים שבתחתית עמוד המוצר: "צפית לאחרונה" ו"מוצרים
 * נוספים מאותה קטגוריה".
 *
 * שתיהן מציגות בדיוק את אותו כרטיס, ולכן הוא נמצא כאן פעם אחת
 * כ-RelatedGrid ולא משוכפל בשתי רשימות. מה שמבדיל ביניהן הוא רק
 * הכותרת, ה-className העוטף וכמה פריטים מוצגים.
 *
 * רשימת התמונות השבורות מקומית לרכיב הזה ואינה משותפת עם הגלריה:
 * שתי הרשתות מציגות מוצרים *אחרים* (המוצר הנוכחי מסונן משתיהן),
 * ולכן אין חפיפה בין קבוצות התמונות והתוצאה על המסך זהה.
 */
import { useState } from 'react';
import { ImageOff, Eye } from 'lucide-react';

/** מציג רשת כרטיסי מוצר עם כותרת. */
function RelatedGrid({ title, wrapClass, items, onSelectProduct, brokenImages, markBroken }) {
  return (
    <div className={wrapClass}>
      <h2 className="related-title">{title}</h2>
      <div className="related-grid">
        {items.map(p => (
          <div key={p.id} className="related-card" onClick={() => onSelectProduct(p)}>
            {p.image_url && !brokenImages.has(p.image_url) ? <img src={p.image_url} alt={p.name} className="related-img" onError={() => markBroken(p.image_url)} /> : <div className="related-no-img"><ImageOff size={28} aria-hidden="true" /></div>}
            <div className="related-info">
              <span className="related-name">{p.name}</span>
              <span className="related-price">₪{p.price}</span>
              <span className={`related-stock ${p.in_stock !== false ? 'in' : 'out'}`}>{p.in_stock !== false ? 'יש במלאי' : 'אזל'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** מציג את "צפית לאחרונה" ואת המוצרים מאותה קטגוריה. */
function RelatedProducts({ recentlyViewed, relatedProducts, onSelectProduct }) {
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const markBroken = (src) => setBrokenImages((prev) => new Set(prev).add(src));

  return (
    <>
      {recentlyViewed.length > 0 && (
        <RelatedGrid
          title={<><Eye size={20} aria-hidden="true" /> צפית לאחרונה</>}
          wrapClass="recently-viewed"
          items={recentlyViewed.slice(0, 3)}
          onSelectProduct={onSelectProduct}
          brokenImages={brokenImages}
          markBroken={markBroken}
        />
      )}

      {relatedProducts.length > 0 && (
        <RelatedGrid
          title="מוצרים נוספים מאותה קטגוריה"
          wrapClass="related-products"
          items={relatedProducts}
          onSelectProduct={onSelectProduct}
          brokenImages={brokenImages}
          markBroken={markBroken}
        />
      )}
    </>
  );
}

export default RelatedProducts;
