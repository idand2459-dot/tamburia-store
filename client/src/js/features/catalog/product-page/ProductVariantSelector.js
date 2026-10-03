/**
 * בחירת הגרסה, הצבע והמידה של המוצר.
 *
 * הבחירות עצמן שייכות ל-ProductDetails ולא לכאן, כי הוא זה שמרכיב את
 * הפריט שנוסף לעגלה ובודק שכולן נבחרו. הרכיב הזה רק מציג ומדווח.
 *
 * missing הוא שם הבורר שחסרה בו בחירה — 'variant' | 'color' | 'size'
 * — ומתחתיו מוצגת שורה אדומה במקום שלושת ה-alert של הדפדפן שהיו כאן.
 * ה-ref-ים שמגיעים בפרופס הם מה שמאפשר ל-ProductDetails להעביר את המיקוד
 * לבורר החסר: הם יושבים על הפקד הראשון בכל קבוצה.
 *
 * הגוון של כל עיגול מגיע מהמוצר עצמו (color.hex). קודם הוא נקבע
 * כאן, ממפה של 15 שמות מדויקים, וכל שם אחר — "אגוז", "טיק",
 * "חום כהה" — קיבל את אותו #ccc אפור.
 *
 * צבע בלי גוון מוצג מפוספס ולא אפור אחיד: בעמודת הצבעים
 * של מוצרים אמיתיים יושבים גם "מספר 2", "על הטיח" ו-"1 מטר",
 * שאינם צבעים כלל, ועיגול אפור נראה כמו טענה שזה הגוון.
 *
 * children מוצג בין שבב הגרסאות לעיגולי הצבע — שם יושב תיאור המוצר
 * ב-DOM. הוא מגיע כ-slot מההורה ולא נבלע לתוך הרכיב, כדי שהתיאור
 * יישאר באחריות העמוד וסדר התצוגה לא ישתנה.
 */
import { AlertCircle } from 'lucide-react';
import { asColors } from '../../../utils/colorPalette';
import { formatPrice } from '../../../utils/pricing';

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
  const colors = asColors(product.colors);

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
                <span className="product-picker-chip-price">{formatPrice(v.price)}</span>
              </button>
            ))}
          </div>
          {missing === 'variant' && <PickerError>בחר גרסה לפני ההוספה לעגלה</PickerError>}
        </div>
      )}

      {children}

      {colors.length > 0 && (
        <div className="product-picker">
          <h2 className="product-picker-title">
            בחר צבע {selectedColor && <span className="product-picker-choice">— {selectedColor}</span>}
          </h2>
          {/* המילוי הוא נתון של המוצר ולכן הוא inline. בלי גוון המילוי
              נשאר ל-CSS, שמצייר פסים אלכסוניים. */}
          <div className="product-picker-colors">
            {colors.map((color, i) => (
              <button key={color.name}
                type="button"
                ref={i === 0 ? colorRef : null}
                className={`product-picker-color ${color.hex ? '' : 'is-unknown'}`}
                aria-pressed={selectedColor === color.name}
                aria-label={color.name}
                style={color.hex ? { backgroundColor: color.hex } : undefined}
                onClick={() => onSelectColor(color.name)} title={color.name} />
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
