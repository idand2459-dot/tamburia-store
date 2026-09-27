/**
 * בחירת הגרסה, הצבע והמידה של המוצר.
 *
 * הבחירות עצמן שייכות ל-ProductPage ולא לכאן, כי הוא זה שמרכיב את
 * הפריט שנוסף לעגלה ובודק שכולן נבחרו. הרכיב הזה רק מציג ומדווח.
 *
 * missing הוא שם הבורר שחסרה בו בחירה — 'variant' | 'color' | 'size'
 * — ומתחתיו מוצגת שורה אדומה במקום שלושת ה-alert של הדפדפן שהיו כאן.
 * ה-ref-ים שמגיעים בפרופס הם מה שמאפשר ל-ProductPage להעביר את המיקוד
 * לבורר החסר: הם יושבים על הפקד הראשון בכל קבוצה.
 *
 * children מוצג בין שבב הגרסאות לעיגולי הצבע — שם יושב תיאור המוצר
 * ב-DOM. הוא מגיע כ-slot מההורה ולא נבלע לתוך הרכיב, כדי שהתיאור
 * יישאר באחריות העמוד וסדר התצוגה לא ישתנה.
 */
import { AlertCircle } from 'lucide-react';

const COLOR_MAP = {
  'לבן': '#ffffff', 'שחור': '#1a1a1a', 'אפור': '#888888',
  'כחול': '#2563eb', 'אדום': '#dc2626', 'ירוק': '#16a34a',
  'צהוב': '#eab308', 'כתום': '#ea580c', 'חום': '#92400e',
  'בז': '#d4b896', 'כסף': '#c0c0c0', 'זהב': '#d4af37',
  'ורוד': '#ec4899', 'סגול': '#9333ea', 'תכלת': '#38bdf8',
};

/** שורת השגיאה מתחת לבורר שחסרה בו בחירה. */
function PickerError({ children }) {
  return (
    <p className="product-picker-error" role="alert">
      <AlertCircle size={15} aria-hidden="true" /> {children}
    </p>
  );
}

/** מציג את בוררי הגרסה, הצבע והמידה של המוצר. */
function ProductVariantSelector({
  product, hasVariants,
  selectedVariant, onSelectVariant,
  selectedColor, onSelectColor,
  selectedSize, onSelectSize,
  missing, variantRef, colorRef, sizeRef,
  children,
}) {
  return (
    <>
      {hasVariants && (
        <div className="product-picker">
          <h2 className="product-picker-title">בחר גרסה / גודל</h2>
          <div className="product-picker-chips">
            {product.variants.map((v, i) => (
              <button
                key={i}
                type="button"
                ref={i === 0 ? variantRef : null}
                className="product-picker-chip"
                aria-pressed={selectedVariant === v}
                onClick={() => onSelectVariant(v)}>
                <span className="product-picker-chip-label">{v.label}</span>
                <span className="product-picker-chip-price">₪{v.price}</span>
              </button>
            ))}
          </div>
          {missing === 'variant' && <PickerError>בחר גרסה לפני ההוספה לעגלה</PickerError>}
        </div>
      )}

      {children}

      {product.colors && product.colors.length > 0 && (
        <div className="product-picker">
          <h2 className="product-picker-title">
            בחר צבע {selectedColor && <span className="product-picker-choice">— {selectedColor}</span>}
          </h2>
          <div className="product-picker-colors">
            {product.colors.map(color => (
              <button key={color}
                type="button"
                ref={color === product.colors[0] ? colorRef : null}
                className="product-picker-color"
                aria-pressed={selectedColor === color}
                aria-label={color}
                style={{ backgroundColor: COLOR_MAP[color] || '#ccc', border: color === 'לבן' ? '2px solid #ddd' : '2px solid transparent' }}
                onClick={() => onSelectColor(color)} title={color} />
            ))}
          </div>
          {missing === 'color' && <PickerError>בחר צבע לפני ההוספה לעגלה</PickerError>}
        </div>
      )}

      {product.sizes && product.sizes.length > 0 && (
        <div className="product-picker">
          <h2 className="product-picker-title">
            בחר מידה {selectedSize && <span className="product-picker-choice">— {selectedSize}</span>}
          </h2>
          <select
            ref={sizeRef}
            className="product-picker-select"
            aria-label="בחר מידה"
            value={selectedSize || ''}
            onChange={e => onSelectSize(e.target.value || null)}>
            <option value="">-- בחר מידה --</option>
            {product.sizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          {missing === 'size' && <PickerError>בחר מידה לפני ההוספה לעגלה</PickerError>}
        </div>
      )}
    </>
  );
}

export default ProductVariantSelector;
