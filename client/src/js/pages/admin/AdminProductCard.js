/**
 * מוצר אחד בלשונית המוצרים, עם עריכת המחיר במקום.
 *
 * אותו רכיב במסך רחב ובטלפון — הכרטיס ברשת והשורה ברשימה הם אותו
 * markup בשני פריסות, ולא שני עצים שצריך לתחזק במקביל
 * (features/admin/_admin-products.css).
 *
 * שינוי מחיר של מוצר בודד הוא הדבר שנעשה כאן הכי הרבה, ולכן הוא
 * במקום ולא דרך הטופס: נגיעה במחיר הופכת אותו לשדה, Enter שומר,
 * Escape מבטל. השמירה שולחת את המחיר לבדו, וכל השאר — וריאנטים,
 * תמונות, צבעים — נשאר כפי שהוא.
 *
 * מוצר עם וריאנטים הוא היוצא מן הכלל: המחיר שלו הוא הזול שבגרסאות,
 * ואין מה לערוך בו לבדו. נגיעה במחיר שלו פותחת את הטופס המלא.
 *
 * ה-state של העריכה יושב כאן ולא בלשונית: כל שורה עורכת בנפרד,
 * והמפתח לפי id שומר על התיבה פתוחה כשהרשימה נטענת מחדש.
 *
 * מוצר שהמחיר שלו 0 מסומן בתגית "ללא מחיר". זה לא קישוט: באתר אי
 * אפשר להזמין מוצר כזה (utils/pricing.js), ולכן התגית היא מה שאומר
 * שהמוצר הזה למעשה לא למכירה עד שיוקלד לו מחיר. השבב בראש הלשונית
 * מסנן בדיוק לפי אותו כלל.
 *
 * "הסתר" הוא מה שעושים במקום למחוק. הזמנות ישנות, ביקורות ומחשבון
 * הצבע מפנים למוצר לפי id, ומחיקה הייתה מנתקת אותם; הסתרה מוציאה
 * אותו מהחנות ומשאירה הכול מחובר. לכן היא בלי אישור — היא הפיכה
 * בלחיצה — ו"מחק" נשאר לידה עם האישור שלו, למוצר שנוצר בטעות.
 */
import { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil, Eye, EyeOff } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { hasPrice } from '../../utils/pricing';
import { CATEGORIES } from './adminConstants';

/* כמה זמן נשאר סימון ה"נשמר" על השורה. מספיק כדי להיראות, קצר מכדי
   להיראות כמו מצב תקוע — אותו פרק זמן של הווי בכרטיס המוצר בחנות. */
const SAVED_MS = 1400;

/** מציג מוצר אחד בלשונית המוצרים. */
function AdminProductCard({
  product, onEdit, onDelete, onToggleStock, onToggleActive, onUpdatePrice,
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const Icon = CATEGORY_ICONS[product.category];
  const inStock = product.in_stock !== false;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const priced = hasPrice(product);
  const visible = product.active !== false;
  const categoryLabel = CATEGORIES.find(c => c.id === product.category)?.label;

  /** פותח את עריכת המחיר, או את הטופס כשיש וריאנטים. */
  function startPriceEdit() {
    if (hasVariants) { onEdit(product); return; }
    setDraft(String(product.price ?? ''));
    setEditingPrice(true);
  }

  /** שומר את המחיר. על כישלון התיבה נשארת פתוחה עם מה שהוקלד. */
  async function savePrice() {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) return;

    // מחיר שלא השתנה — סגירה בלי בקשה לשרת
    if (Math.round(value) === product.price) { setEditingPrice(false); return; }

    setSaving(true);
    const ok = await onUpdatePrice(product, value);
    setSaving(false);

    if (!ok) return;

    setEditingPrice(false);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_MS);
  }

  /** Enter שומר, Escape מבטל — מה שהאצבע עושה בלי לחשוב. */
  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); savePrice(); }
    if (e.key === 'Escape') { e.preventDefault(); setEditingPrice(false); }
  }

  return (
    <article data-product-id={product.id} className={[
      'admin-product',
      saved ? 'is-saved' : '',
      priced ? '' : 'is-unpriced',
      visible ? '' : 'is-hidden',
    ].filter(Boolean).join(' ')}>
      <div className="admin-product-well">
        {product.image_url
          ? <img src={product.image_url} alt="" loading="lazy" />
          : <span className="admin-product-fallback" aria-hidden="true">
              {Icon && <Icon size={28} strokeWidth={1.5} />}
            </span>}
      </div>

      <div className="admin-product-body">
        <h3 className="admin-product-name">{product.name}</h3>

        <p className="admin-product-meta">
          {categoryLabel}
          {product.sku && <span className="admin-product-sku">מק"ט {product.sku}</span>}
        </p>

        {/* שתי התגיות יכולות להופיע יחד: מוצר יכול להיות גם מוסתר
            וגם בלי מחיר, ולמי שמחזיר אותו לחנות חשוב לדעת את שתיהן */}
        {!visible && (
          <span className="admin-product-flag admin-product-flag--hidden">
            <EyeOff size={13} aria-hidden="true" /> מוסתר מהחנות
          </span>
        )}
        {!priced && <span className="admin-product-flag">ללא מחיר</span>}

        {editingPrice ? (
          <div className="admin-price-edit">
            <span className="admin-price-currency">₪</span>
            <input
              className="admin-price-input"
              type="number"
              inputMode="decimal"
              min="0"
              value={draft}
              autoFocus
              onFocus={e => e.target.select()}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={`מחיר עבור ${product.name}`}
            />
            <button
              type="button"
              className="admin-price-save"
              onClick={savePrice}
              disabled={saving}
              aria-label="שמור מחיר">
              <Check size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="admin-price-cancel"
              onClick={() => setEditingPrice(false)}
              aria-label="בטל">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" className="admin-price-btn" onClick={startPriceEdit}>
            {hasVariants ? `מ-₪${product.price}` : `₪${product.price}`}
            <Pencil size={15} aria-hidden="true" />
            {hasVariants && <span className="admin-price-variants">{product.variants.length} גרסאות</span>}
          </button>
        )}

        {saved && <span className="admin-product-saved" role="status">נשמר</span>}
      </div>

      <div className="admin-product-stock">
        <button
          type="button"
          className="admin-stock-switch"
          role="switch"
          aria-checked={inStock}
          onClick={() => onToggleStock(product)}>
          <span className="admin-stock-knob" />
        </button>
        <span className="admin-stock-label">{inStock ? 'במלאי' : 'אזל'}</span>
      </div>

      <div className="admin-product-actions">
        <button type="button" className="admin-edit-btn" onClick={() => onEdit(product)}>ערוך</button>
        <button
          type="button"
          className="admin-hide-btn"
          onClick={() => onToggleActive(product)}
          aria-label={visible ? `הסתר מהחנות: ${product.name}` : `הצג בחנות: ${product.name}`}>
          {visible
            ? <><EyeOff size={15} aria-hidden="true" /> הסתר</>
            : <><Eye size={15} aria-hidden="true" /> הצג</>}
        </button>
        <button type="button" className="admin-delete-btn" onClick={() => onDelete(product.id)}>מחק</button>
      </div>
    </article>
  );
}

export default AdminProductCard;
