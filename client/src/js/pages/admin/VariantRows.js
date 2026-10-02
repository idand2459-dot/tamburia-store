/**
 * הגדלים של המוצר: תווית ומחיר לכל גודל.
 *
 * הפיצ'ר קיים מזמן ואף מוצר אחד בחנות לא משתמש בו. הסיבה נראית
 * בטופס הקודם: הכותרת אמרה "גרסאות מוצר עם מחיר שונה", השדה הראשון
 * ביקש "תיאור", ולא היה שום דבר שאומר *למה* למלא את זה או מה יקרה
 * אחר כך. מי שמוכר כבל מאריך בשני אורכים לא מזהה את עצמו במילה
 * "גרסה".
 *
 * מכאן הכותרת, הדוגמה, וכפתור "הוסף גודל" שהוא הדבר הבולט באזור.
 * הסדר חשוב ללקוח — 3 מטר לפני 5 מטר — ואין דרך לשנות אותו אחרי
 * ההקלדה חוץ מלמחוק הכול, ולכן יש חצים.
 *
 * הערכים הם מחרוזות ולא מספרים: שדה שהתרוקן צריך להישאר ריק בזמן
 * ההקלדה ולא לקפוץ ל-0, וההמרה נעשית בשמירה.
 */
import { X, Plus, ArrowUp, ArrowDown } from 'lucide-react';

/** מציג את רשימת הגדלים של המוצר ואת עריכתה. */
function VariantRows({ variants, onChange }) {
  /** מחליף שורה אחת ומשאיר את השאר. */
  function setRow(index, patch) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  /** מזיז שורה מעלה או מטה. בקצוות הכפתור כבוי ולכן אין מה לבדוק. */
  function move(index, delta) {
    const next = [...variants];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }

  return (
    <div className="admin-variants">
      {variants.length > 0 && (
        <ul className="admin-variant-list">
          {variants.map((v, i) => (
            <li key={i} className="admin-variant-row">
              <input
                className="admin-variant-label"
                placeholder="גודל (3 מטר)"
                value={v.label}
                onChange={e => setRow(i, { label: e.target.value })}
                aria-label={`שם הגודל ${i + 1}`}
              />

              <div className="admin-variant-price">
                <span aria-hidden="true">₪</span>
                {/* text ולא number, מאותה סיבה כמו שדה המחיר בטופס: כדי
                    ש-"12,90" יתקבל. הפענוח ב-parsePriceInput. */}
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="מחיר"
                  value={v.price}
                  onChange={e => setRow(i, { price: e.target.value })}
                  aria-label={`מחיר עבור ${v.label || `גודל ${i + 1}`}`}
                />
              </div>

              <div className="admin-variant-actions">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`העבר את ${v.label || 'הגודל'} למעלה`}>
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === variants.length - 1}
                  aria-label={`העבר את ${v.label || 'הגודל'} למטה`}>
                  <ArrowDown size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="admin-variant-remove"
                  onClick={() => onChange(variants.filter((_, j) => j !== i))}
                  aria-label={`הסר את ${v.label || 'הגודל'}`}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="admin-variant-add" onClick={() => onChange([...variants, { label: '', price: '' }])}>
        <Plus size={20} aria-hidden="true" /> הוסף גודל
      </button>
    </div>
  );
}

export default VariantRows;
