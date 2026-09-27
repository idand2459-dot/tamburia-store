import { MapPin, Phone, Clock } from 'lucide-react';
import {
  ADDRESS, PHONES, HOURS, hoursRangePadded,
} from '../utils/storeInfo';

/** מציג את עמוד יצירת הקשר. */
function Contact() {
  return (
    <div className="page-container">
      <div className="contact-hero">
        <h1>צור קשר</h1>
        <p>נשמח לשמוע ממך ולעזור בכל שאלה</p>
      </div>
 
      <div className="contact-cards">
 
        <div className="contact-card">
          <div className="contact-icon"><MapPin size={32} aria-hidden="true" /></div>
          <h2>כתובת</h2>
          <p>{ADDRESS.street}</p>
          <p>{ADDRESS.city}</p>
          <a
            href={ADDRESS.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link-btn"
          >
            פתח במפות ←
          </a>
        </div>
 
        <div className="contact-card">
          <div className="contact-icon"><Phone size={32} aria-hidden="true" /></div>
          <h2>טלפונים</h2>
          <div className="phone-list">
            <div className="phone-item">
              <span className="phone-label">{PHONES.store.label}</span>
              <a href={`tel:${PHONES.store.tel}`} className="phone-number">{PHONES.store.display}</a>
            </div>
            <div className="phone-divider" />
            <div className="phone-item">
              <span className="phone-label">{PHONES.mobile.label}</span>
              <a href={`tel:${PHONES.mobile.tel}`} className="phone-number">{PHONES.mobile.display}</a>
            </div>
          </div>
        </div>
 
        <div className="contact-card">
          <div className="contact-icon"><Clock size={32} aria-hidden="true" /></div>
          <h2>שעות פעילות</h2>
          <div className="contact-hours">
            {HOURS.map((row) => (
              <div key={row.id} className={`contact-hours-row${row.closed ? ' closed' : ''}`}>
                <span>{row.spaced}</span>
                <span>{hoursRangePadded(row)}</span>
              </div>
            ))}
          </div>
        </div>
 
      </div>
    </div>
  );
}
 
export default Contact;