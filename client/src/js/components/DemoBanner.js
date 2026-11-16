/**
 * The persistent notice of the portfolio demo, on every storefront page and in the admin. It renders
 * nothing on the real store, so the live site is unchanged.
 */
import { Info } from 'lucide-react';
import { useDemoMode } from '../hooks/useDemoMode';

/** The text visitors read: a demo, fictional data, nothing is processed, shipped, charged or emailed. */
export const DEMO_BANNER_TEXT = 'אתר הדגמה לפרויקט תיק עבודות — כל הנתונים פיקטיביים. '
  + 'הזמנות אינן מטופלות, לא נשלחים מוצרים, לא נגבה תשלום ולא יישלח מייל. '
  + 'המחירים באתר הם מחירי הדגמה בלבד ואינם הצעה מסחרית.';

/** Shows the demo banner, or nothing when this is not the demo. */
function DemoBanner() {
  const { demo } = useDemoMode();
  if (!demo) return null;

  return (
    <div className="demo-banner" role="note">
      <Info size={18} aria-hidden="true" />
      <p>{DEMO_BANNER_TEXT}</p>
    </div>
  );
}

export default DemoBanner;
