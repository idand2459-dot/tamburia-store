/**
 * כפתור צף שגולל אל מחשבון הצבע.
 */
import { useState, useEffect } from 'react';
import { PaintRoller } from 'lucide-react';
import scrollToSection from '../../utils/scrollToSection';
import { PAINT_CALC_SELECTOR } from '../../utils/sections';

/** מציג את הכפתור הצף של מחשבון הצבע. */
function PaintCalcBtn() {
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

  if (!visible) return null;

  return (
    <button
      className="paint-calc-float-btn"
      onClick={() => scrollToSection(PAINT_CALC_SELECTOR)}
      title="מחשבון צבע"
      aria-label="מחשבון צבע"
    >
      <PaintRoller size={22} aria-hidden="true" />
      <span className="paint-calc-float-label">מחשבון צבע</span>
    </button>
  );
}

export default PaintCalcBtn;