/**
 * עמוד צור קשר — תצלום החזית לצד שלושת כרטיסי המידע.
 */
import { MapPin, Phone, Clock, ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import storefrontPhoto from '../../assets/images/sections/contact-storefront-294.webp';
import {
  ADDRESS, PHONES, HOURS, hoursRangePadded, todayRow,
} from '../utils/storeInfo';

/** מציג את עמוד יצירת הקשר. */
function Contact() {
  /* נקרא פעם אחת לכל רינדור ולא לכל שורה: שלוש הקריאות היו יכולות
     ליפול משני צדי חצות ולסמן שני ימים. */
  const today = todayRow();

  return (
    <div className="page-container">
      <PageHeader
        pill="צור קשר"
        title="נשמח לשמוע"
        accent="ממך"
        subtitle="נשמח לשמוע ממך ולעזור בכל שאלה"
      />

      <div className="contact-layout">

        {/* תצלום החזית. התמונה קטנה (294px רוחב מקורי), ולכן ה-CSS
            תוחם את הלוח כדי שלא תימתח מעבר לגודלה האמיתי. */}
        <figure className="contact-photo-panel">
          {/* ה-div הוא מה שנושא את הפס האדום: figure עוטף גם את הכיתוב,
              ופס שמוצמד לתחתיתו היה יושב מתחת לטקסט ולא מתחת לתמונה. */}
          <div className="contact-photo-frame">
            <img
              className="contact-photo"
              src={storefrontPhoto}
              width="294"
              height="160"
              alt="חזית החנות טכניק טמבור ברחוב בר כוכבא 52 בפתח תקווה"
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption className="contact-photo-caption">
            כך תזהו אותנו — הסוכך האדום בבר כוכבא 52
          </figcaption>
        </figure>

        <div className="contact-cards">

          {/* כתובת */}
          <section className="contact-card">
            <span className="contact-card-icon"><MapPin size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <h2 className="contact-card-title">כתובת</h2>
            <p className="contact-card-text">{ADDRESS.street}<br />{ADDRESS.city}</p>
            <a
              href={ADDRESS.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-cta"
            >
              פתח במפות <ArrowLeft size={16} aria-hidden="true" />
            </a>
          </section>

          {/* טלפונים */}
          <section className="contact-card">
            <span className="contact-card-icon"><Phone size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <h2 className="contact-card-title">טלפונים</h2>
            <ul className="contact-phones">
              {[PHONES.store, PHONES.mobile].map((phone) => (
                <li key={phone.tel}>
                  <a href={`tel:${phone.tel}`} className="contact-phone">
                    <span className="contact-phone-label">{phone.label}</span>
                    <span className="contact-phone-number">{phone.display}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* שעות */}
          <section className="contact-card">
            <span className="contact-card-icon"><Clock size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <h2 className="contact-card-title">שעות פעילות</h2>
            <HoursTable today={today} />
          </section>

        </div>
      </div>
    </div>
  );
}

/**
 * טבלת השעות. יושבת כאן ולא בקובץ משלה כי עמוד האודות הוא הצרכן
 * השני והאחרון שלה, והיא קצרה מדי בשביל מודול.
 */
export function HoursTable({ today = todayRow() }) {
  return (
    <div className="hours-table">
      {HOURS.map((row) => {
        const isToday = row === today;
        return (
          <div
            key={row.id}
            className={`hours-row${row.closed ? ' is-closed' : ''}${isToday ? ' is-today' : ''}`}
          >
            <span className="hours-day">
              {row.spaced}
              {isToday && <span className="hours-today-mark">היום</span>}
            </span>
            <span className="hours-time">{hoursRangePadded(row)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default Contact;
