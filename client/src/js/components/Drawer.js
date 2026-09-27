/**
 * מגירה — החלון הצדדי שהעגלה, איתור ההזמנות והמועדפים נפתחים בו.
 *
 * שלושת החלונות האלה היו שלושה חלונות: לכל אחד רקע משלו, פאנל משלו,
 * כותרת משלה וכפתור סגירה משלו, בשלושה קבצי CSS. כאן הם רכיב אחד,
 * וכל מה ששונה ביניהם הוא הכותרת, האייקון, הגוף והשורה התחתונה.
 *
 * הנגישות היא הסיבה האמיתית לאיחוד. חלון מודאלי חייב ארבעה דברים
 * שאף אחד מהשלושה לא עשה: Escape שסוגר, מיקוד שנכנס לפאנל בפתיחה
 * וחוזר בסגירה לכפתור שפתח אותו, גלילה נעולה מאחור, ו-Tab שאינו יוצא
 * מהחלון. עכשיו הם נכתבים פעם אחת ולכן קיימים בשלושתם.
 *
 * הפאנל עצמו flex column: הכותרת והשורה התחתונה אינן מתכווצות והגוף
 * לוקח את השאר וגולל — מה שנותן את אותה התנהגות ש-position: sticky
 * נתן קודם, בלי שכבת המיקום שהייתה צריכה להיות מעל התוכן.
 */
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/* מה שנחשב תחנת Tab בתוך הפאנל. זהה לרשימה שכל מלכודת מיקוד משתמשת
   בה, ובלי [tabindex="-1"] — אלמנט שמקבל מיקוד בקוד בלבד אינו תחנה. */
const FOCUSABLE = [
  'a[href]', 'button:not(:disabled)', 'input:not(:disabled)',
  'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** מציג את החלון הצדדי ואת מה שנתון לו. */
function Drawer({ title, icon: Icon, onClose, footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  // המיקוד: נכנס לפאנל בפתיחה וחוזר בסגירה לאלמנט שפתח אותו — כפתור
  // העגלה בניווט, למשל. document.contains נבדק כי אותו אלמנט יכול
  // להיעלם מהמסך בזמן שהחלון פתוח.
  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // נעילת הגלילה מאחור. הערך הקודם נשמר ולא מאופס לריק, כדי שסגירה לא
  // תדרוך על נעילה של מישהו אחר.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Escape סוגר, ו-Tab נשאר בפנים. המלכודת היא גלישה בין הראשון
  // והאחרון: זה כל מה שצריך, כי הפאנל הוא האלמנט האחרון בעמוד ולכן
  // סדר ה-Tab בתוכו הוא סדר ה-DOM שלו.
  useEffect(() => {
    /** מטפל ב-Escape ובגלישת ה-Tab. */
    function handleKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      // בלי סינון לפי נראות: הדבר היחיד במגירות שמוסתר לעין אבל כן
      // תחנת Tab הוא הרדיו של אופן הקבלה, וסינון כזה היה מוציא בדיוק
      // אותו מהמלכודת.
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // מחוץ לפאנל — למשל אחרי לחיצה על הרקע שמעבירה מיקוד ל-body
      if (!panel.contains(active)) { e.preventDefault(); first.focus(); return; }

      // הפאנל עצמו מחזיק את המיקוד מיד אחרי הפתיחה. Tab קדימה ממנו
      // נכנס לתחנה הראשונה מעצמו, אבל Shift+Tab היה יוצא אחורה.
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />

      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <h2 className="drawer-title" id={titleId}>
            {Icon && <Icon size={20} aria-hidden="true" />}
            {title}
          </h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="סגור">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">{children}</div>

        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

export default Drawer;
