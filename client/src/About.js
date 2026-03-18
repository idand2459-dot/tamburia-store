function About() {
  return (
    <div className="page-container">
      {/* Hero */}
      <div className="about-hero">
        <div className="about-hero-content">
          <h1>טכניק טמבור</h1>
          <p>מאז 1991 — המומחים שלך לצביעה, בנייה וכלי עבודה</p>
        </div>
      </div>
 
      <div className="about-sections">
 
        {/* Story */}
        <section className="about-card">
          <div className="about-card-icon">📖</div>
          <h2>הסיפור שלנו</h2>
          <p>
            טכניק טמבור נוסדה בשנת 1991 על ידי אנרי דביר, איש מקצוע בעל ניסיון של למעלה משלושה עשורים בתחום.
            מה שהתחיל כחנות שכונתית קטנה בפתח תקווה הפך לאחד מהגורמים המקצועיים והאמינים ביותר באזור.
          </p>
          <p>
            לאורך השנים, אנרי צבר ידע מעמיק ומומחיות שהופכת כל ביקור בחנות לחוויה שונה — לא רק קנייה,
            אלא קבלת ייעוץ מקצועי אמיתי ממי שחי ונושם את התחום.
          </p>
        </section>
 
        {/* Why us */}
        <section className="about-card">
          <div className="about-card-icon">⭐</div>
          <h2>למה לבחור בנו?</h2>
          <div className="why-us-grid">
            <div className="why-us-item">
              <span className="why-icon">🔧</span>
              <h3>עזרה טכנית מקצועית</h3>
              <p>יש שאלה? אנחנו כאן לעזור. אנרי ישמח לייעץ על כל בעיה טכנית</p>
            </div>
            <div className="why-us-item">
              <span className="why-icon">🤝</span>
              <h3>יחס אישי ואדיב</h3>
              <p>כל לקוח מקבל תשומת לב אישית — אנחנו לא חנות אנונימית</p>
            </div>
            <div className="why-us-item">
              <span className="why-icon">💰</span>
              <h3>מחירים טובים</h3>
              <p>איכות גבוהה במחיר הוגן — בלי הפתעות ובלי מחירים מנופחים</p>
            </div>
            <div className="why-us-item">
              <span className="why-icon">📅</span>
              <h3>ניסיון של 30+ שנה</h3>
              <p>מאז 1991 אנחנו נותנים שירות לאלפי לקוחות מרוצים באזור</p>
            </div>
          </div>
        </section>
 
        {/* Hours */}
        <section className="about-card">
          <div className="about-card-icon">🕐</div>
          <h2>שעות פעילות</h2>
          <div className="hours-table">
            <div className="hours-row">
              <span className="hours-day">ראשון – חמישי</span>
              <span className="hours-time">07:00 – 20:00</span>
            </div>
            <div className="hours-row">
              <span className="hours-day">שישי</span>
              <span className="hours-time">07:00 – 15:00</span>
            </div>
            <div className="hours-row closed">
              <span className="hours-day">שבת</span>
              <span className="hours-time">סגור</span>
            </div>
          </div>
        </section>
 
      </div>
    </div>
  );
}
 
export default About;