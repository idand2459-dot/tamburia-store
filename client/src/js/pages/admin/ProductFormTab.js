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
 *
 * לצד הטופס מוצג כרטיס המוצר האמיתי של החנות, מתוך מה שהוקלד עד כה
 * (ProductFormPreview). זה אותו רכיב שהקטגוריה מרנדרת, ולא חיקוי שלו,
 * כדי שמה שנראה כאן יהיה מה שהלקוח יראה.
 *
 * התמונות מגיעות משני כפתורים: צילום במקום, שפותח את המצלמה האחורית
 * בטלפון, ובחירה מהגלריה. שניהם <input type="file"> מוסתר שה-label
 * מפעיל — כפתור אמיתי שפותח בורר קבצים אינו קיים בדפדפן.
 */
import { useState, useEffect } from 'react';
import {
  Check, X, AlertTriangle, Loader, Save, Plus, Camera, ImagePlus, Info,
} from 'lucide-react';
import { CATEGORIES } from './adminConstants';
import { useObjectUrls } from '../../hooks/useObjectUrls';
import ProductFormPreview from './ProductFormPreview';

const MAX_IMAGES = 5;

const EMPTY = {
  name: '', price: '', inStock: true, colors: '', category: '',
  sku: '', description: '', variants: [], existingImages: [],
  imageIllustrative: false,
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
    imageIllustrative: product.image_illustrative === true,
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
  const [imageIllustrative, setImageIllustrative] = useState(EMPTY.imageIllustrative);
  const [images, setImages] = useState([]);

  useEffect(() => {
    const f = fieldsFromProduct(editingProduct);
    setName(f.name); setPrice(f.price); setInStock(f.inStock);
    setColors(f.colors); setCategory(f.category); setSku(f.sku);
    setDescription(f.description); setVariants(f.variants);
    setExistingImages(f.existingImages); setImages([]);
    setImageIllustrative(f.imageIllustrative);
  }, [editingProduct]);

  const totalImagesSelected = existingImages.length + images.length;
  const room = MAX_IMAGES - totalImagesSelected;

  // כתובות התצוגה של הקבצים שנבחרו ועדיין לא הועלו. ההוק משחרר אותן
  // כשהרשימה מתחלפת וכשיוצאים מהטופס.
  const newImageUrls = useObjectUrls(images);

  /** אוסף את שדות הטופס לצורת הארגומנט שההוק מצפה לה. */
  function collectFields() {
    return { name, price, inStock, colors, category, sku, description, variants, imageIllustrative };
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

  /** מוסיף את הקבצים שנבחרו, עד התקרה. */
  function addImages(e) {
    const picked = Array.from(e.target.files || []).slice(0, room);
    if (picked.length > 0) setImages([...images, ...picked]);
    // איפוס, אחרת בחירת אותו קובץ שוב אינה מפעילה onChange
    e.target.value = '';
  }

  /** מסיר תמונה קיימת מהמוצר הנערך. */
  function removeExistingImage(index) { setExistingImages(existingImages.filter((_, i) => i !== index)); }

  /** מסיר קובץ שנבחר ועדיין לא הועלה. */
  function removeNewImage(index) { setImages(images.filter((_, i) => i !== index)); }

  return (
    <div className="admin-form-layout">
      <form onSubmit={handleSubmit} className="admin-form">
        <h2 className="admin-form-title">{editingProduct ? `עריכת: ${editingProduct.name}` : 'מוצר חדש'}</h2>

        <div className="admin-form-grid">
          <div className="admin-form-group full">
            <label htmlFor="pf-name">שם המוצר <span className="admin-required">*</span></label>
            <input id="pf-name" placeholder="שם המוצר" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          {variants.length === 0 && (
            <div className="admin-form-group">
              <label htmlFor="pf-price">מחיר (₪) <span className="admin-required">*</span></label>
              <input id="pf-price" placeholder="0" type="number" inputMode="decimal" min="0" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
          )}

          <div className="admin-form-group">
            <label>מלאי</label>
            <div className="instock-toggle-wrap">
              <button
                type="button"
                className="admin-stock-switch"
                role="switch"
                aria-checked={inStock}
                onClick={() => setInStock(!inStock)}>
                <span className="admin-stock-knob" />
              </button>
              <span className={`instock-toggle-label ${inStock ? 'in' : 'out'}`}>
                {inStock ? <><Check size={18} aria-hidden="true" /> יש במלאי</> : <><X size={18} aria-hidden="true" /> אזל מהמלאי</>}
              </span>
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="pf-sku">מק"ט</label>
            <input id="pf-sku" placeholder="TT-1042" value={sku} onChange={e => setSku(e.target.value)} />
          </div>

          <div className="admin-form-group">
            <label htmlFor="pf-category">קטגוריה <span className="admin-required">*</span></label>
            <select id="pf-category" value={category} onChange={e => setCategory(e.target.value)} required>
              <option value="">בחר קטגוריה</option>
              {/* בלי אייקון: <option> יכול להכיל טקסט בלבד, ו-svg בתוכו לא מרונדר. */}
              {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

          <div className="admin-form-group full">
            <label htmlFor="pf-colors">צבעים</label>
            <input id="pf-colors" placeholder="לבן, שחור, אפור" value={colors} onChange={e => setColors(e.target.value)} />
          </div>

          <div className="admin-form-group full">
            <label htmlFor="pf-description">תיאור</label>
            <textarea id="pf-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

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
                      inputMode="decimal"
                      placeholder="מחיר"
                      value={v.price}
                      onChange={e => setVariants(variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                    />
                    <button type="button" className="variant-remove-btn" onClick={() => setVariants(variants.filter((_, j) => j !== i))} aria-label="הסר גרסה">
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="variant-add-btn" onClick={() => setVariants([...variants, { label: '', price: '' }])}>
              <Plus size={18} aria-hidden="true" /> הוסף גרסה
            </button>
            {variants.length > 0 && (
              <p className="variant-hint">המחיר הנמוך ביותר יוצג בכרטיס המוצר. לחץ על ה-X להסרת גרסה.</p>
            )}
          </div>

          {/* ── Images ── */}
          <div className="admin-form-group full">
            <label>
              תמונות (עד {MAX_IMAGES})
              {totalImagesSelected > 0 && <span className="images-count-badge">{totalImagesSelected}/{MAX_IMAGES}</span>}
            </label>

            <div className="admin-image-buttons">
              {/* capture=environment מבקש את המצלמה האחורית. בדסקטופ
                  הדפדפן מתעלם ופותח בורר קבצים, ולכן אין מה להסתיר. */}
              <label className="admin-image-btn">
                <Camera size={22} aria-hidden="true" /> צלם תמונה
                <input type="file" accept="image/*" capture="environment" onChange={addImages} disabled={room <= 0} />
              </label>

              <label className="admin-image-btn">
                <ImagePlus size={22} aria-hidden="true" /> בחר מהגלריה
                <input type="file" accept="image/*" multiple onChange={addImages} disabled={room <= 0} />
              </label>
            </div>

            {totalImagesSelected > 0 && (
              <div className="existing-images">
                {existingImages.map((url, i) => (
                  <div key={`old-${i}`} className="existing-image-item">
                    <img src={url} alt={`תמונה ${i + 1}`} />
                    {i === 0 && <span className="main-image-badge">ראשית</span>}
                    <button type="button" className="remove-image-btn" onClick={() => removeExistingImage(i)} aria-label="הסר תמונה">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {newImageUrls.map((url, i) => (
                  <div key={`new-${i}`} className="existing-image-item">
                    <img src={url} alt={images[i].name} />
                    {existingImages.length === 0 && i === 0 && <span className="main-image-badge">ראשית</span>}
                    <button type="button" className="remove-image-btn" onClick={() => removeNewImage(i)} aria-label="הסר תמונה">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="admin-images-hint">התמונה הראשונה תוצג כתמונה הראשית</p>

            {/* המוצרים שמגיעים מספק אחר בכל פעם. הסימון מוסיף הערה
                בעמוד המוצר, מתחת לגלריה. */}
            <label className="admin-checkbox">
              <input type="checkbox" checked={imageIllustrative} onChange={e => setImageIllustrative(e.target.checked)} />
              <span>התמונה להמחשה (המותג משתנה לפי המלאי)</span>
            </label>
            {imageIllustrative && (
              <p className="admin-checkbox-hint">
                <Info size={16} aria-hidden="true" />
                בעמוד המוצר תופיע הערה שהתמונה להמחשה בלבד.
              </p>
            )}
          </div>
        </div>

        {productsError && (
          <div className="admin-error">
            <AlertTriangle size={18} aria-hidden="true" /> {productsError}
          </div>
        )}

        <div className="admin-form-buttons">
          <button type="submit" className="admin-submit-btn" disabled={uploadingImages}>
            {uploadingImages
              ? <><Loader size={20} aria-hidden="true" /> מעלה...</>
              : editingProduct
                ? <><Save size={20} aria-hidden="true" /> שמור</>
                : <><Plus size={20} aria-hidden="true" /> הוסף מוצר</>}
          </button>
          {editingProduct && <button type="button" className="admin-cancel-btn" onClick={onDone}>ביטול</button>}
        </div>
      </form>

      <ProductFormPreview
        fields={{ name, price, sku, category, inStock, variants }}
        imageUrl={existingImages[0] || newImageUrls[0] || ''}
        categoryId={category}
      />
    </div>
  );
}

export default ProductFormTab;
