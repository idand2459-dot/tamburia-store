import { useState, useEffect } from 'react';

const SHADE_CONFIG = {
  light:  { label: 'בהיר',   emoji: '☀️',  factor: 0.15 },
  medium: { label: 'בינוני', emoji: '🌤️', factor: 0.35 },
  dark:   { label: 'כהה',    emoji: '🌙',  factor: 0.65 },
};

function blendWithWhite(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(255 * (1 - factor) + r * factor)},${Math.round(255 * (1 - factor) + g * factor)},${Math.round(255 * (1 - factor) + b * factor)})`;
}

// Perceive luminance to decide text color on the preview swatch
function isLight(rgb) {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return true;
  const [r, g, b] = match.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

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

  useEffect(() => {
    fetch('/api/pigment-formulas')
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setFormulas(arr);
        if (arr.length > 0) setSelectedColor(arr[0].color_code);
      })
      .catch(() => {});
  }, []);

  // Reset bundle-added badge when inputs change
  useEffect(() => { setBundleAdded(false); }, [walls, windows, doors, coats, selectedColor, selectedShade]);

  function addWall() {
    if (walls.length < 6) setWalls([...walls, { length: '', height: '' }]);
  }
  function removeWall(i) {
    if (walls.length > 1) setWalls(walls.filter((_, idx) => idx !== i));
  }
  function updateWall(i, field, value) {
    setWalls(walls.map((w, idx) => idx === i ? { ...w, [field]: value } : w));
  }

  function calculate() {
    const totalWallArea = walls.reduce((sum, w) => {
      return sum + (parseFloat(w.length) || 0) * (parseFloat(w.height) || 0);
    }, 0);
    const netArea = Math.max(0, totalWallArea - windows * 1.5 - doors * 2);
    const paintLiters = (netArea * coats) / 10;

    let colorMixBottles = 0;
    if (selectedColor) {
      const formula = formulas.find(f => f.color_code === selectedColor);
      if (formula) {
        const mlPerLiter = formula[`ml_per_liter_${selectedShade}`];
        colorMixBottles = Math.ceil((paintLiters * mlPerLiter) / 250);
      }
    }

    setResult({
      totalWallArea: totalWallArea.toFixed(1),
      netArea: netArea.toFixed(1),
      paintLiters: Math.ceil(paintLiters * 10) / 10,
      paintCans5: Math.ceil(paintLiters / 5),
      paintCans15: Math.ceil(paintLiters / 15),
      colorMixBottles,
    });
    setBundleAdded(false);
  }

  function handleAddBundle() {
    if (!result || !addBundleToCart) return;
    const formula = formulas.find(f => f.color_code === selectedColor);
    const colorLabel = formula ? `${formula.color_name_he} — ${SHADE_CONFIG[selectedShade].label}` : '';
    const items = [];
    if (result.paintCans5 > 0)
      items.push({ id: 'paint-bundle-white-5L', name: 'דלי צבע לבן 5 ליטר', price: 0, quantity: result.paintCans5, image_url: '', in_stock: true });
    if (result.colorMixBottles > 0)
      items.push({ id: 'paint-bundle-kolor-mix', name: `קולור MIX יעקבי 250מ"ל — ${colorLabel}`, price: 0, quantity: result.colorMixBottles, image_url: '', in_stock: true });
    addBundleToCart(items);
    setBundleAdded(true);
  }

  const currentFormula = formulas.find(f => f.color_code === selectedColor);
  const previewBg = currentFormula
    ? blendWithWhite(currentFormula.hex, SHADE_CONFIG[selectedShade].factor)
    : '#FFFFFF';
  const previewTextDark = isLight(previewBg);
  const isValid = walls.some(w => parseFloat(w.length) > 0 && parseFloat(w.height) > 0);

  return (
    <section className="paint-calc-section">
      <div className="paint-calc-content">
        <div className="paint-calc-header">
          <span className="faq-tag">כלי עזר</span>
          <h2 className="paint-calc-title">🎨 מחשבון צבע</h2>
          <p className="paint-calc-subtitle">חשבו כמה צבע תצטרכו לפני שאתם מגיעים לחנות</p>
        </div>

        <div className="paint-calc-body">

          {/* ── Color & Shade Selector ── */}
          {formulas.length > 0 && (
            <div className="paint-calc-card paint-pigment-card">
              <h3 className="paint-calc-card-title">🎨 קולור MIX יעקבי — בחרו גוון</h3>

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
                      {cfg.emoji} {cfg.label}
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
            <h3 className="paint-calc-card-title">📐 מידות הקירות</h3>
            <div className="paint-walls-list">
              {walls.map((wall, i) => (
                <div key={i} className="paint-wall-row">
                  <span className="paint-wall-label">קיר {i + 1}</span>
                  <div className="paint-wall-inputs">
                    <div className="paint-input-group">
                      <input type="number" placeholder="אורך" min="0" step="0.1"
                        value={wall.length} onChange={e => updateWall(i, 'length', e.target.value)} />
                      <span className="paint-unit">מ'</span>
                    </div>
                    <span className="paint-wall-x">×</span>
                    <div className="paint-input-group">
                      <input type="number" placeholder="גובה" min="0" step="0.1"
                        value={wall.height} onChange={e => updateWall(i, 'height', e.target.value)} />
                      <span className="paint-unit">מ'</span>
                    </div>
                    {walls.length > 1 && (
                      <button className="paint-remove-btn" onClick={() => removeWall(i)}>✕</button>
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
            <h3 className="paint-calc-card-title">🪟 חלונות ודלתות</h3>
            <div className="paint-openings">
              <div className="paint-opening-row">
                <span>🪟 מספר חלונות</span>
                <div className="paint-counter">
                  <button onClick={() => setWindows(Math.max(0, windows - 1))}>−</button>
                  <span>{windows}</span>
                  <button onClick={() => setWindows(windows + 1)}>+</button>
                </div>
                <span className="paint-opening-note">~1.5 מ"ר כל אחד</span>
              </div>
              <div className="paint-opening-row">
                <span>🚪 מספר דלתות</span>
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
            <h3 className="paint-calc-card-title">🖌️ מספר ציפויים</h3>
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
                <span>✅</span>
                <h3>התוצאות שלך</h3>
              </div>

              <div className="paint-results-grid">
                <div className="paint-result-item">
                  <span className="paint-result-icon">📐</span>
                  <div>
                    <div className="paint-result-value">{result.netArea} מ"ר</div>
                    <div className="paint-result-label">שטח נטו לצביעה</div>
                    <div className="paint-result-sub">(סה"כ {result.totalWallArea} מ"ר פחות פתחים)</div>
                  </div>
                </div>

                <div className="paint-result-item accent">
                  <span className="paint-result-icon">🪣</span>
                  <div>
                    <div className="paint-result-value">{result.paintLiters} ליטר</div>
                    <div className="paint-result-label">צבע לבן</div>
                    <div className="paint-result-sub">
                      {result.paintCans5 > 0 && `דלי 5 ל' × ${result.paintCans5}`}
                      {result.paintCans5 > 0 && result.paintCans15 > 0 && ' | '}
                      {result.paintCans15 > 0 && `דלי 15 ל' × ${result.paintCans15}`}
                    </div>
                  </div>
                </div>

                <div className="paint-result-item" style={{ borderRight: `4px solid ${currentFormula?.hex || '#e63946'}` }}>
                  <span className="paint-result-icon">🎨</span>
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
                    🎨 הצבע המשוחזר שלך: {currentFormula.color_name_he} {SHADE_CONFIG[selectedShade].label}
                  </span>
                </div>
              )}

              {/* Bundle CTA */}
              {addBundleToCart && (
                <button
                  className={`paint-bundle-btn ${bundleAdded ? 'added' : ''}`}
                  onClick={handleAddBundle}
                  disabled={bundleAdded}>
                  {bundleAdded
                    ? '✅ נוסף לעגלה!'
                    : `🛒 הוסף חבילה לעגלה — ${result.paintCans5} דלי + ${result.colorMixBottles} בקבוק קולור MIX`}
                </button>
              )}

              <div className="paint-results-tip">
                <span>💡</span>
                <p>
                  אנחנו ממליצים לקנות <strong>10% יותר</strong> מהכמות המחושבת למקרה של תיקונים.
                  הביאו את שם הגוון לחנות — ואנרי ישמח לעזור!
                </p>
              </div>

              <a href="tel:039315750" className="paint-results-cta">
                📞 התקשרו להזמין — 03-9315750
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PaintCalculator;
