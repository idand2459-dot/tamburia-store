import { useState } from 'react';

const FAQS = [
  {
    q: 'איך מבצעים הזמנה?',
    a: 'פשוט מאוד! בחרו קטגוריה, הוסיפו מוצרים לעגלה, ומלאו פרטים. ההזמנה תגיע אליכם תוך 2 ימי עסקים — או תוכלו לאסוף מהחנות באותו יום.'
  },
  {
    q: 'באילו אזורים אתם מספקים משלוח?',
    a: 'אנחנו מספקים משלוח לפתח תקווה, גני תקווה וקריית אונו בלבד — בעלות של ₪20. ללקוחות מחוץ לאזורים אלה ניתן לאסוף מהחנות בבר כוכבא 52, פתח תקווה.'
  },
  {
    q: 'כמה זמן לוקח המשלוח?',
    a: 'משלוח מגיע עד 2 ימי עסקים. איסוף עצמי זמין באותו יום בשעות הפעילות: א׳-ה׳ 7:00-20:00, ו׳ 7:00-15:00.'
  },
  {
    q: 'איך אני משלם?',
    a: 'כרגע התשלום מתבצע במזומן או בכרטיס אשראי בעת האיסוף, או בעת קבלת המשלוח. בקרוב נוסיף אפשרות לתשלום מקוון.'
  },
  {
    q: 'מה מדיניות ההחזרות?',
    a: 'ניתן להחזיר מוצרים שלא נפתחו תוך 14 יום מיום הרכישה. מוצר פגום — נחליף או נזכה במלואו. לפרטים נוספים ראו את דף מדיניות ההחזרים.'
  },
  {
    q: 'האם יש לכם חנות פיזית?',
    a: 'כן! אנחנו פועלים מאז 1991. החנות נמצאת ברחוב בר כוכבא 52, פתח תקווה. מוזמנים לבקר אותנו ולקבל ייעוץ אישי מאנרי.'
  },
  {
    q: 'איך יוצרים קשר?',
    a: 'ניתן להתקשר ל-03-9315750 או 050-6735040, לשלוח וואטסאפ, או להגיע לחנות. אנחנו זמינים א׳-ה׳ 7:00-20:00, ו׳ 7:00-15:00.'
  },
  {
    q: 'האם המחירים כוללים מע"מ?',
    a: 'כן, כל המחירים המוצגים באתר כוללים מע"מ. אין הפתעות בתשלום.'
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  function toggle(i) {
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <section className="faq-section">
      <div className="faq-content">
        <div className="faq-header">
          <span className="faq-tag">שאלות נפוצות</span>
          <h2 className="faq-title">יש לכם שאלות? יש לנו תשובות 💬</h2>
          <p className="faq-subtitle">כל מה שרציתם לדעת על טכניק טמבור</p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, i) => (
            <div key={i} className={`faq-item ${openIndex === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => toggle(i)}>
                <span>{faq.q}</span>
                <span className="faq-arrow">{openIndex === i ? '−' : '+'}</span>
              </button>
              {openIndex === i && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="faq-contact">
          <p>לא מצאתם תשובה? אנחנו כאן בשבילכם</p>
          <div className="faq-contact-btns">
            <a href="tel:039315750" className="faq-btn">📞 03-9315750</a>
            <a href="https://wa.me/972506735040" target="_blank" rel="noopener noreferrer" className="faq-btn whatsapp">💬 וואטסאפ</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FAQ;