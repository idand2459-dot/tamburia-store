/**
 * תחתית האתר.
 *
 * הקישורים הם <Link> ולא כפתורים עם navigate: הם מובילים לכתובת, וכך
 * קורא מסך מכריז עליהם כקישורים, ואפשר לפתוח אותם בטאב חדש.
 *
 * הכותרות הן h2: הפוטר מופיע מתחת לכל עמוד, וב-404 או בהצהרת
 * הנגישות אין h2 לפניו — h4 שם היה דילוג של שלוש רמות.
 */
import { Link } from 'react-router-dom';
import { Wrench, MessageCircle, MapPin, Phone, Smartphone, Clock } from 'lucide-react';
import {
  ADDRESS, PHONES, WHATSAPP, whatsappUrl, OPEN_HOURS, hoursRangeDash,
} from '../utils/storeInfo';

/** מציג את תחתית האתר. */
function Footer() {
  const categories = [
    { id: 'painting', label: 'מוצרי צביעה' },
    { id: 'tools', label: 'כלי עבודה' },
    { id: 'plumbing', label: 'אינסטלציה' },
    { id: 'faucets', label: 'ברזים' },
    { id: 'locks', label: 'צילינדרים ומנעולים' },
    { id: 'adhesives', label: 'דבקים' },
    { id: 'cleaning', label: 'ניקיון' },
    { id: 'garden', label: 'גינה' },
    { id: 'bathroom', label: 'מוצרי אמבטיה' },
    { id: 'kitchen', label: 'מוצרי מטבח' },
    { id: 'electrical', label: 'מוצרי חשמל' },
    { id: 'home', label: 'בית' },
  ];

  const pages = [
    { key: 'home', path: '/', label: 'דף הבית' },
    { key: 'about', path: '/about', label: 'אודות' },
    { key: 'contact', path: '/contact', label: 'צור קשר' },
    { key: 'returns', path: '/returns', label: 'מדיניות החזרים' },
    { key: 'accessibility', path: '/accessibility', label: 'הצהרת נגישות' },
  ];

  return (
    <footer className="site-footer">
      <div className="footer-main">

        {/* עמוד 1 — אודות */}
        <div className="footer-col">
          <p className="footer-logo"><Wrench size={22} aria-hidden="true" /> טכניק טמבור</p>
          <p className="footer-about-text">
            חנות מקצועית לכלי עבודה, חומרי בניין וצבעים בפתח תקווה.<br />
            מאז 1991 — יחס אישי, עזרה טכנית ומחירים טובים.
          </p>
          <a
            href={whatsappUrl(WHATSAPP.defaultMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-whatsapp-btn"
          >
            <MessageCircle size={18} aria-hidden="true" /> שלח הודעה בוואטסאפ
            <span className="visually-hidden"> (נפתח בחלון חדש)</span>
          </a>
        </div>

        {/* עמוד 2 — מפת האתר */}
        <div className="footer-col">
          <h2 className="footer-col-title">מפת האתר</h2>
          <ul className="footer-links">
            {pages.map(p => (
              <li key={p.key}>
                <Link to={p.path} className="footer-link">{p.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* עמוד 3 — קטגוריות */}
        <div className="footer-col">
          <h2 className="footer-col-title">קטגוריות</h2>
          <ul className="footer-links footer-links-2col">
            {categories.map(cat => (
              <li key={cat.id}>
                <Link to={`/category/${cat.id}`} className="footer-link">{cat.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* עמוד 4 — צור קשר */}
        <div className="footer-col">
          <h2 className="footer-col-title">צור קשר</h2>
          <ul className="footer-contact-list">
            <li>
              <span className="footer-contact-icon"><MapPin size={16} aria-hidden="true" /></span>
              <span>{ADDRESS.full}</span>
            </li>
            <li>
              <span className="footer-contact-icon"><Phone size={16} aria-hidden="true" /></span>
              <a href={`tel:${PHONES.store.tel}`} className="footer-contact-link">{PHONES.store.display}</a>
            </li>
            <li>
              <span className="footer-contact-icon"><Smartphone size={16} aria-hidden="true" /></span>
              <a href={`tel:${PHONES.mobile.tel}`} className="footer-contact-link">{PHONES.mobile.display}</a>
            </li>
            {OPEN_HOURS.map((row) => (
              <li key={row.id}>
                <span className="footer-contact-icon"><Clock size={16} aria-hidden="true" /></span>
                <span>{row.short}: {hoursRangeDash(row)}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* תחתית */}
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} טכניק טמבור — כל הזכויות שמורות</span>
        <span className="footer-bottom-sep" aria-hidden="true">|</span>
        <Link to="/returns" className="footer-bottom-link">מדיניות החזרים</Link>
        <span className="footer-bottom-sep" aria-hidden="true">|</span>
        <Link to="/accessibility" className="footer-bottom-link">הצהרת נגישות</Link>
      </div>
    </footer>
  );
}

export default Footer;