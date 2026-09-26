/**
 * לשונית הוספת/עריכת מוצר.
 *
 * שדות הטופס הם state מקומי: הם אינם מעניינים אף לשונית אחרת, ואין
 * להם שליפה משלהם מהשרת מלבד השמירה עצמה. מה שכן מגיע מבחוץ הוא
 * editingProduct — לשונית המוצרים מסמנת אותו בלחיצה על "ערוך", וכאן
 * הוא ממלא את השדות.
 *
 * המילוי נעשה ב-useEffect ולא בערך ההתחלתי של useState, כי הרכיב
 * עולה בעקבות מעבר כתובת ל-/admin/add — ואין ערובה שהסימון של המוצר
 * הנערך הגיע לפני העלייה. ב-useEffect שני הסדרים עובדים.
 */
import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Loader, Save, Plus } from 'lucide-react';
import { CATEGORIES } from './adminConstants';

const EMPTY = {
  name: '', price: '', inStock: true, colors: '', category: '',
  sku: '', description: '', variants: [], existingImages: [],
};

/** גוזר את שדות הטופס ממוצר קיים, או מחזיר טופס ריק. */
function fieldsFromProduct(product) {
  if (!product) return EMPTY;
  const existing = [];
  if (product.image_url) existing.push(product.image_url);
  if (product.images && Array.isArray(product.images)) existing.push(...product.images);
  return {
    name: product.name,
    price: product.price,
    inStock: product.in_stock !== false,
    colors: product.colors ? product.colors.join(', ') : '',
    category: product.category || '',
    sku: product.sku || '',
    description: product.description || '',
    variants: Array.isArray(product.variants) && product.variants.length > 0
      ? product.variants.map(v => ({ label: v.label, price: String(v.price) }))
      : [],
    existingImages: existing,
  };
}

/** מציג את טופס המוצר, להוספה או לעריכה. */
function ProductFormTab({ editingProduct, onCreate, onUpdate, uploadingImages, onDone, productsError }) {
  const [name, setName] = useState(EMPTY.name);
  const [price, setPrice] = useState(EMPTY.price);
  const [inStock, setInStock] = useState(EMPTY.inStock);
  const [colors, setColors] = useState(EMPTY.colors);
  const [category, setCategory] = useState(EMPTY.category);
  const [sku, setSku] = useState(EMPTY.sku);
  const [description, setDescription] = useState(EMPTY.description);
  const [variants, setVariants] = useState(EMPTY.variants);
  const [existingImages, setExistingImages] = useState(EMPTY.existingImages);
  const [images, setImages] = useState([]);

  useEffect(() => {
    const f = fieldsFromProduct(editingProduct);
    setName(f.name); setPrice(f.price); setInStock(f.inStock);
    setColors(f.colors); setCategory(f.category); setSku(f.sku);
    setDescription(f.description); setVariants(f.variants);
    setExistingImages(f.existingImages); setImages([]);
  }, [editingProduct]);

  const totalImagesSelected = existingImages.length + images.length;

  /** אוסף את שדות הטופס לצורת הארגומנט שההוק מצפה לה. */
  function collectFields() {
    return { name, price, inStock, colors, category, sku, description, variants };
  }

  /**
   * שולח את הטופס לשרת — יצירה או עדכון, לפי מצב העריכה.
   * יציאה מהטופס רק בהצלחה: על כישלון השדות נשארים כפי שהם, כדי
   * שאפשר יהיה לתקן ולנסות שוב בלי להקליד הכול מחדש.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    const saved = editingProduct
      ? await onUpdate(editingProduct.id, collectFields(), existingImages, images)
      : await onCreate(collectFields(), images);
    if (saved) onDone();
  }

  /** מסיר תמונה קיימת מהמוצר הנערך. */
  function removeExistingImage(index) { setExistingImages(existingImages.filter((_, i) => i !== index)); }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <h2>{editingProduct ? `עריכת: ${editingProduct.name}` : 'מוצר חדש'}</h2>
      <div className="admin-form-grid">
        <div className="admin-form-group full"><label>שם המוצר *</label><input placeholder="שם המוצר" value={name} onChange={e => setName(e.target.value)} required /></div>
        {variants.length === 0 && (
          <div className="admin-form-group"><label>מחיר (₪) *</label><input placeholder="0" type="number" value={price} onChange={e => setPrice(e.target.value)} required={variants.length === 0} /></div>
        )}
        <div className="admin-form-group">
          <label>מלאי</label>
          <div className="instock-toggle-wrap">
            <button type="button" className={`instock-toggle ${inStock ? 'in' : 'out'}`} onClick={() => setInStock(!inStock)}>
              <span className="instock-toggle-knob" />
            </button>
            <span className={`instock-toggle-label ${inStock ? 'in' : 'out'}`}>{inStock ? <><Check size={16} aria-hidden="true" /> יש במלאי</> : <><X size={16} aria-hidden="true" /> אזל מהמלאי</>}</span>
          </div>
        </div>
        <div className="admin-form-group"><label>מק"ט</label><input placeholder="TT-1042" value={sku} onChange={e => setSku(e.target.value)} /></div>
        <div className="admin-form-group"><label>קטגוריה *</label>
          <select value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="">בחר קטגוריה</option>
            {/* בלי אייקון: <option> יכול להכיל טקסט בלבד, ו-svg בתוכו לא מרונדר. */}
            {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          </select>
        </div>
        <div className="admin-form-group full"><label>צבעים</label><input placeholder="לבן, שחור, אפור" value={colors} onChange={e => setColors(e.target.value)} /></div>
        <div className="admin-form-group full"><label>תיאור</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>

        {/* ── Variants ── */}
        <div className="admin-form-group full">
          <label>גרסאות מוצר עם מחיר שונה <span className="admin-label-hint">(גדלים / נפחים / סוגים)</span></label>
          {variants.length > 0 && (
            <div className="variants-list">
              {variants.map((v, i) => (
                <div key={i} className="variant-row">
                  <input
                    className="variant-label-input"
                    placeholder="תיאור (למשל: 1 ליטר, 5 ליטר, 20 ליטר)"
                    value={v.label}
                    onChange={e => setVariants(variants.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  />
                  <span className="variant-price-symbol">₪</span>
                  <input
                    className="variant-price-input"
                    type="number"
                    placeholder="מחיר"
                    value={v.price}
                    onChange={e => setVariants(variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                  />
                  <button type="button" className="variant-remove-btn" onClick={() => setVariants(variants.filter((_, j) => j !== i))} aria-label="הסר גרסה"><X size={16} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="variant-add-btn"
            onClick={() => setVariants([...variants, { label: '', price: '' }])}>
            + הוסף גרסה
          </button>
          {variants.length > 0 && (
            <p className="variant-hint">המחיר הנמוך ביותר יוצג בכרטיס המוצר. לחץ על ה-X להסרת גרסה.</p>
          )}
        </div>

        <div className="admin-form-group full">
          <label>תמונות (עד 5) {totalImagesSelected > 0 && <span className="images-count-badge">{totalImagesSelected}/5</span>}</label>
          {existingImages.length > 0 && (
            <div className="existing-images">
              {existingImages.map((url, i) => (
                <div key={i} className="existing-image-item">
                  <img src={url} alt={`תמונה ${i+1}`} />
                  {i === 0 && <span className="main-image-badge">ראשית</span>}
                  <button type="button" className="remove-image-btn" onClick={() => removeExistingImage(i)} aria-label="הסר תמונה"><X size={16} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          )}
          {totalImagesSelected < 5 && <input type="file" accept="image/*" multiple onChange={e => setImages(Array.from(e.target.files).slice(0, 5 - totalImagesSelected))} />}
          <p className="admin-images-hint">התמונה הראשונה תוצג כתמונה הראשית</p>
        </div>
      </div>
      {productsError && <div className="admin-error"><AlertTriangle size={18} aria-hidden="true" /> {productsError}</div>}
      <div className="admin-form-buttons">
        <button type="submit" className="admin-submit-btn" disabled={uploadingImages}>{uploadingImages ? <><Loader size={18} aria-hidden="true" /> מעלה...</> : editingProduct ? <><Save size={18} aria-hidden="true" /> שמור</> : <><Plus size={18} aria-hidden="true" /> הוסף</>}</button>
        {editingProduct && <button type="button" className="admin-cancel-btn" onClick={onDone}>ביטול</button>}
      </div>
    </form>
  );
}

export default ProductFormTab;
