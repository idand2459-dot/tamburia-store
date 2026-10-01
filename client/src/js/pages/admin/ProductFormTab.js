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
 *
 * "הסתר מהחנות" אינו שדה בטופס אלא כפתור לידו, והוא שולח מיד ולא
 * בשמירה. הסיבה היא שהוא אינו עריכה של המוצר אלא החלטה עליו: מי
 * שפתח את הטופס כדי להסתיר מוצר לא אמור להצטרך לשמור גם את כל השאר,
 * ובוודאי לא להחליט מה קורה אם הוא לחץ ואז "ביטול". מוצר חדש אינו
 * מציג אותו כלל — אין מה להסתיר לפני שנוצר.
 */
import { useState, useEffect } from 'react';
import {
  Check, X, AlertTriangle, Loader, Save, Plus, Camera, ImagePlus, Info, Eye, EyeOff,
} from 'lucide-react';
import { CATEGORIES } from './adminConstants';
import { useObjectUrls } from '../../hooks/useObjectUrls';
import { asColors } from '../../utils/colorPalette';
import { parsePriceInput, formatAmount } from '../../utils/pricing';
import ProductFormPreview from './ProductFormPreview';
import ColorRows from './ColorRows';
import VariantRows from './VariantRows';

const MAX_IMAGES = 5;

const EMPTY = {
  name: '', price: '', inStock: true, colors: [], category: '',
  sku: '', description: '', variants: [], existingImages: [],
  imageIllustrative: false,
};

/**
 * מחזיר את מה שלא יעבור בשרת, או null כשהטופס תקין.
 *
 * הבדיקה כאן אינה מחליפה את זו שבשרת אלא מקדימה אותה: השרת עונה על
 * הגודל הראשון שנפל, וכאן אפשר לומר את זה ליד הכפתור בלי הלוך ושוב,
 * ובלי שהודעה באנגלית תגיע למסך של מי שמפעיל את החנות.
 */
function formProblem(price, variants) {
  const filled = variants.filter(v => v.label.trim() || String(v.price).trim());

  // המחיר של המוצר עצמו נבדק רק כשאין גדלים: עם גדלים השדה אינו מוצג,
  // והמחיר נגזר מהם.
  if (filled.length === 0 && parsePriceInput(price) === null) {
    return 'המחיר צריך להיות מספר עם עד שתי ספרות אחרי הנקודה — למשל 12.90';
  }

  if (filled.some(v => !v.label.trim())) return 'לכל גודל צריך שם — למשל "3 מטר"';
  if (filled.some(v => !(parsePriceInput(v.price) > 0))) {
    return 'לכל גודל צריך מחיר גדול מאפס, עם עד שתי ספרות אחרי הנקודה';
  }

  const labels = filled.map(v => v.label.trim());
  const duplicate = labels.find((label, i) => labels.indexOf(label) !== i);
  if (duplicate) return `הגודל "${duplicate}" מופיע פעמיים`;

  return null;
}

/** גוזר את שדות הטופס ממוצר קיים, או מחזיר טופס ריק. */
function fieldsFromProduct(product) {
  if (!product) return EMPTY;
  const existing = [];
  if (product.image_url) existing.push(product.image_url);
  if (product.images && Array.isArray(product.images)) existing.push(...product.images);
  return {
    name: product.name,
    price: formatAmount(product.price ?? 0),
    inStock: product.in_stock !== false,
    colors: asColors(product.colors),
    category: product.category || '',
    sku: product.sku || '',
    description: product.description || '',
    variants: Array.isArray(product.variants) && product.variants.length > 0
      ? product.variants.map(v => ({ label: v.label, price: formatAmount(v.price) }))
      : [],
    existingImages: existing,
    imageIllustrative: product.image_illustrative === true,
  };
}

/** מציג את טופס המוצר, להוספה או לעריכה. */
function ProductFormTab({
  editingProduct, onCreate, onUpdate, onToggleActive, uploadingImages, onDone, productsError,
}) {
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
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const f = fieldsFromProduct(editingProduct);
    setName(f.name); setPrice(f.price); setInStock(f.inStock);
    setColors(f.colors); setCategory(f.category); setSku(f.sku);
    setDescription(f.description); setVariants(f.variants);
    setExistingImages(f.existingImages); setImages([]);
    setImageIllustrative(f.imageIllustrative);
    setFormError('');
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

    const problem = formProblem(price, variants);
    if (problem) { setFormError(problem); return; }
    setFormError('');

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

          {variants.length === 0 ? (
            <div className="admin-form-group">
              <label htmlFor="pf-price">מחיר (₪) <span className="admin-required">*</span></label>
              {/* text ולא number: שדה number בדפדפן דוחה "12,90" עוד לפני
                  שהקוד רואה אותו, ובלי step חוסם 12.90 בשליחה. inputMode
                  פותח בטלפון את המקלדת המספרית עם נקודה; הפענוח — כולל
                  פסיק — הוא של parsePriceInput. */}
              <input id="pf-price" placeholder="0" type="text" inputMode="decimal" autoComplete="off" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
          ) : (
            <div className="admin-form-group">
              <label>מחיר (₪)</label>
              {/* השדה נעלם ולא מושבת: מספר אפור שאי אפשר לגעת בו מזמין
                  את השאלה "אז למה הוא שם". מה שנשאר הוא המשפט. */}
              <p className="admin-form-note">
                <Info size={16} aria-hidden="true" />
                המחיר נקבע לפי הגודל שהלקוח בוחר. בכרטיס המוצר יוצג הזול שבהם.
              </p>
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
            <label>צבעים</label>
            <p className="admin-form-explain">
              כל צבע מוצג בעמוד המוצר כעיגול בגוון שנבחר כאן.
            </p>
            <ColorRows colors={colors} onChange={setColors} />
          </div>

          <div className="admin-form-group full">
            <label htmlFor="pf-description">תיאור</label>
            <textarea id="pf-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          {/* ── גדלים ── */}
          <div className="admin-form-group full">
            <label>גדלים / גרסאות עם מחיר שונה</label>
            <p className="admin-form-explain">
              למוצר שנמכר בכמה מידות במחירים שונים. למשל כבל מאריך: 3 מטר ₪25, 5 מטר ₪35.
            </p>
            <VariantRows variants={variants} onChange={setVariants} />
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

        {(formError || productsError) && (
          <div className="admin-error">
            <AlertTriangle size={18} aria-hidden="true" /> {formError || productsError}
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

        {editingProduct && (
          <div className="admin-form-visibility">
            <p className="admin-form-note">
              <Info size={16} aria-hidden="true" />
              {editingProduct.active === false
                ? 'המוצר מוסתר: הוא אינו מופיע בחנות ואי אפשר להזמין אותו. הוא נשאר במסד, וההזמנות הישנות שלו לא נפגעו.'
                : 'הסתרה מוציאה את המוצר מהחנות בלי למחוק אותו, ואפשר להחזיר אותו בלחיצה.'}
            </p>
            <button
              type="button"
              className="admin-visibility-btn"
              onClick={() => onToggleActive(editingProduct)}>
              {editingProduct.active === false
                ? <><Eye size={18} aria-hidden="true" /> הצג בחנות</>
                : <><EyeOff size={18} aria-hidden="true" /> הסתר מהחנות</>}
            </button>
          </div>
        )}
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
