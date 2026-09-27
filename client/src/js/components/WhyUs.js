import { Trophy, Handshake, Headset, Banknote, Quote } from 'lucide-react';
import Reveal, { stagger } from './Reveal';

/** מציג את המקטע. */
function WhyUs() {
  return (
    <section className="whyus-section">
      {/* .whyus-inner מרים את כל התוכן מעל שכבת הרקע של ::before */}
      <div className="whyus-inner">
        <div className="whyus-content">

          {/* טקסט ראשי */}
          <Reveal as="div" variant="up" className="whyus-text">
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
          </Reveal>

          {/* יתרונות */}
          <div className="whyus-points">
            {[
              {
                Icon: Trophy,
                title: 'ניסיון של 30+ שנה',
                text: 'אנרי דביר פתח את החנות ב-1991 ומאז צבר ידע מעמיק שקשה למצוא במקום אחר'
              },
              {
                Icon: Handshake,
                title: 'יחס אישי אמיתי',
                text: 'כל לקוח מקבל תשומת לב מלאה — לא מספר בתור, אלא שם ופנים'
              },
              {
                Icon: Headset,
                title: 'עזרה טכנית במקום',
                text: 'לא יודע מה לקנות? אנחנו נעזור לך לבחור בדיוק את מה שמתאים לפרויקט שלך'
              },
              {
                Icon: Banknote,
                title: 'מחירים שלא מפתיעים',
                text: 'מחיר הוגן, שקוף וללא הפתעות — כי אמון הוא הבסיס של כל עסק טוב'
              },
            ].map(({ Icon, title, text }, i) => (
              <Reveal as="div" variant="up" delay={stagger(i, 100)} key={i} className="whyus-point">
                <span className="whyus-point-icon">
                  <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>

        </div>

        {/* ציטוט */}
        <div className="whyus-quote">
          <Quote className="whyus-quote-mark" size={28} aria-hidden="true" />
          <p>"אנחנו לא מוכרים מוצרים — אנחנו עוזרים לאנשים לבנות את הבית שלהם"</p>
        </div>
      </div>
    </section>
  );
}

export default WhyUs;
