/**
 * מדווח אם העמוד נגלל מעבר למרחק מסוים מהראש.
 *
 * הוק נפרד ולא state בתוך Navbar, מאותה סיבה שיש hooks/ לכל השאר: זה
 * מצב סביבה ולא מצב של רכיב, ועוד רכיבים בהמשך ירצו אותו.
 *
 * מאזין passive, ממוזער לקריאה אחת לפריים ב-requestAnimationFrame, ומעדכן
 * state רק כשהבוליאני באמת מתהפך — גלילה מייצרת מאות אירועים, ורינדור
 * מחדש של הנאבאר על כל אחד מהם היה מבזבז את הזמן שנשאר לגלילה עצמה.
 */
import { useEffect, useRef, useState } from 'react';

/** קורא את מצב הגלילה הנוכחי. */
function readScrolled(offset) {
  return typeof window !== 'undefined' && window.scrollY > offset;
}

/** מחזיר true כשהעמוד נגלל מעבר ל-offset פיקסלים. */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(() => readScrolled(offset));
  const currentRef = useRef(scrolled);

  useEffect(() => {
    let frame = 0;

    /** מעדכן את הדגל, אם הוא התהפך. */
    function apply() {
      frame = 0;
      const next = readScrolled(offset);
      if (next === currentRef.current) return;
      currentRef.current = next;
      setScrolled(next);
    }

    /** אוסף אירועי גלילה לפריים אחד. */
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    }

    // סנכרון מיד: העמוד יכול להיטען כשהוא כבר גלול, למשל ברענון או
    // בחזרה אחורה בדפדפן.
    apply();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [offset]);

  return scrolled;
}

export default useScrolled;
