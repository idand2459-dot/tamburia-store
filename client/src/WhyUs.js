function WhyUs() {
  return (
    <div className="whyus-section">
      <div className="whyus-content">

        {/* טקסט ראשי */}
        <div className="whyus-text">
          <span className="whyus-tag">למה טכניק טמבור?</span>
          <h2 className="whyus-title">
            לא סתם חנות —<br />
            <span className="whyus-title-accent">שותף לכל פרויקט</span>
          </h2>
          <p className="whyus-desc">
            מאז 1991, אנרי דביר ומשפחתו מלווים אלפי לקוחות בפתח תקווה והסביבה.
            אצלנו תקבל לא רק מוצר — תקבל ידע, ניסיון של עשרות שנים, וייעוץ טכני
            שיחסוך לך זמן, כסף וכאבי ראש.
          </p>
          <p className="whyus-desc">
            אנחנו מאמינים שכל לקוח ראוי ליחס אישי, מחיר הוגן, ותשובה ישרה לכל שאלה.
            זו הסיבה שאנשים חוזרים אלינו שוב ושוב — לא כי אין להם ברירה,
            אלא כי הם יודעים שאצלנו הם בידיים טובות.
          </p>
        </div>

        {/* יתרונות */}
        <div className="whyus-points">
          {[
            {
              icon: '🏆',
              title: 'ניסיון של 30+ שנה',
              text: 'אנרי דביר פתח את החנות ב-1991 ומאז צבר ידע מעמיק שקשה למצוא במקום אחר'
            },
            {
              icon: '🤝',
              title: 'יחס אישי אמיתי',
              text: 'כל לקוח מקבל תשומת לב מלאה — לא מספר בתור, אלא שם ופנים'
            },
            {
              icon: '🔧',
              title: 'עזרה טכנית במקום',
              text: 'לא יודע מה לקנות? אנחנו נעזור לך לבחור בדיוק את מה שמתאים לפרויקט שלך'
            },
            {
              icon: '💰',
              title: 'מחירים שלא מפתיעים',
              text: 'מחיר הוגן, שקוף וללא הפתעות — כי אמון הוא הבסיס של כל עסק טוב'
            },
          ].map((point, i) => (
            <div key={i} className="whyus-point">
              <span className="whyus-point-icon">{point.icon}</span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.text}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ציטוט */}
      <div className="whyus-quote">
        <p>"אנחנו לא מוכרים מוצרים — אנחנו עוזרים לאנשים לבנות את הבית שלהם"</p>
        
      </div>
    </div>
  );
}

export default WhyUs;