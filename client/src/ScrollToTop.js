/**
 * כפתור צף לחזרה לראש העמוד.
 */
import { useState, useEffect } from 'react';

/** מציג את כפתור החזרה לראש העמוד. */
function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /** מעדכן את נראות הכפתור לפי מיקום הגלילה. */
    function handleScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /** גולל לראש העמוד. */
  function scrollUp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <button className="scroll-to-top" onClick={scrollUp} title="חזור למעלה">
      ↑
    </button>
  );
}

export default ScrollToTop;