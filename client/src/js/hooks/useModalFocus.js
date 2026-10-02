/**
 * ההתנהגות של חלון מודאלי מול מקלדת וקורא מסך.
 *
 * שלושה חלונות באתר צריכים אותה: המגירה (עגלה, הזמנות, מועדפים),
 * תפריט הניווט וחלון החיפוש. היא נכתבה קודם בתוך Drawer בלבד, ושני
 * האחרים פשוט לא עשו אותה — התפריט הסגור אפילו נשאר תחנת Tab מחוץ
 * למסך. כאן היא כתובה פעם אחת:
 *
 * - בפתיחה המיקוד נכנס לחלון (לאלמנט initialFocus, או לפאנל עצמו),
 *   ובסגירה חוזר לאלמנט שפתח אותו. document.contains נבדק כי אותו
 *   אלמנט יכול להיעלם מהמסך בזמן שהחלון פתוח.
 * - Escape סוגר.
 * - Tab נשאר בפנים: גלישה בין התחנה הראשונה לאחרונה.
 *
 * active מאפשר לחלון שתמיד נמצא ב-DOM (התפריט) להשתמש בזה; חלון
 * שמורכב רק כשהוא פתוח (המגירה) פשוט לא מעביר אותו.
 */
import { useEffect, useRef } from 'react';

/* מה שנחשב תחנת Tab בתוך החלון. זהה לרשימה שכל מלכודת מיקוד משתמשת
   בה, ובלי [tabindex="-1"] — אלמנט שמקבל מיקוד בקוד בלבד אינו תחנה. */
const FOCUSABLE = [
  'a[href]', 'button:not(:disabled)', 'input:not(:disabled)',
  'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** מפעיל על panelRef את המיקוד, ה-Escape ומלכודת ה-Tab כל עוד active. */
export function useModalFocus(panelRef, { active = true, onClose, initialFocus = null }) {
  // onClose בתוך ref: הקוראים מעבירים פונקציה חדשה בכל רינדור, ואם
  // היא הייתה בתלויות, המיקוד היה קופץ חזרה לפאנל בכל הקלדה.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const opener = document.activeElement;
    const target = () => initialFocus?.current || panelRef.current;
    target()?.focus();
    // התפריט נכנס ב-transition של visibility, וברגע הזה הוא עוד hidden —
    // והדפדפן מתעלם מ-focus() על אלמנט נסתר. ניסיון נוסף אחרי פריים קצר.
    const retry = document.activeElement === target()
      ? null
      : setTimeout(() => target()?.focus(), 60);
    return () => {
      clearTimeout(retry);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [active, panelRef, initialFocus]);

  useEffect(() => {
    if (!active) return undefined;

    /** מטפל ב-Escape ובגלישת ה-Tab. */
    function handleKey(e) {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
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
      const current = document.activeElement;

      // מחוץ לחלון — למשל אחרי לחיצה על הרקע שמעבירה מיקוד ל-body
      if (!panel.contains(current)) { e.preventDefault(); first.focus(); return; }

      // הפאנל עצמו מחזיק את המיקוד מיד אחרי הפתיחה. Tab קדימה ממנו
      // נכנס לתחנה הראשונה מעצמו, אבל Shift+Tab היה יוצא אחורה.
      if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, panelRef]);
}
