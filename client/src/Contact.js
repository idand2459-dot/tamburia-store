function Contact() {
  return (
    <div className="page-container">
      <div className="contact-hero">
        <h1>צור קשר</h1>
        <p>נשמח לשמוע ממך ולעזור בכל שאלה</p>
      </div>
 
      <div className="contact-cards">
 
        <div className="contact-card">
          <div className="contact-icon">📍</div>
          <h2>כתובת</h2>
          <p>בר כוכבא 52</p>
          <p>פתח תקווה</p>
          <a
            href="https://maps.google.com/?q=בר+כוכבא+52+פתח+תקווה"
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link-btn"
          >
            פתח במפות ←
          </a>
        </div>
 
        <div className="contact-card">
          <div className="contact-icon">📞</div>
          <h2>טלפונים</h2>
          <div className="phone-list">
            <div className="phone-item">
              <span className="phone-label">טלפון חנות</span>
              <a href="tel:039315750" className="phone-number">03-9315750</a>
            </div>
            <div className="phone-divider" />
            <div className="phone-item">
              <span className="phone-label">פלאפון אישי</span>
              <a href="tel:0506735040" className="phone-number">050-6735040</a>
            </div>
          </div>
        </div>
 
        <div className="contact-card">
          <div className="contact-icon">🕐</div>
          <h2>שעות פעילות</h2>
          <div className="contact-hours">
            <div className="contact-hours-row">
              <span>א׳ – ה׳</span>
              <span>07:00 – 20:00</span>
            </div>
            <div className="contact-hours-row">
              <span>ו׳</span>
              <span>07:00 – 15:00</span>
            </div>
            <div className="contact-hours-row closed">
              <span>שבת</span>
              <span>סגור</span>
            </div>
          </div>
        </div>
 
      </div>
    </div>
  );
}
 
export default Contact;