/**
 * מחשבון הצבע: חישוב כמות לפי שטח וסימולציית גוון הפיגמנט.
 */
import { useState, useEffect } from 'react';
import {
  PaintRoller, Brush, Ruler, AppWindow, DoorOpen, PaintBucket, X,
  CheckCircle, Lightbulb, Store, Phone, ShoppingCart, Sun, CloudSun, Moon,
} from 'lucide-react';
import paintCalcBg from '../../../assets/images/sections/paint-calc-bg-1672.webp';
import { PHONES } from '../../utils/storeInfo';
import { getProduct } from '../../services/productService';
import { getPigmentFormulas } from '../../services/pigmentService';
import { formatPrice, lineTotal, sumPrices } from '../../utils/pricing';
import { LARGE_BUCKET_LITERS, blendWithWhite, isLight, calculatePaint, cheaperBucket } from '../../utils/paintCalc';

const SHADE_CONFIG = {
  light:  { label: 'בהיר',   Icon: Sun,      factor: 0.15 },
  medium: { label: 'בינוני', Icon: CloudSun, factor: 0.35 },
  dark:   { label: 'כהה',    Icon: Moon,     factor: 0.65 },
};

/**
 * המוצרים שהחבילה מוסיפה לעגלה, לפי מזהה במסד.
 *
 * ההתאמה היא לפי id ולא לפי category+subcategory כמו ב-ProjectCalculator.
 * שם זה עובד כי לכל פריט יש תת-קטגוריה מזהה; כאן לשני המוצרים
 * subcategory ריק, ועוד 42 מוצרי צביעה חולקים איתם את אותו צירוף.
 * findProduct בוחר את הזול ביותר, כך שהעתקה ישירה של הדפוס הייתה
 * מחזירה "ספריי מסיר צבע" ב-0 ₪ — כלומר משחזרת בדיוק את הבאג שנסגר כאן.
 */
const BUNDLE_PRODUCT_IDS = {
  paint5: 627,
  paint18: 628,
  colorMix: 416,
};

/** התוויות של שני גדלי הדלי, לשימוש בתוצאות ובכפתור. */
const BUCKET_LABELS = {
  paint5: "5 ל'",
  paint18: `${LARGE_BUCKET_LITERS} ל'`,
};

/** מציג את מחשבון הצבע ואת סימולציית הגוון. */
function PaintCalculator({ addBundleToCart }) {
  const [walls, setWalls] = useState([{ length: '', height: '' }]);
  const [windows, setWindows] = useState(0);
  const [doors, setDoors] = useState(0);
  const [coats, setCoats] = useState(2);
  const [result, setResult] = useState(null);

  const [formulas, setFormulas] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedShade, setSelectedShade] = useState('medium');
  const [bundleAdded, setBundleAdded] = useState(false);
  const [bundleProducts, setBundleProducts] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    getPigmentFormulas({ signal: controller.signal })
      .then(list => {
        setFormulas(list);
        if (list.length > 0) setSelectedColor(list[0].color_code);
      })
      .catch(() => {}); // ביטול בלבד — כל כישלון אחר כבר חזר כמערך ריק
    return () => controller.abort();
  }, []);

  // מושכים את מוצרי החבילה עצמם, כדי שהמחיר והמזהה שייכנסו לעגלה
  // יהיו של המוצר האמיתי. מוצר שלא נמצא פשוט לא נכנס לחבילה.
  useEffect(() => {
    const keys = Object.keys(BUNDLE_PRODUCT_IDS);
    Promise.all(keys.map(key => getProduct(BUNDLE_PRODUCT_IDS[key]).catch(() => null)))
      .then(list => {
        const found = {};
        keys.forEach((key, i) => { if (list[i]) found[key] = list[i]; });
        setBundleProducts(found);
      });
  }, []);

  useEffect(() => { setBundleAdded(false); }, [walls, windows, doors, coats, selectedColor, selectedShade]);

  /** מוסיף קיר לחישוב. */
  function addWall() {
    if (walls.length < 6) setWalls([...walls, { length: '', height: '' }]);
  }
  /** מסיר קיר מהחישוב. */
  function removeWall(i) {
    if (walls.length > 1) setWalls(walls.filter((_, idx) => idx !== i));
  }
  /** מעדכן את מידות הקיר. */
  function updateWall(i, field, value) {
    setWalls(walls.map((w, idx) => idx === i ? { ...w, [field]: value } : w));
  }

  /** מחשב את שטח הצביעה ואת כמות הצבע והפיגמנט (utils/paintCalc.js). */
  function calculate() {
    // A formula is looked up only when a color is selected.
    const formula = selectedColor ? formulas.find(f => f.color_code === selectedColor) : undefined;
    setResult(calculatePaint({ walls, windows, doors, coats, formula, shade: selectedShade }));
    setBundleAdded(false);
  }

  /** מחזיר את מוצר החבילה אם נמצא והוא במלאי, אחרת null. */
  function findBundleProduct(key) {
    const product = bundleProducts[key];
    if (!product || product.in_stock === false) return null;
    return product;
  }

  /** מוסיף לעגלה את המוצרים שהמחשבון המליץ עליהם. */
  function handleAddBundle() {
    if (!addBundleToCart || bundleItems.length === 0) return;
    addBundleToCart(bundleItems.map(i => ({ ...i.found, quantity: i.quantity })));
    setBundleAdded(true);
  }

  const currentFormula = formulas.find(f => f.color_code === selectedColor);
  const previewBg = currentFormula
    ? blendWithWhite(currentFormula.hex, SHADE_CONFIG[selectedShade].factor)
    : '#FFFFFF';
  const previewTextDark = isLight(previewBg);

  const chosenBucket = cheaperBucket(result, findBundleProduct);

  // מה שהמחשבון ממליץ עליו, מול מה שבאמת קיים בקטלוג. פריט שאין לו
  // מוצר אמיתי נשאר בהמלצה על המסך אבל לא נכנס לעגלה.
  const recommended = result
    ? [
      // כששני הגדלים חסרים מהקטלוג עדיין מציגים את ההמלצה, כדי
      // ש-bundleHasUnknown ידליק את ההודעה במקום להשמיט אותה בשקט.
      { key: chosenBucket?.key ?? 'paint5', quantity: chosenBucket?.quantity ?? result.paintCans5 },
      { key: 'colorMix', quantity: result.colorMixBottles },
    ].filter(line => line.quantity > 0)
    : [];
  const resolvedBundle = recommended.map(line => ({ ...line, found: findBundleProduct(line.key) }));
  const bundleItems = resolvedBundle.filter(line => line.found);
  const bundleHasUnknown = resolvedBundle.some(line => !line.found);
  const bundleTotal = sumPrices(bundleItems.map(line => lineTotal(line.found.price, line.quantity)));
  const isValid = walls.some(w => parseFloat(w.length) > 0 && parseFloat(w.height) > 0);

  return (
    <section className="paint-calc-section">
      {/* רקע דקורטיבי. <img> ולא background ב-CSS, כדי שיוכל להיטען בעצלות —
          המקטע נמצא הרבה מתחת לקיפול. ב-CSS הוא מוסתר מתחת ל-768px, ותמונה
          עם display: none לא נטענת כלל. */}
      <img className="paint-calc-bg" src={paintCalcBg} alt=""
        loading="lazy" decoding="async" />
      <div className="paint-calc-content">
        <div className="paint-calc-header">
          <span className="section-pill">כלי עזר</span>
          <h2 className="paint-calc-title"><PaintRoller size={28} aria-hidden="true" /> מחשבון צבע</h2>
          <p className="paint-calc-subtitle">חשבו כמה צבע תצטרכו לפני שאתם מגיעים לחנות</p>
        </div>

        <div className="paint-calc-body">

          {/* ── Color & Shade Selector ── */}
          {formulas.length > 0 && (
            <div className="paint-calc-card">
              <h3 className="paint-calc-card-title"><PaintRoller size={20} aria-hidden="true" /> קולור MIX יעקבי — בחרו גוון</h3>

              <div className="paint-pigment-row">
                {/* Color swatches */}
                <div className="paint-color-swatches">
                  {formulas.map(f => (
                    <button
                      key={f.color_code}
                      title={f.color_name_he}
                      className={`paint-swatch ${selectedColor === f.color_code ? 'active' : ''}`}
                      style={{ background: f.hex }}
                      onClick={() => setSelectedColor(f.color_code)}
                    />
                  ))}
                </div>

                {/* Selected color label */}
                {currentFormula && (
                  <div className="paint-color-label">
                    <span className="paint-color-dot" style={{ background: currentFormula.hex }} />
                    {currentFormula.color_name_he}
                  </div>
                )}
              </div>

              {/* Shade selector */}
              <div className="paint-shade-row">
                <span className="paint-shade-label">עוצמת הגוון:</span>
                <div className="paint-shade-btns">
                  {Object.entries(SHADE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      className={`paint-shade-btn ${selectedShade === key ? 'active' : ''}`}
                      onClick={() => setSelectedShade(key)}>
                      <cfg.Icon size={18} aria-hidden="true" /> {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {currentFormula && (
                <div className="paint-preview-wrapper">
                  <div
                    className="paint-preview-swatch"
                    style={{ background: previewBg, color: previewTextDark ? '#333' : '#fff' }}>
                    <span className="paint-preview-label">תצוגה מקדימה</span>
                    <span className="paint-preview-name">{currentFormula.color_name_he} — {SHADE_CONFIG[selectedShade].label}</span>
                  </div>
                  <div className="paint-preview-note">
                    <strong>מינון:</strong> {currentFormula[`ml_per_liter_${selectedShade}`]} מ"ל לכל ליטר צבע לבן
                    {' '}· בקבוק 250מ"ל מכסה {Math.floor(250 / currentFormula[`ml_per_liter_${selectedShade}`])} ליטר
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Walls ── */}
          <div className="paint-calc-card">
            <h3 className="paint-calc-card-title"><Ruler size={20} aria-hidden="true" /> מידות הקירות</h3>
            <div className="paint-walls-list">
              {walls.map((wall, i) => (
                <div key={i} className="paint-wall-row">
                  <span className="paint-wall-label">קיר {i + 1}</span>
                  <div className="paint-wall-inputs">
                    <div className="paint-input-group">
                      <input type="number" placeholder="אורך" min="0" step="0.1"
                        aria-label={`אורך קיר ${i + 1}, במטרים`}
                        value={wall.length} onChange={e => updateWall(i, 'length', e.target.value)} />
                      <span className="paint-unit">מ'</span>
                    </div>
                    <span className="paint-wall-x">×</span>
                    <div className="paint-input-group">
                      <input type="number" placeholder="גובה" min="0" step="0.1"
                        aria-label={`גובה קיר ${i + 1}, במטרים`}
                        value={wall.height} onChange={e => updateWall(i, 'height', e.target.value)} />
                      <span className="paint-unit">מ'</span>
                    </div>
                    {walls.length > 1 && (
                      <button className="paint-remove-btn" onClick={() => removeWall(i)} aria-label={`הסר את קיר ${i + 1}`}><X size={16} aria-hidden="true" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {walls.length < 6 && (
              <button className="paint-add-wall-btn" onClick={addWall}>+ הוסף קיר</button>
            )}
          </div>

          {/* ── Windows & Doors ── */}
          <div className="paint-calc-card">
            <h3 className="paint-calc-card-title"><AppWindow size={20} aria-hidden="true" /> חלונות ודלתות</h3>
            <div className="paint-openings">
              <div className="paint-opening-row">
                <span><AppWindow size={18} aria-hidden="true" /> מספר חלונות</span>
                <div className="paint-counter">
                  <button onClick={() => setWindows(Math.max(0, windows - 1))}>−</button>
                  <span>{windows}</span>
                  <button onClick={() => setWindows(windows + 1)}>+</button>
                </div>
                <span className="paint-opening-note">~1.5 מ"ר כל אחד</span>
              </div>
              <div className="paint-opening-row">
                <span><DoorOpen size={18} aria-hidden="true" /> מספר דלתות</span>
                <div className="paint-counter">
                  <button onClick={() => setDoors(Math.max(0, doors - 1))}>−</button>
                  <span>{doors}</span>
                  <button onClick={() => setDoors(doors + 1)}>+</button>
                </div>
                <span className="paint-opening-note">~2 מ"ר כל אחת</span>
              </div>
            </div>
          </div>

          {/* ── Coats ── */}
          <div className="paint-calc-card">
            <h3 className="paint-calc-card-title"><Brush size={20} aria-hidden="true" /> מספר ציפויים</h3>
            <div className="paint-coats">
              {[1, 2, 3].map(c => (
                <button key={c} className={`paint-coat-btn ${coats === c ? 'active' : ''}`}
                  onClick={() => setCoats(c)}>
                  {c} ציפוי{c > 1 ? 'ים' : ''}
                  {c === 1 && <span>קיר בהיר</span>}
                  {c === 2 && <span>מומלץ</span>}
                  {c === 3 && <span>קיר כהה</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Calculate Button ── */}
          <button className={`paint-calc-btn ${!isValid ? 'disabled' : ''}`}
            disabled={!isValid} onClick={calculate}>
            חשב כמות צבע ←
          </button>

          {/* ── Results ── */}
          {result && (
            <div className="paint-results">
              <div className="paint-results-header">
                <span><CheckCircle size={24} aria-hidden="true" /></span>
                <h3>התוצאות שלך</h3>
              </div>

              <div className="paint-results-grid">
                <div className="paint-result-item">
                  <span className="paint-result-icon"><Ruler size={24} aria-hidden="true" /></span>
                  <div>
                    <div className="paint-result-value">{result.netArea} מ"ר</div>
                    <div className="paint-result-label">שטח נטו לצביעה</div>
                    <div className="paint-result-sub">(סה"כ {result.totalWallArea} מ"ר פחות פתחים)</div>
                  </div>
                </div>

                <div className="paint-result-item accent">
                  <span className="paint-result-icon"><PaintBucket size={24} aria-hidden="true" /></span>
                  <div>
                    <div className="paint-result-value">{result.paintLiters} ליטר</div>
                    <div className="paint-result-label">צבע לבן</div>
                    <div className="paint-result-sub">
                      {/* הגודל שנבחר בפועל — אותו אחד שייכנס לעגלה */}
                      {chosenBucket
                        ? `דלי ${BUCKET_LABELS[chosenBucket.key]} × ${chosenBucket.quantity}`
                        : result.paintCans5 > 0 && `דלי ${BUCKET_LABELS.paint5} × ${result.paintCans5}`}
                    </div>
                  </div>
                </div>

                <div className="paint-result-item" style={{ borderRight: `4px solid ${currentFormula?.hex || '#e63946'}` }}>
                  <span className="paint-result-icon"><PaintRoller size={24} aria-hidden="true" /></span>
                  <div>
                    <div className="paint-result-value">{result.colorMixBottles} בקבוק</div>
                    <div className="paint-result-label">קולור MIX יעקבי 250מ"ל</div>
                    <div className="paint-result-sub">
                      {currentFormula ? `${currentFormula.color_name_he} — ${SHADE_CONFIG[selectedShade].label}` : 'לפי הגוון שתבחרו'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live preview in results */}
              {currentFormula && (
                <div className="paint-result-preview-bar"
                  style={{ background: `linear-gradient(135deg, ${previewBg} 0%, ${blendWithWhite(currentFormula.hex, SHADE_CONFIG[selectedShade].factor * 0.7)} 100%)` }}>
                  <span style={{ color: previewTextDark ? '#333' : '#fff', fontWeight: 600 }}>
                    <PaintRoller size={18} aria-hidden="true" /> הצבע המשוחזר שלך: {currentFormula.color_name_he} {SHADE_CONFIG[selectedShade].label}
                  </span>
                </div>
              )}

              {/* Bundle CTA */}
              {addBundleToCart && bundleItems.length > 0 && (
                <button
                  className={`paint-bundle-btn ${bundleAdded ? 'added' : ''}`}
                  onClick={handleAddBundle}
                  disabled={bundleAdded}>
                  {bundleAdded
                    ? <><CheckCircle size={18} aria-hidden="true" /> נוסף לעגלה!</>
                    : <><ShoppingCart size={18} aria-hidden="true" /> {`הוסף חבילה לעגלה — ${chosenBucket ? `${chosenBucket.quantity} דלי ${BUCKET_LABELS[chosenBucket.key]}` : ''} + ${result.colorMixBottles} בקבוק קולור MIX · ${formatPrice(bundleTotal)}`}</>}
                </button>
              )}

              {addBundleToCart && bundleHasUnknown && (
                <div className="paint-results-tip">
                  <span><Store size={20} aria-hidden="true" /></span>
                  <p>חלק מהפריטים אינם זמינים להזמנה כרגע — שווה לשאול עליהם בחנות.</p>
                </div>
              )}

              <div className="paint-results-tip">
                <span><Lightbulb size={20} aria-hidden="true" /></span>
                <p>
                  אנחנו ממליצים לקנות <strong>10% יותר</strong> מהכמות המחושבת למקרה של תיקונים.
                  הביאו את שם הגוון לחנות — ואנרי ישמח לעזור!
                </p>
              </div>

              <a href={`tel:${PHONES.store.tel}`} className="paint-results-cta">
                <Phone size={18} aria-hidden="true" /> התקשרו להזמין — {PHONES.store.display}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PaintCalculator;
