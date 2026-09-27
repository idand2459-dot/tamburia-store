/**
 * עמוד אודות — הסיפור, ארבעת היתרונות ושעות הפעילות.
 */
import { BookOpen, Headset, Handshake, Banknote, CalendarDays, Clock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { HoursTable } from './Contact';

const POINTS = [
  {
    Icon: Headset,
    title: 'עזרה טכנית מקצועית',
    text: 'יש שאלה? אנחנו כאן לעזור. אנרי ישמח לייעץ על כל בעיה טכנית',
  },
  {
    Icon: Handshake,
    title: 'יחס אישי ואדיב',
    text: 'כל לקוח מקבל תשומת לב אישית — אנחנו לא חנות אנונימית',
  },
  {
    Icon: Banknote,
    title: 'מחירים טובים',
    text: 'איכות גבוהה במחיר הוגן — בלי הפתעות ובלי מחירים מנופחים',
  },
  {
    Icon: CalendarDays,
    title: 'ניסיון של 30+ שנה',
    text: 'מאז 1991 אנחנו נותנים שירות לאלפי לקוחות מרוצים באזור',
  },
];

/** מציג את עמוד האודות. */
function About() {
  return (
    <div className="page-container">
      <PageHeader
        pill="אודות"
        title="טכניק טמבור"
        accent="מאז 1991"
        subtitle="המומחים שלך לצביעה, בנייה וכלי עבודה"
      />

      <div className="about-sections">

        {/* הסיפור */}
        <section className="about-card about-story">
          <span className="about-card-icon"><BookOpen size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="about-card-title">הסיפור שלנו</h2>
          <p>
            טכניק טמבור נוסדה בשנת 1991 על ידי אנרי דביר, איש מקצוע בעל ניסיון של למעלה משלושה עשורים בתחום.
            מה שהתחיל כחנות שכונתית קטנה בפתח תקווה הפך לאחד מהגורמים המקצועיים והאמינים ביותר באזור.
          </p>
          <p>
            לאורך השנים, אנרי צבר ידע מעמיק ומומחיות שהופכת כל ביקור בחנות לחוויה שונה — לא רק קנייה,
            אלא קבלת ייעוץ מקצועי אמיתי ממי שחי ונושם את התחום.
          </p>
        </section>

        {/* היתרונות — ארבעה כרטיסים, לא כרטיס אחד עם רשת בתוכו */}
        <section className="about-points">
          <div className="about-points-head">
            <span className="section-pill section-pill--light">היתרונות שלנו</span>
            <h2 className="about-points-title">
              למה לבחור <span className="about-points-accent">בנו?</span>
            </h2>
          </div>
          <div className="why-us-grid">
            {POINTS.map(({ Icon, title, text }) => (
              <div className="why-us-item" key={title}>
                <span className="why-icon"><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* שעות פעילות */}
        <section className="about-card about-hours">
          <span className="about-card-icon"><Clock size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="about-card-title">שעות פעילות</h2>
          <HoursTable />
        </section>

      </div>
    </div>
  );
}

export default About;
