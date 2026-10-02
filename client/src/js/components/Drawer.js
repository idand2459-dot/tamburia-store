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
 * מהחלון. עכשיו הם נכתבים פעם אחת ולכן קיימים בשלושתם — שלושה מהם
 * ב-useModalFocus, שגם התפריט וחלון החיפוש משתמשים בו.
 *
 * הפאנל עצמו flex column: הכותרת והשורה התחתונה אינן מתכווצות והגוף
 * לוקח את השאר וגולל — מה שנותן את אותה התנהגות ש-position: sticky
 * נתן קודם, בלי שכבת המיקום שהייתה צריכה להיות מעל התוכן.
 */
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useModalFocus } from '../hooks/useModalFocus';

/** מציג את החלון הצדדי ואת מה שנתון לו. */
function Drawer({ title, icon: Icon, onClose, footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  // לכל מגירה כתובת משלה (/cart, /wishlist), ולכן גם כותרת טאב משלה.
  // בסגירה חוזרת הכותרת של העמוד שמאחור.
  usePageTitle(title, { restore: true });

  // המיקוד, Escape ומלכודת ה-Tab — משותפים עם התפריט וחלון החיפוש.
  useModalFocus(panelRef, { onClose });

  // נעילת הגלילה מאחור. הערך הקודם נשמר ולא מאופס לריק, כדי שסגירה לא
  // תדרוך על נעילה של מישהו אחר.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer-head">
          {/* h1 ולא h2: העמוד שמאחור inert כל עוד המגירה פתוחה
              (StoreLayout), כך שלקורא המסך המגירה היא כל העמוד, וזו
              הכותרת הראשית שלו. */}
          <h1 className="drawer-title" id={titleId}>
            {Icon && <Icon size={20} aria-hidden="true" />}
            {title}
          </h1>
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
