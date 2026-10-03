/**
 * מדווח אם אלמנט נכנס לתוך המסך — פעם אחת, ואחר כך מפסיק לעקוב.
 *
 * כל הקוראים חולקים IntersectionObserver אחד ברמת המודול, ולא אחד לכל
 * אלמנט: רשת קטגוריות היא 12 חושפים ורשת מוצרים תהיה עשרות, ו-observer
 * נפרד לכל אחד מהם פירושו עשרות callbacks שהדפדפן מריץ בכל גלילה.
 */
import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 0.15;

/** ה-callback של כל אלמנט שנצפה כרגע. WeakMap כדי שאלמנט שירד לא יישאר תקוע. */
const pending = new WeakMap();
let observer = null;

/**
 * האם נראה מהאלמנט מספיק כדי לחשוף אותו.
 *
 * הסף לבדו לא מספיק. אלמנט גבוה יותר מ-root/THRESHOLD לעולם לא יגיע לכך
 * ש-15% ממנו יימצאו על המסך בבת אחת, ובלי התנאי השני הוא היה נשאר
 * ב-opacity 0 לנצח. מחשבון הצבע בטלפון הוא בדיוק המקרה הזה — הוא ארוך
 * מפי שבעה מגובה המסך. לכן חושפים גם כשהאלמנט כבר ממלא את המסך.
 */
function visibleEnough(entry) {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= THRESHOLD) return true;
  const root = entry.rootBounds;
  return !!root && entry.intersectionRect.height >= root.height * 0.9;
}

/** מחזיר את ה-observer המשותף, ויוצר אותו בקריאה הראשונה. */
function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!visibleEnough(entry)) continue;
        const reveal = pending.get(entry.target);
        // חושפים פעם אחת: מפסיקים לעקוב מיד, כדי שגלילה חזרה למעלה
        // ולמטה לא תריץ את האנימציה שוב.
        observer.unobserve(entry.target);
        pending.delete(entry.target);
        reveal?.();
      }
    }, {
      // מפתן 0 נרשם גם כדי ש-visibleEnough יקבל דיווח על אלמנט גבוה
      // שלא יגיע ל-15% לעולם.
      threshold: [0, THRESHOLD],
      rootMargin: '0px 0px -10% 0px',
    });
  }
  return observer;
}

/** האם לדלג על החשיפה ההדרגתית ולהציג את הכול מיד. */
function shouldSkip() {
  if (typeof window === 'undefined') return true;
  if (!('IntersectionObserver' in window)) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** מחזיר ref לחיבור לאלמנט, ודגל שנדלק כשהוא נכנס למסך. */
export function useReveal() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(shouldSkip);

  useEffect(() => {
    if (isVisible) return undefined;

    const el = ref.current;
    if (!el) return undefined;

    const io = getObserver();
    pending.set(el, () => setIsVisible(true));
    io.observe(el);

    return () => {
      io.unobserve(el);
      pending.delete(el);
    };
  }, [isVisible]);

  return { ref, isVisible };
}
