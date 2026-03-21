function Returns() {
  return (
    <div className="page-container">
      <div className="returns-hero">
        <h1>מדיניות החזרים</h1>
        <p>אנחנו כאן לעזור — קראו את המדיניות שלנו</p>
      </div>

      <div className="returns-sections">

        {/* הבהרה חשובה */}
        <section className="returns-card returns-disclaimer">
          <div className="returns-card-icon">⚠️</div>
          <h2>הבהרה חשובה</h2>
          <p>
            מדיניות זו מתייחסת לרכישות המבוצעות דרך האתר ובחנות הפיזית.
            המדיניות עומדת בהתאם ל<strong>חוק הגנת הצרכן התשמ"א-1981</strong> ותקנותיו.
            במקרה של סתירה בין מדיניות זו לבין הוראות החוק — הוראות החוק יגברו.
          </p>
        </section>

        {/* חלון זמן */}
        <section className="returns-card highlight">
          <div className="returns-card-icon">📅</div>
          <h2>חלון זמן להחזרה</h2>
          <p>
            ניתן להחזיר מוצרים תוך <strong>14 יום</strong> מיום קבלת ההזמנה או מיום הרכישה בחנות,
            בהתאם לחוק הגנת הצרכן.
            לאחר 14 יום לא ניתן לקבל זיכוי או החזר כספי, אלא במקרה של פגם.
          </p>
        </section>

        {/* מתי מקבלים החזר */}
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
            <div className="returns-list-item green">
              <span className="returns-item-icon">📦</span>
              <div>
                <strong>מוצר שלא נפתח ולא נעשה בו שימוש</strong>
                <p>מוצר באריזתו המקורית, ללא סימני שימוש — ניתן להחזרה תוך 14 יום.</p>
              </div>
            </div>
            <div className="returns-list-item green">
              <span className="returns-item-icon">🚚</span>
              <div>
                <strong>טעות בשליחה</strong>
                <p>קיבלת מוצר שגוי? נשלח את המוצר הנכון ונאסוף את השגוי על חשבוננו.</p>
              </div>
            </div>
          </div>
        </section>

        {/* מה לא ניתן להחזיר */}
        <section className="returns-card">
          <div className="returns-card-icon">❌</div>
          <h2>מה לא ניתן להחזיר?</h2>
          <div className="returns-list">
            <div className="returns-list-item red">
              <span className="returns-item-icon">🔨</span>
              <div>
                <strong>כלי עבודה ידניים לאחר פתיחה</strong>
                <p>מסורים, פטישים, מפתחות ברגים וכלי עבודה ידניים — לא ניתן להחזיר לאחר פתיחת האריזה.</p>
              </div>
            </div>
            <div className="returns-list-item red">
              <span className="returns-item-icon">🎨</span>
              <div>
                <strong>צבעים ותמהילים שנפתחו</strong>
                <p>צבע שנפתח, הורכב או נעשה בו שימוש — לא ניתן להחזרה.</p>
              </div>
            </div>
            <div className="returns-list-item red">
              <span className="returns-item-icon">🔩</span>
              <div>
                <strong>מוצרי אינסטלציה שהותקנו</strong>
                <p>ברזים, צינורות ואביזרי אינסטלציה שכבר הותקנו — לא ניתן להחזרה.</p>
              </div>
            </div>
            <div className="returns-list-item red">
              <span className="returns-item-icon">✂️</span>
              <div>
                <strong>מוצרים שנחתכו או עוצבו לפי הזמנה</strong>
                <p>כל מוצר שיוצר או נחתך בהתאמה אישית — לא ניתן להחזרה.</p>
              </div>
            </div>
            <div className="returns-list-item red">
              <span className="returns-item-icon">🧴</span>
              <div>
                <strong>חומרי הדבקה ואיטום שנפתחו</strong>
                <p>דבקים, סיליקון וחומרי איטום לאחר פתיחה — לא ניתן להחזרה מטעמי בריאות ובטיחות.</p>
              </div>
            </div>
          </div>
        </section>

        {/* תנאי ההחזרה */}
        <section className="returns-card">
          <div className="returns-card-icon">📋</div>
          <h2>תנאי ההחזרה</h2>
          <div className="returns-list">
            <div className="returns-list-item green">
              <span className="returns-item-icon">🧾</span>
              <div>
                <strong>חובה להציג חשבונית או אישור הזמנה</strong>
                <p>ללא הוכחת רכישה לא ניתן לבצע החזרה.</p>
              </div>
            </div>
            <div className="returns-list-item green">
              <span className="returns-item-icon">📦</span>
              <div>
                <strong>אריזה מקורית</strong>
                <p>יש להחזיר את המוצר עם כל האביזרים, הוראות ההפעלה והאריזה המקורית.</p>
              </div>
            </div>
            <div className="returns-list-item green">
              <span className="returns-item-icon">🏪</span>
              <div>
                <strong>החזרה לחנות בלבד</strong>
                <p>החזרת מוצרים מתבצעת פיזית בחנות בבר כוכבא 52, פתח תקווה בלבד.</p>
              </div>
            </div>
          </div>
        </section>

        {/* אחריות על מוצרים */}
        <section className="returns-card">
          <div className="returns-card-icon">🛡️</div>
          <h2>אחריות על מוצרים</h2>
          <p>
            המוצרים נמכרים עם אחריות היצרן בלבד. טכניק טמבור אינה אחראית לנזקים שנגרמו
            כתוצאה משימוש לא נכון, התקנה שגויה, או שינויים שבוצעו במוצר על ידי הלקוח.
            לבירורי אחריות יש לפנות ישירות ליצרן המוצר.
          </p>
        </section>

        {/* איך מבצעים החזרה */}
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
          <p className="refund-note">* הבחירה בין החזר כספי לזיכוי היא של הלקוח בלבד.</p>
        </section>

        {/* שלבי ההחזרה */}
        <section className="returns-card">
          <div className="returns-card-icon">📦</div>
          <h2>איך מבצעים החזרה?</h2>
          <div className="returns-steps">
            <div className="returns-step">
              <span className="step-number">1</span>
              <p>צור קשר איתנו בטלפון <a href="tel:039315750">03-9315750</a> או <a href="tel:0506735040">050-6735040</a> לפני הגעה לחנות</p>
            </div>
            <div className="returns-step">
              <span className="step-number">2</span>
              <p>ספר לנו מה הבעיה ונאשר את ההחזרה — <strong>ללא אישור מראש לא ניתן לבצע החזרה</strong></p>
            </div>
            <div className="returns-step">
              <span className="step-number">3</span>
              <p>הבא את המוצר לחנות בבר כוכבא 52, פתח תקווה — עם חשבונית או אישור הזמנה ואריזה מקורית</p>
            </div>
            <div className="returns-step">
              <span className="step-number">4</span>
              <p>נבצע את ההחזר הכספי או הזיכוי באותו מעמד</p>
            </div>
          </div>
        </section>

        {/* הגבלת אחריות */}
        <section className="returns-card returns-disclaimer">
          <div className="returns-card-icon">📜</div>
          <h2>הגבלת אחריות</h2>
          <p>
            טכניק טמבור לא תישא באחריות לכל נזק ישיר, עקיף, מקרי או תוצאתי שייגרם
            כתוצאה מהשימוש במוצרים הנמכרים. האחריות המקסימלית של החנות מוגבלת
            למחיר המוצר שנרכש בלבד. מדיניות זו אינה גורעת מזכויות הלקוח על פי דין.
          </p>
        </section>

        {/* יצירת קשר */}
        <section className="returns-card returns-contact">
          <div className="returns-card-icon">📞</div>
          <h2>יש שאלה?</h2>
          <p>אנחנו כאן לעזור — אל תהסס לפנות אלינו</p>
          <div className="returns-contact-btns">
            <a href="tel:039315750" className="returns-phone-btn">03-9315750</a>
            <a href="tel:0506735040" className="returns-phone-btn secondary">050-6735040</a>
          </div>
          <p className="returns-hours">א׳-ה׳ 7:00-20:00 | ו׳ 7:00-15:00</p>
        </section>

      </div>
    </div>
  );
}

export default Returns;