/**
 * עמוד שאלות נפוצות עם תשובות מתקפלות.
 */
import { useState } from 'react';
import { MessageCircle, Phone, Plus } from 'lucide-react';
import { ADDRESS, PHONES, whatsappUrl, hoursSummary } from '../utils/storeInfo';

const FAQS = [
  {
    q: 'איך מבצעים הזמנה?',
    a: 'פשוט מאוד! בחרו קטגוריה, הוסיפו מוצרים לעגלה, ומלאו פרטים. ההזמנה תגיע אליכם תוך 2 ימי עסקים — או תוכלו לאסוף מהחנות באותו יום.'
  },
  {
    q: 'באילו אזורים אתם מספקים משלוח?',
    a: `אנחנו מספקים משלוח לפתח תקווה, גני תקווה וקריית אונו בלבד — בעלות של ₪20. ללקוחות מחוץ לאזורים אלה ניתן לאסוף מהחנות ב${ADDRESS.full}.`
  },
  {
    q: 'כמה זמן לוקח המשלוח?',
    a: `משלוח מגיע עד 2 ימי עסקים. איסוף עצמי זמין באותו יום בשעות הפעילות: ${hoursSummary(', ')}.`
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
    a: `כן! אנחנו פועלים מאז 1991. החנות נמצאת ברחוב ${ADDRESS.full}. מוזמנים לבקר אותנו ולקבל ייעוץ אישי מאנרי.`
  },
  {
    q: 'איך יוצרים קשר?',
    a: `ניתן להתקשר ל-${PHONES.store.display} או ${PHONES.mobile.display}, לשלוח וואטסאפ, או להגיע לחנות. אנחנו זמינים ${hoursSummary(', ')}.`
  },
  {
    q: 'האם המחירים כוללים מע"מ?',
    a: 'כן, כל המחירים המוצגים באתר כוללים מע"מ. אין הפתעות בתשלום.'
  },
];

/** מציג את עמוד השאלות הנפוצות. */
function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  /** פותח או סוגר שאלה. */
  function toggle(i) {
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <section className="faq-section">
      <div className="faq-content">
        <div className="faq-header">
          <span className="section-pill section-pill--light">שאלות נפוצות</span>
          <h2 className="faq-title">יש לכם שאלות? יש לנו תשובות</h2>
          <p className="faq-subtitle">כל מה שרציתם לדעת על טכניק טמבור</p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div key={i} className={`faq-item ${open ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                >
                  <span>{faq.q}</span>
                  {/* אייקון אחד לשני המצבים: ה-CSS מסובב אותו 45° ל-× כשהשורה
                      פתוחה. החלפת אייקון באייקון הייתה מבטלת את המעבר. */}
                  <span className="faq-arrow"><Plus size={16} aria-hidden="true" /></span>
                </button>
                {/* התשובה נשארת ב-DOM גם כשהשורה סגורה: אנימציית הגובה
                    ב-CSS צריכה שני מצבים של אותו אלמנט, ואלמנט שנולד עכשיו
                    קופץ לגובהו בלי מעבר. */}
                <div
                  className="faq-answer-wrap"
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                >
                  <div className="faq-answer">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="faq-contact">
          <p>לא מצאתם תשובה? אנחנו כאן בשבילכם</p>
          <div className="faq-contact-btns">
            <a href={`tel:${PHONES.store.tel}`} className="faq-btn"><Phone size={18} aria-hidden="true" /> {PHONES.store.display}</a>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="faq-btn whatsapp"><MessageCircle size={18} aria-hidden="true" /> וואטסאפ</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FAQ;