/**
 * הצהרת הנגישות: /accessibility
 *
 * הסעיפים הם אלה שתקנה 35 לתקנות שוויון זכויות לאנשים עם מוגבלות
 * (התאמות נגישות לשירות), התשע"ג-2013 מבקשת: התקן ורמת ההתאמה, מה
 * הונגש, מה עדיין לא, הסדרי הנגישות בחנות עצמה, ואיך פונים לרכז
 * הנגישות.
 *
 * רשימת ההתאמות מתארת את מה שבאמת קיים באתר, ולא רשימה גנרית: כל
 * שורה בה נבדקת ב-npm run a11y או שנעשתה בקוד. מי שמוסיף או מוריד
 * התאמה — מעדכן גם כאן.
 *
 * FILL_IN למטה הם הפרטים שרק בעל החנות יכול לתת. כל ערך שהופך ל-null
 * מוצג באתר כתיבה צהובה בולטת "[למילוי]", כדי שחוסר לא יעבור בשקט.
 *
 * הסדרי הנגישות בחנות כתובים כמו שהם, כולל מה שאינו נגיש — המדרגה,
 * המעברים הצרים, היעדר חניית נכים ושירותים. הצהרה שמשאירה אותם בחוץ
 * שולחת אדם בכיסא גלגלים לחנות שהוא לא יוכל להיכנס אליה.
 */
import {
  Accessibility as AccessibilityIcon, ListChecks, AlertTriangle, Store, UserRound, CalendarDays,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { ADDRESS, PHONES } from '../utils/storeInfo';

/** קישור טלפון של החנות, בכיוון שמאל-לימין כדי שהמספר לא יתהפך. */
function Tel({ phone }) {
  return <a href={`tel:${phone.tel}`} dir="ltr">{phone.display}</a>;
}

const FILL_IN = {
  coordinatorName: 'אנרי דביר',
  coordinatorPhone: '050-6735040',
  coordinatorEmail: 'idand2459@gmail.com',
  responseTime: 'עד 7 ימי עסקים',
  lastUpdated: '02.10.2026',
  // הסדרי הנגישות בחנות, בשלושה נושאים. null בכל אחד מהם מציג placeholder.
  storeArrival: [
    'החניה היא חניה ברחוב, צמודה לחנות (מדרכה בסימון אפור). אין חניית נכים מסומנת בסמוך לחנות.',
    'תחנת האוטובוס הקרובה נמצאת במרחק של כ-200 עד 300 מטר מהחנות.',
  ],
  storePhysical: [
    'בכניסה לחנות יש מדרגה אחת, ואין רמפה.',
    'החנות קטנה והמעברים בה צרים, ולכן היא אינה נגישה לכיסא גלגלים מבפנים.',
    <>
      לקוחות שמתקשים להיכנס מקבלים שירות מלא מחוץ לחנות: הצוות מביא את המוצרים
      החוצה, נותן ייעוץ ומבצע את התשלום מחוץ לחנות. אפשר להתקשר מראש
      ל-<Tel phone={PHONES.store} /> או ל-<Tel phone={PHONES.mobile} />, כדי שנהיה מוכנים.
    </>,
    'כלבי נחייה מוזמנים להיכנס.',
    'אין בחנות שירותים ללקוחות.',
  ],
  storeRemote: [
    'אפשר להזמין דרך האתר, בטלפון או בוואטסאפ, בלי להגיע לחנות.',
    'את ההזמנה אפשר לקבל במשלוח לפתח תקווה, גני תקווה וקריית אונו, או לאסוף בשירות מחוץ לחנות.',
  ],
};

const STORE_SECTIONS = [
  { key: 'arrival', title: 'הגעה לחנות', items: FILL_IN.storeArrival, missing: 'חניה ותחבורה ציבורית' },
  { key: 'physical', title: 'נגישות פיזית ושירות במקום', items: FILL_IN.storePhysical, missing: 'כניסה, מעברים, שירותים' },
  { key: 'remote', title: 'שירות מרחוק', items: FILL_IN.storeRemote, missing: 'הזמנה ומשלוח' },
];

const ADJUSTMENTS = [
  'קישור "דלג לתוכן" בתחילת כל עמוד, שמוביל ישירות לתוכן העיקרי.',
  'אפשר להפעיל את כל האתר באמצעות המקלדת בלבד, עם סימון ברור של הרכיב שבפוקוס.',
  'החלונות הנפתחים (עגלת הקניות, ההזמנות שלי, המועדפים, התפריט והחיפוש) מכניסים אליהם את הפוקוס, נסגרים במקש Escape, ומחזירים את הפוקוס לכפתור שפתח אותם.',
  'לכל עמוד כותרת ייחודית, כותרת ראשית אחת (H1) והיררכיית כותרות תקינה, ואזורי ציון (כותרת עליונה, ניווט, תוכן עיקרי ותחתית) שמאפשרים לקורא מסך לדלג ביניהם.',
  'שפת האתר מוגדרת כעברית וכיוון הכתיבה מימין לשמאל, כך שקוראי מסך מקריאים אותו נכון.',
  'ניגודיות הצבעים בין טקסט לרקע עומדת ביחס של 4.5:1 לפחות, ורכיבי שליטה נראים ביחס של 3:1 לפחות.',
  'אפשר להגדיל את התצוגה עד 200% בלי לאבד תוכן ובלי גלילה אופקית, והאתר מותאם לטלפונים ולטאבלטים.',
  'לתמונות שנושאות מידע יש טקסט חלופי; תמונות קישוטיות מוסתרות מקוראי מסך.',
  'בטפסים לכל שדה יש תווית, שדות החובה מסומנים, והודעות השגיאה מוצגות ליד השדה ומוקראות על ידי קורא המסך.',
  'הודעות מצב, כמו מספר תוצאות החיפוש או מספר המוצרים אחרי סינון, מוקראות בלי להזיז את הפוקוס.',
  'תוכן שזז מעצמו (רצועת ההודעות העליונה וקרוסלת הביקורות) ניתן לעצירה בכפתור, ונעצר מעצמו כשמערכת ההפעלה מוגדרת ל"הפחתת תנועה".',
  'דירוג בכוכבים מוקרא כטקסט ("דירוג 4 מתוך 5"), ובטופס הביקורת אפשר לבחור דירוג גם מהמקלדת.',
];

const LIMITATIONS = [
  'המפה בעמוד "צור קשר" מוטמעת מ-Google Maps, ונגישותה תלויה ב-Google. הכתובת המלאה מופיעה בעמוד גם כטקסט, לצד קישור לניווט.',
  'חלק מתמונות המוצרים הן להמחשה בלבד, וזה מצוין בעמוד המוצר. המידע המחייב על המוצר הוא התיאור הכתוב.',
  'הקישורים לוואטסאפ ול-Google Maps מובילים לשירותים חיצוניים, שאינם בשליטתנו.',
  'הבדיקות נעשו בכלי בדיקה אוטומטיים (axe-core) ובבדיקה ידנית במקלדת ובהגדלת תצוגה, בדפדפן Chrome במחשב ובטלפון.',
];

/** ערך שעוד לא מולא: תיבה צהובה שאי אפשר לפספס. */
function Placeholder({ children }) {
  return <mark className="a11y-placeholder">[למילוי: {children}]</mark>;
}

/** מציג ערך, או placeholder בולט כשהוא עוד לא מולא. */
function Filled({ value, label }) {
  return value ? <>{value}</> : <Placeholder>{label}</Placeholder>;
}

/** מציג את הצהרת הנגישות. */
function Accessibility() {
  usePageTitle('הצהרת נגישות');

  return (
    <div className="page-container">
      <PageHeader
        pill="נגישות"
        title="הצהרת"
        accent="נגישות"
        subtitle="אתר שכל אחד יכול להשתמש בו"
      />

      <div className="a11y-sections">

        <section className="a11y-card">
          <span className="a11y-card-icon"><AccessibilityIcon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">המחויבות שלנו</h2>
          <p className="a11y-text">
            טכניק טמבור רואה חשיבות רבה במתן שירות שוויוני לכל הלקוחות, ובכלל זה
            לאנשים עם מוגבלות. השקענו בהנגשת האתר כדי שכל אחד יוכל לגלוש בו,
            לחפש מוצרים ולהזמין בקלות ובעצמאות.
          </p>
        </section>

        <section className="a11y-card">
          <span className="a11y-card-icon"><ListChecks size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">התקן ורמת ההתאמה</h2>
          <p className="a11y-text">
            האתר הונגש בהתאם ל<strong>תקן הישראלי ת"י 5568</strong> "קווים מנחים לנגישות
            תכנים באינטרנט", ברמת <strong>AA</strong>, ובהתאם לתקנות שוויון זכויות לאנשים
            עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013. התקן מבוסס על הנחיות
            WCAG של ארגון W3C, והאתר נבדק מול <strong>WCAG 2.1 ברמה AA</strong>.
          </p>
          <p className="a11y-text">
            הנגישות מובנית בקוד האתר עצמו, ולא באמצעות תוסף נגישות חיצוני. כך היא
            עובדת עם הכלים שכבר יש לכם: קוראי מסך, הגדלת התצוגה בדפדפן (Ctrl ו-+),
            והגדרות הניגודיות והתנועה של מערכת ההפעלה.
          </p>
        </section>

        <section className="a11y-card">
          <span className="a11y-card-icon"><ListChecks size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">ההתאמות שבוצעו באתר</h2>
          <ul className="a11y-list">
            {ADJUSTMENTS.map((text) => <li key={text}>{text}</li>)}
          </ul>
        </section>

        <section className="a11y-card">
          <span className="a11y-card-icon"><AlertTriangle size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">מגבלות ידועות</h2>
          <p className="a11y-text">
            אנחנו ממשיכים לשפר את נגישות האתר. ייתכן שעדיין יימצאו בו רכיבים שאינם
            נגישים במלואם. אלה המגבלות הידועות לנו:
          </p>
          <ul className="a11y-list">
            {LIMITATIONS.map((text) => <li key={text}>{text}</li>)}
          </ul>
          <p className="a11y-text">
            נתקלתם ברכיב שאינו נגיש? נשמח לדעת. פנו לרכז הנגישות (הפרטים למטה).
            זמן המענה לפניות בנושא נגישות: <Filled value={FILL_IN.responseTime} label="זמן מענה" />.
          </p>
        </section>

        <section className="a11y-card">
          <span className="a11y-card-icon"><Store size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">הסדרי נגישות בחנות</h2>
          <p className="a11y-text">החנות נמצאת ברחוב {ADDRESS.full}.</p>
          {STORE_SECTIONS.map(({ key, title, items, missing }) => (
            <div key={key} className="a11y-subsection">
              <h3 className="a11y-subtitle">{title}</h3>
              {items ? (
                <ul className="a11y-list">
                  {/* מפתח לפי מיקום: חלק מהפריטים הם JSX ולא מחרוזת */}
                  {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              ) : (
                <p className="a11y-text"><Placeholder>{missing}</Placeholder></p>
              )}
            </div>
          ))}
        </section>

        <section className="a11y-card a11y-contact">
          <span className="a11y-card-icon"><UserRound size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">פרטי רכז הנגישות</h2>
          <p className="a11y-text">
            לשאלות, לבקשות ולהערות בנושא נגישות, אפשר לפנות לרכז הנגישות שלנו:
          </p>
          <dl className="a11y-contact-list">
            <div>
              <dt>שם</dt>
              <dd><Filled value={FILL_IN.coordinatorName} label="שם רכז הנגישות" /></dd>
            </div>
            <div>
              <dt>טלפון</dt>
              <dd>
                {FILL_IN.coordinatorPhone
                  ? <a href={`tel:${FILL_IN.coordinatorPhone.replace(/\D/g, '')}`} dir="ltr">{FILL_IN.coordinatorPhone}</a>
                  : <Placeholder>טלפון</Placeholder>}
              </dd>
            </div>
            <div>
              <dt>דוא"ל</dt>
              <dd>
                {FILL_IN.coordinatorEmail
                  ? <a href={`mailto:${FILL_IN.coordinatorEmail}`} dir="ltr">{FILL_IN.coordinatorEmail}</a>
                  : <Placeholder>כתובת דוא"ל</Placeholder>}
              </dd>
            </div>
            <div>
              <dt>זמן מענה</dt>
              <dd><Filled value={FILL_IN.responseTime} label="זמן מענה לפניות" /></dd>
            </div>
          </dl>
        </section>

        <section className="a11y-card">
          <span className="a11y-card-icon"><CalendarDays size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="a11y-card-title">עדכון ההצהרה</h2>
          <p className="a11y-text">
            הצהרה זו עודכנה לאחרונה ב-<Filled value={FILL_IN.lastUpdated} label="תאריך עדכון" />.
          </p>
        </section>

      </div>
    </div>
  );
}

export default Accessibility;
