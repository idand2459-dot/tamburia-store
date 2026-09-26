import { Truck, Star, Store, MessageCircle } from 'lucide-react';

/*
 * האייקונים היו ארבעה SVG-ים מוטבעים והוחלפו ברכיבי Lucide המקבילים.
 * .feature-icon קובע את המידה (48px) דרך svg { width/height: 100% },
 * ולכן אין כאן size — ה-24 שברירת המחדל נמתח על ידי ה-CSS.
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
    text: 'בר כוכבא 52, פתח תקווה • א׳-ה׳ 7:00-20:00 • ו׳ 7:00-15:00'
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
    <div className="features-banner">
      {FEATURES.map(({ Icon, title, text }, i) => (
        <div key={i} className="feature-item">
          <div className="feature-icon"><Icon aria-hidden="true" /></div>
          <div className="feature-text">
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FeaturesBanner;