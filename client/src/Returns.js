function Returns() {
  return (
    <div className="page-container">
      <div className="returns-hero">
        <h1>מדיניות החזרים</h1>
        <p>אנחנו כאן לעזור — קראו את המדיניות שלנו</p>
      </div>

      <div className="returns-sections">

        {/* Main policy */}
        <section className="returns-card highlight">
          <div className="returns-card-icon">📅</div>
          <h2>חלון זמן להחזרה</h2>
          <p>
            ניתן להחזיר מוצרים תוך <strong>14 יום</strong> מיום קבלת ההזמנה או מיום הרכישה בחנות.
            לאחר 14 יום לא ניתן לקבל זיכוי או החזר כספי.
          </p>
        </section>

        {/* Accepted returns */}
        <section className="returns-card">
          <div className="returns-card-icon">✅</div>
          <h2>מתי מקבלים החזר?</h2>
          <div className="returns-list">
            <div className="returns-list-item green">
              <span className="returns-item-icon">🔧</span>
              <div>
                <strong>מוצר פגום או תקול</strong>
                <p>קיבלת מוצר שאינו תקין? נחליף אותו או נחזיר את הכסף במלואו — ללא עלות נוספת.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Not accepted */}
        <section className="returns-card">
          <div className="returns-card-icon">❌</div>
          <h2>מה לא ניתן להחזיר?</h2>
          <div className="returns-list">
            <div className="returns-list-item red">
              <span className="returns-item-icon">🔨</span>
              <div>
                <strong>כלי עבודה לא חשמליים</strong>
                <p>מסורים, פטישים, מפתחות ברגים וכלי עבודה ידניים אחרים — לא ניתן להחזיר לאחר פתיחה.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Refund method */}
        <section className="returns-card">
          <div className="returns-card-icon">💰</div>
          <h2>איך מקבלים את הכסף בחזרה?</h2>
          <div className="refund-options">
            <div className="refund-option">
              <span className="refund-icon">💳</span>
              <div>
                <strong>החזר לאמצעי התשלום המקורי</strong>
                <p>ההחזר יבוצע לכרטיס האשראי או לאמצעי שבו שילמת — בדרך כלל תוך 3-5 ימי עסקים.</p>
              </div>
            </div>
            <div className="refund-option">
              <span className="refund-icon">🎁</span>
              <div>
                <strong>זיכוי לקנייה הבאה</strong>
                <p>מעדיף זיכוי? נשמח להעניק שובר זיכוי בשווי המוצר לשימוש בקנייה הבאה בחנות.</p>
              </div>
            </div>
          </div>
          <p className="refund-note">* הבחירה בין החזר כספי לזיכוי היא של הלקוח.</p>
        </section>

        {/* How to return */}
        <section className="returns-card">
          <div className="returns-card-icon">📦</div>
          <h2>איך מבצעים החזרה?</h2>
          <div className="returns-steps">
            <div className="returns-step">
              <span className="step-number">1</span>
              <p>צור קשר איתנו בטלפון <a href="tel:039315750">03-9315750</a> או <a href="tel:0506735040">050-6735040</a></p>
            </div>
            <div className="returns-step">
              <span className="step-number">2</span>
              <p>ספר לנו מה הבעיה ונאשר את ההחזרה</p>
            </div>
            <div className="returns-step">
              <span className="step-number">3</span>
              <p>הבא את המוצר לחנות בבר כוכבא 52, פתח תקווה — עם חשבונית או אישור הזמנה</p>
            </div>
            <div className="returns-step">
              <span className="step-number">4</span>
              <p>נבצע את ההחזר הכספי או הזיכוי באותו מעמד</p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="returns-card returns-contact">
          <div className="returns-card-icon">📞</div>
          <h2>יש שאלה?</h2>
          <p>אנחנו כאן לעזור — אל תהסס לפנות אלינו</p>
          <div className="returns-contact-btns">
            <a href="tel:039315750" className="returns-phone-btn">03-9315750</a>
            <a href="tel:0506735040" className="returns-phone-btn secondary">050-6735040</a>
          </div>
        </section>

      </div>
    </div>
  );
}

export default Returns;