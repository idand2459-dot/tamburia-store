/**
 * עורך הצבעים בטופס המוצר: שורה לכל צבע, שם וגוון.
 *
 * קודם זו הייתה שורת טקסט אחת, "לבן, שחור, אפור", והגוון נקבע בקליינט
 * לפי מפה של 15 שמות. כל שם אחר קיבל אפור אחיד, ולכן "אגוז" ו-"טיק"
 * נראו בחנות כמו אותו מוצר. עכשיו הגוון הוא נתון של הצבע, ומי שמקליד
 * אותו הוא מי שיודע מה צבע המוצר.
 *
 * הפלטה נפתחת מתחת לשורה שלוחצים על העיגול שלה, ולא בתוך כל שורה
 * תמיד: 24 כפתורים בגודל אצבע כפול שלושה צבעים הם ארבע מסכים של
 * גלילה בטלפון. העיגול עצמו נשאר גלוי תמיד והוא גם התצוגה המקדימה,
 * כך שמה שנפתח הוא הבחירה — לא המידע.
 *
 * לצד הפלטה יש <input type="color"> לגוון שאינו ברשימה. הוא פקד של
 * הדפדפן ולכן הוא נראה אחרת בכל מערכת, וזו הסיבה שהוא לא הפקד הראשי.
 */
import { useState } from 'react';
import { X, Plus, Pipette } from 'lucide-react';
import { PALETTE, FALLBACK_HEX } from '../../utils/colorPalette';

/** מציג את רשימת הצבעים של המוצר ואת עריכתה. */
function ColorRows({ colors, onChange }) {
  // איזו שורה פתוחה לבחירת גוון. null = אף אחת.
  const [openIndex, setOpenIndex] = useState(null);

  /** מחליף שורה אחת ומשאיר את השאר. */
  function setRow(index, patch) {
    onChange(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));
  }

  /** מוסיף שורה ריקה ופותח אותה מיד לבחירת גוון. */
  function addRow() {
    onChange([...colors, { name: '', hex: '' }]);
    setOpenIndex(colors.length);
  }

  /** מסיר שורה, וסוגר את הפלטה אם היא הייתה פתוחה עליה. */
  function removeRow(index) {
    onChange(colors.filter((_, i) => i !== index));
    setOpenIndex(null);
  }

  /** בוחר גוון מוכן. השם מתמלא רק אם הוא עוד ריק. */
  function pickShade(index, shade) {
    const current = colors[index];
    setRow(index, { hex: shade.hex, name: current.name.trim() || shade.name });
    setOpenIndex(null);
  }

  return (
    <div className="admin-colors">
      {colors.length > 0 && (
        <ul className="admin-color-list">
          {colors.map((color, i) => (
            <li key={i} className="admin-color-row">
              <div className="admin-color-main">
                <button
                  type="button"
                  className={`admin-color-dot ${color.hex ? '' : 'is-unknown'}`}
                  style={color.hex ? { backgroundColor: color.hex } : undefined}
                  aria-expanded={openIndex === i}
                  aria-label={`בחר גוון עבור ${color.name || 'הצבע'}`}
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                />

                <input
                  className="admin-color-name"
                  placeholder="שם הצבע (לבן, אגוז, פחם)"
                  value={color.name}
                  onChange={e => setRow(i, { name: e.target.value })}
                  aria-label={`שם הצבע ${i + 1}`}
                />

                <button
                  type="button"
                  className="admin-color-remove"
                  onClick={() => removeRow(i)}
                  aria-label={`הסר את ${color.name || 'הצבע'}`}>
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              {openIndex === i && (
                <div className="admin-shades">
                  {PALETTE.map(({ group, colors: shades }) => (
                    <div key={group} className="admin-shade-group">
                      <span className="admin-shade-label">{group}</span>
                      <div className="admin-shade-grid">
                        {shades.map(shade => (
                          <button
                            key={shade.hex + shade.name}
                            type="button"
                            className="admin-shade"
                            style={{ backgroundColor: shade.hex }}
                            aria-pressed={color.hex === shade.hex}
                            title={shade.name}
                            aria-label={shade.name}
                            onClick={() => pickShade(i, shade)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <label className="admin-shade-custom">
                    <Pipette size={18} aria-hidden="true" />
                    גוון אחר
                    <input
                      type="color"
                      value={color.hex || FALLBACK_HEX}
                      onChange={e => setRow(i, { hex: e.target.value })}
                    />
                  </label>

                  {color.hex && (
                    <button type="button" className="admin-shade-clear" onClick={() => setRow(i, { hex: '' })}>
                      בלי גוון
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="admin-color-add" onClick={addRow}>
        <Plus size={18} aria-hidden="true" /> הוסף צבע
      </button>

      {colors.length > 0 && (
        <p className="admin-form-hint">
          צבע בלי גוון יוצג בחנות כעיגול מפוספס — מתאים ל"שקוף" או ל"מספר 2",
          שאינם צבעים.
        </p>
      )}
    </div>
  );
}

export default ColorRows;
