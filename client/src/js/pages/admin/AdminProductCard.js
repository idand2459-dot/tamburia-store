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
 *
 * האישור של "מחק" הוא פאנל בתוך הכרטיס ולא window.confirm: confirm
 * שהדפדפן חוסם מחזיר false בשקט, והלחיצה לא עשתה כלום. מה שהשרת עונה
 * מוצג באותו פאנל — ליד הכפתור שנלחץ, ולא בפס שגיאה בראש רשימה שכבר
 * גללו ממנה. מוצר שיש לו הזמנות אינו נמחק (השרת עונה 409), והפאנל
 * מציע במקום זאת להסתיר אותו.
 */
import { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil, Eye, EyeOff } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { hasPrice, parsePriceInput, toAgorot, formatAmount, formatPrice } from '../../utils/pricing';
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
  const [draftInvalid, setDraftInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  /* null, או מצב הפאנל של המחיקה: { step: 'confirm' | 'deleting' |
     'has_orders' | 'error', message?, busy? }. busy — ההסתרה שהפאנל
     הציע במקום המחיקה בדרך לשרת. */
  const [deletion, setDeletion] = useState(null);

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
    setDraft(formatAmount(product.price ?? 0));
    setDraftInvalid(false);
    setEditingPrice(true);
  }

  /** שומר את המחיר. על כישלון התיבה נשארת פתוחה עם מה שהוקלד. */
  async function savePrice() {
    // "12,90" מתקבל כמו "12.90". ערך שאינו מחיר אינו נשלח — התיבה
    // מסומנת, במקום שהלחיצה תיבלע בלי סימן.
    const value = parsePriceInput(draft);
    if (value === null) { setDraftInvalid(true); return; }

    // מחיר שלא השתנה — סגירה בלי בקשה לשרת. באגורות: 12.9 ו-12.90 זהים.
    if (toAgorot(value) === toAgorot(product.price)) { setEditingPrice(false); return; }

    setSaving(true);
    const ok = await onUpdatePrice(product, value);
    setSaving(false);

    if (!ok) return;

    setEditingPrice(false);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_MS);
  }

  /**
   * שולח את המחיקה אחרי האישור. בהצלחה הכרטיס נעלם עם טעינת הרשימה
   * מחדש; בכל תשובה אחרת הפאנל נשאר פתוח ואומר מה קרה.
   */
  async function confirmDelete() {
    setDeletion({ step: 'deleting' });
    const result = await onDelete(product);
    if (result.status === 'deleted') return;
    setDeletion({ step: result.status, message: result.message });
  }

  /** "הסתר" מתוך ההודעה על מוצר עם הזמנות. */
  async function hideInstead() {
    setDeletion({ ...deletion, busy: true });
    const ok = await onToggleActive(product);
    setDeletion(ok ? null : { step: 'error', message: 'הסתרת המוצר נכשלה. אפשר לנסות שוב.' });
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
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draft}
              autoFocus
              onFocus={e => e.target.select()}
              onChange={e => { setDraft(e.target.value); setDraftInvalid(false); }}
              onKeyDown={handleKeyDown}
              aria-invalid={draftInvalid}
              title={draftInvalid ? 'מחיר עם עד שתי ספרות אחרי הנקודה, למשל 12.90' : undefined}
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
            {hasVariants ? `מ-${formatPrice(product.price)}` : formatPrice(product.price)}
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
        <button
          type="button"
          className="admin-delete-btn"
          onClick={() => setDeletion({ step: 'confirm' })}
          disabled={deletion !== null}
          aria-expanded={deletion !== null}>
          מחק
        </button>
      </div>

      {deletion && (
        <div
          className={`admin-product-notice ${deletion.step === 'confirm' || deletion.step === 'deleting' ? '' : 'is-problem'}`}
          role={deletion.step === 'confirm' || deletion.step === 'deleting' ? 'group' : 'alert'}
          aria-label={deletion.step === 'confirm' ? 'אישור מחיקה' : undefined}>
          {(deletion.step === 'confirm' || deletion.step === 'deleting') && (
            <>
              <p className="admin-product-notice-text">למחוק את "{product.name}" לצמיתות?</p>
              <div className="admin-product-notice-actions">
                <button
                  type="button"
                  className="admin-notice-danger"
                  onClick={confirmDelete}
                  disabled={deletion.step === 'deleting'}
                  autoFocus>
                  {deletion.step === 'deleting' ? 'מוחק…' : 'מחק לצמיתות'}
                </button>
                <button
                  type="button"
                  className="admin-notice-cancel"
                  onClick={() => setDeletion(null)}
                  disabled={deletion.step === 'deleting'}>
                  ביטול
                </button>
              </div>
            </>
          )}

          {deletion.step === 'has_orders' && (
            <>
              <p className="admin-product-notice-text">{deletion.message}</p>
              <div className="admin-product-notice-actions">
                {visible ? (
                  <button type="button" className="admin-notice-primary" onClick={hideInstead} disabled={deletion.busy}>
                    <EyeOff size={15} aria-hidden="true" /> {deletion.busy ? 'מסתיר…' : 'הסתר'}
                  </button>
                ) : (
                  <span className="admin-product-notice-note">המוצר כבר מוסתר מהחנות.</span>
                )}
                <button type="button" className="admin-notice-cancel" onClick={() => setDeletion(null)}>סגור</button>
              </div>
            </>
          )}

          {deletion.step === 'error' && (
            <>
              <p className="admin-product-notice-text">{deletion.message}</p>
              <div className="admin-product-notice-actions">
                <button type="button" className="admin-notice-cancel" onClick={() => setDeletion(null)}>סגור</button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default AdminProductCard;
