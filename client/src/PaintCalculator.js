import { useState } from 'react';

function PaintCalculator() {
  const [walls, setWalls] = useState([{ length: '', height: '' }]);
  const [windows, setWindows] = useState(0);
  const [doors, setDoors] = useState(0);
  const [coats, setCoats] = useState(2);
  const [result, setResult] = useState(null);

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
      const l = parseFloat(w.length) || 0;
      const h = parseFloat(w.height) || 0;
      return sum + l * h;
    }, 0);

    const windowArea = windows * 1.5;
    const doorArea = doors * 2;
    const netArea = Math.max(0, totalWallArea - windowArea - doorArea);

    // צבע לבן: ~10 מ"ר לליטר לציפוי אחד
    const paintLiters = (netArea * coats) / 10;

    // קולור MIX: ליטר אחד מכסה 4 מ"ר ב-2 שכבות
    // נחשב לפי שטח נטו ב-2 שכבות
    const colorMixLiters = (netArea * coats) / 4;
    const colorMixBottles = Math.ceil(colorMixLiters); // בקבוק = ~1 ליטר

    setResult({
      totalWallArea: totalWallArea.toFixed(1),
      netArea: netArea.toFixed(1),
      paintLiters: Math.ceil(paintLiters * 10) / 10,
      paintCans5: Math.ceil(paintLiters / 5),
      paintCans15: Math.ceil(paintLiters / 15),
      colorMixBottles,
    });
  }

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
          {/* קירות */}
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

          {/* חלונות ודלתות */}
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

          {/* ציפויים */}
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

          {/* כפתור חישוב */}
          <button className={`paint-calc-btn ${!isValid ? 'disabled' : ''}`}
            disabled={!isValid} onClick={calculate}>
            חשב כמות צבע ←
          </button>

          {/* תוצאות */}
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
                      {result.paintCans5 > 0 && `דלי 5 ליטר × ${result.paintCans5}`}
                      {result.paintCans5 > 0 && result.paintCans15 > 0 && ' | '}
                      {result.paintCans15 > 0 && `דלי 15 ליטר × ${result.paintCans15}`}
                    </div>
                  </div>
                </div>

                <div className="paint-result-item">
                  <span className="paint-result-icon">🎨</span>
                  <div>
                    <div className="paint-result-value">{result.colorMixBottles} בקבוק</div>
                    <div className="paint-result-label">קולור MIX יעקבי</div>
                    <div className="paint-result-sub">לפי הגוון שתבחרו מהמניפה</div>
                  </div>
                </div>
              </div>

              <div className="paint-results-tip">
                <span>💡</span>
                <p>
                  אנחנו ממליצים לקנות <strong>10% יותר</strong> מהכמות המחושבת למקרה של תיקונים.
                  הביאו את קוד הגוון מהמניפה של קולור MIX לחנות — ואנרי ישמח לעזור!
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