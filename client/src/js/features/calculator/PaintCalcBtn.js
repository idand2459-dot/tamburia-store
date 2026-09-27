/**
 * כפתור צף שגולל אל מחשבון הצבע.
 */
import { useState, useEffect } from 'react';
import { PaintRoller } from 'lucide-react';

/** מציג את הכפתור הצף של מחשבון הצבע. */
function PaintCalcBtn({ menuOpen }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    /** מעדכן את נראות הכפתור לפי מיקום הגלילה. */
    function handleScroll() {
      setVisible(window.scrollY > 0);
    }
    window.addEventListener('scroll', handleScroll);
    setVisible(true);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /** גולל אל מחשבון הצבע. */
  function scrollToCalc() {
    const el = document.querySelector('.paint-calc-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!visible) return null;

  return (
    <button
      className={`paint-calc-float-btn ${menuOpen ? 'menu-open' : ''}`}
      onClick={scrollToCalc}
      title="מחשבון צבע"
      aria-label="מחשבון צבע"
    >
      <PaintRoller size={22} aria-hidden="true" />
      <span className="paint-calc-float-label">מחשבון צבע</span>
    </button>
  );
}

export default PaintCalcBtn;