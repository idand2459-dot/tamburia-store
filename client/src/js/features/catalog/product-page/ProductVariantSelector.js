/**
 * בחירת הגרסה, הצבע והמידה של המוצר.
 *
 * הבחירות עצמן שייכות ל-ProductPage ולא לכאן, כי הוא זה שמרכיב את
 * הפריט שנוסף לעגלה ובודק שכולן נבחרו. הרכיב הזה רק מציג ומדווח.
 *
 * children מוצג בין שבב הגרסאות לעיגולי הצבע — שם יושב תיאור המוצר
 * ב-DOM המקורי. הוא מגיע כ-slot מההורה ולא נבלע לתוך הרכיב, כדי
 * שהתיאור יישאר באחריות העמוד וסדר התצוגה לא ישתנה.
 */

const COLOR_MAP = {
  'לבן': '#ffffff', 'שחור': '#1a1a1a', 'אפור': '#888888',
  'כחול': '#2563eb', 'אדום': '#dc2626', 'ירוק': '#16a34a',
  'צהוב': '#eab308', 'כתום': '#ea580c', 'חום': '#92400e',
  'בז': '#d4b896', 'כסף': '#c0c0c0', 'זהב': '#d4af37',
  'ורוד': '#ec4899', 'סגול': '#9333ea', 'תכלת': '#38bdf8',
};

/** מציג את בוררי הגרסה, הצבע והמידה של המוצר. */
function ProductVariantSelector({
  product, hasVariants,
  selectedVariant, onSelectVariant,
  selectedColor, onSelectColor,
  selectedSize, onSelectSize,
  children,
}) {
  return (
    <>
      {hasVariants && (
        <div className="product-page-variants">
          <h3>בחר גרסה / גודל</h3>
          <div className="variant-chips">
            {product.variants.map((v, i) => (
              <button
                key={i}
                className={`variant-chip ${selectedVariant === v ? 'selected' : ''}`}
                onClick={() => onSelectVariant(v)}>
                <span className="variant-chip-label">{v.label}</span>
                <span className="variant-chip-price">₪{v.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {children}

      {product.colors && product.colors.length > 0 && (
        <div className="product-page-colors">
          <h3>בחר צבע {selectedColor && <span className="selected-color-name">— {selectedColor}</span>}</h3>
          <div className="color-circles">
            {product.colors.map(color => (
              <button key={color}
                className={`color-circle ${selectedColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: COLOR_MAP[color] || '#ccc', border: color === 'לבן' ? '2px solid #ddd' : '2px solid transparent' }}
                onClick={() => onSelectColor(color)} title={color} />
            ))}
          </div>
        </div>
      )}

      {product.sizes && product.sizes.length > 0 && (
        <div className="product-page-sizes">
          <h3>בחר מידה {selectedSize && <span className="selected-color-name">— {selectedSize}</span>}</h3>
          <select
            className="size-select"
            value={selectedSize || ''}
            onChange={e => onSelectSize(e.target.value || null)}>
            <option value="">-- בחר מידה --</option>
            {product.sizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

export default ProductVariantSelector;
