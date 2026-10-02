import { Truck, Star, Store, MessageCircle } from 'lucide-react';
import { ADDRESS, hoursSummary } from '../utils/storeInfo';

/*
 * האייקונים היו ארבעה SVG-ים מוטבעים והוחלפו ברכיבי Lucide המקבילים.
 * .feature-icon הוא עכשיו אריח 44px והאייקון שבתוכו הוא 22px, שנקבע כאן
 * ולא ב-CSS דרך מתיחת ה-svg.
 */
const FEATURES = [
  {
    Icon: Truck,
    title: 'משלוח לאזור המרכז',
    text: 'משלוחים לפתח תקווה, גני תקווה וקריית אונו — עד 2 ימי עסקים'
  },
  {
    Icon: Star,
    title: '30+ שנות ניסיון',
    text: 'מאז 1991 — מומחיות, ידע מקצועי ואמינות שאפשר לסמוך עליהם'
  },
  {
    Icon: Store,
    title: 'איסוף עצמי',
    text: `${ADDRESS.full} • ${hoursSummary()}`
  },
  {
    Icon: MessageCircle,
    title: 'ייעוץ טכני מקצועי',
    text: 'יחס אישי ואדיב — נשמח לעזור בכל שאלה טכנית'
  },
];

/** מציג את רצועת היתרונות. */
function FeaturesBanner() {
  return (
    /* .features-strip נמתחת לכל הרוחב ונושאת את שני קווי השיער;
       .features-banner היא הרשת שבפנים, מוגבלת לרוחב התוכן. */
    <section className="features-strip" aria-labelledby="features-title">
      {/* כותרת לקורא המסך בלבד: בלעדיה ארבע כותרות ה-h3 היו יושבות ישר
          מתחת ל-h1 של ה-Hero, בדילוג רמה. */}
      <h2 id="features-title" className="visually-hidden">למה לקנות אצלנו</h2>
      <div className="features-banner">
        {FEATURES.map(({ Icon, title, text }, i) => (
          <div key={i} className="feature-item">
            <div className="feature-icon">
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="feature-text">
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FeaturesBanner;