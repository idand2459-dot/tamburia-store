import { useState, useEffect } from 'react';

function PaintCalcBtn({ menuOpen }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 0);
    }
    window.addEventListener('scroll', handleScroll);
    setVisible(true); // מוצג מההתחלה
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    >
      🎨
      <span className="paint-calc-float-label">מחשבון צבע</span>
    </button>
  );
}

export default PaintCalcBtn;