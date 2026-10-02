/**
 * עמוד מדיניות ההחזרים — עמוד הטקסט הארוך באתר.
 *
 * הרשימות יושבות במערכים ולא ב-JSX חוזר: שלוש רשימות של פריט-עם-אייקון
 * שנכתבו ידנית שלוש פעמים היו כאן, וכל תיקון ניסוח דרש למצוא את כולן.
 *
 * אין ירוק בעמוד. "מה כן" מסומן ב-Check בגוון נייבי/סגול ו"מה לא"
 * ב-X אדום — הצמד ירוק/אדום קשה לקריאה לחלק מהאנשים, והאדום כאן
 * ממילא הוא צבע המותג ולא צבע של שגיאה.
 */
import {
  AlertTriangle, CalendarDays, CheckCircle, XCircle, Check, X,
  Shield, Coins, CreditCard, Gift, ScrollText, Phone, Package, ClipboardList,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { usePageTitle } from '../hooks/usePageTitle';
import { ADDRESS, PHONES, hoursSummary } from '../utils/storeInfo';

const REFUND_CASES = [
  {
    title: 'מוצר פגום או תקול',
    text: 'קיבלת מוצר שאינו תקין? נחליף אותו או נחזיר את הכסף במלואו — ללא עלות נוספת.',
  },
  {
    title: 'מוצר שלא נפתח ולא נעשה בו שימוש',
    text: 'מוצר באריזתו המקורית, ללא סימני שימוש — ניתן להחזרה תוך 14 יום.',
  },
  {
    title: 'טעות בשליחה',
    text: 'קיבלת מוצר שגוי? נשלח את המוצר הנכון ונאסוף את השגוי על חשבוננו.',
  },
];

const NO_RETURN = [
  {
    title: 'כלי עבודה ידניים לאחר פתיחה',
    text: 'מסורים, פטישים, מפתחות ברגים וכלי עבודה ידניים — לא ניתן להחזיר לאחר פתיחת האריזה.',
  },
  {
    title: 'צבעים ותמהילים שנפתחו',
    text: 'צבע שנפתח, הורכב או נעשה בו שימוש — לא ניתן להחזרה.',
  },
  {
    title: 'מוצרי אינסטלציה שהותקנו',
    text: 'ברזים, צינורות ואביזרי אינסטלציה שכבר הותקנו — לא ניתן להחזרה.',
  },
  {
    title: 'מוצרים שנחתכו או עוצבו לפי הזמנה',
    text: 'כל מוצר שיוצר או נחתך בהתאמה אישית — לא ניתן להחזרה.',
  },
  {
    title: 'חומרי הדבקה ואיטום שנפתחו',
    text: 'דבקים, סיליקון וחומרי איטום לאחר פתיחה — לא ניתן להחזרה מטעמי בריאות ובטיחות.',
  },
];

const CONDITIONS = [
  {
    title: 'חובה להציג חשבונית או אישור הזמנה',
    text: 'ללא הוכחת רכישה לא ניתן לבצע החזרה.',
  },
  {
    title: 'אריזה מקורית',
    text: 'יש להחזיר את המוצר עם כל האביזרים, הוראות ההפעלה והאריזה המקורית.',
  },
  {
    title: 'החזרה לחנות בלבד',
    text: `החזרת מוצרים מתבצעת פיזית בחנות ב${ADDRESS.full} בלבד.`,
  },
];

const REFUND_METHODS = [
  {
    Icon: CreditCard,
    title: 'החזר לאמצעי התשלום המקורי',
    text: 'ההחזר יבוצע לכרטיס האשראי או לאמצעי שבו שילמת — בדרך כלל תוך 3-5 ימי עסקים.',
  },
  {
    Icon: Gift,
    title: 'זיכוי לקנייה הבאה',
    text: 'מעדיף זיכוי? נשמח להעניק שובר זיכוי בשווי המוצר לשימוש בקנייה הבאה בחנות.',
  },
];

/** מציג רשימת "מה כן / מה לא" עם אריח סימון אחיד. */
function PolicyList({ items, allowed }) {
  const Mark = allowed ? Check : X;
  const variant = allowed ? 'allow' : 'deny';
  return (
    <ul className={`returns-list returns-list--${variant}`}>
      {items.map(({ title, text }) => (
        <li className="returns-list-item" key={title}>
          <span className="returns-item-icon"><Mark size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** מציג את עמוד מדיניות ההחזרות. */
function Returns() {
  usePageTitle('מדיניות החזרים');

  return (
    <div className="page-container">
      <PageHeader
        pill="מדיניות"
        title="מדיניות"
        accent="החזרים"
        subtitle="אנחנו כאן לעזור — קראו את המדיניות שלנו"
      />

      <div className="returns-sections">

        {/* הבהרה חשובה */}
        <section className="returns-card returns-card--note">
          <span className="returns-card-icon"><AlertTriangle size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">הבהרה חשובה</h2>
          <p className="returns-text">
            מדיניות זו מתייחסת לרכישות המבוצעות דרך האתר ובחנות הפיזית.
            המדיניות עומדת בהתאם ל<strong>חוק הגנת הצרכן התשמ"א-1981</strong> ותקנותיו.
            במקרה של סתירה בין מדיניות זו לבין הוראות החוק — הוראות החוק יגברו.
          </p>
        </section>

        {/* חלון זמן */}
        <section className="returns-card">
          <span className="returns-card-icon"><CalendarDays size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">חלון זמן להחזרה</h2>
          <p className="returns-text">
            ניתן להחזיר מוצרים תוך <strong>14 יום</strong> מיום קבלת ההזמנה או מיום הרכישה בחנות,
            בהתאם לחוק הגנת הצרכן.
            לאחר 14 יום לא ניתן לקבל זיכוי או החזר כספי, אלא במקרה של פגם.
          </p>
        </section>

        {/* מתי מקבלים החזר */}
        <section className="returns-card">
          <span className="returns-card-icon"><CheckCircle size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">מתי מקבלים החזר?</h2>
          <PolicyList items={REFUND_CASES} allowed />
        </section>

        {/* מה לא ניתן להחזיר */}
        <section className="returns-card">
          <span className="returns-card-icon"><XCircle size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">מה לא ניתן להחזיר?</h2>
          <PolicyList items={NO_RETURN} />
        </section>

        {/* תנאי ההחזרה */}
        <section className="returns-card">
          <span className="returns-card-icon"><ClipboardList size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">תנאי ההחזרה</h2>
          <PolicyList items={CONDITIONS} allowed />
        </section>

        {/* אחריות על מוצרים */}
        <section className="returns-card">
          <span className="returns-card-icon"><Shield size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">אחריות על מוצרים</h2>
          <p className="returns-text">
            המוצרים נמכרים עם אחריות היצרן בלבד. טכניק טמבור אינה אחראית לנזקים שנגרמו
            כתוצאה משימוש לא נכון, התקנה שגויה, או שינויים שבוצעו במוצר על ידי הלקוח.
            לבירורי אחריות יש לפנות ישירות ליצרן המוצר.
          </p>
        </section>

        {/* איך מקבלים את הכסף */}
        <section className="returns-card">
          <span className="returns-card-icon"><Coins size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">איך מקבלים את הכסף בחזרה?</h2>
          <div className="refund-options">
            {REFUND_METHODS.map(({ Icon, title, text }) => (
              <div className="refund-option" key={title}>
                <span className="refund-icon"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="refund-note">* הבחירה בין החזר כספי לזיכוי היא של הלקוח בלבד.</p>
        </section>

        {/* שלבי ההחזרה */}
        <section className="returns-card">
          <span className="returns-card-icon"><Package size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">איך מבצעים החזרה?</h2>
          <ol className="returns-steps">
            <li className="returns-step">
              <span className="returns-step-number">1</span>
              <p>צור קשר איתנו בטלפון <a href={`tel:${PHONES.store.tel}`}>{PHONES.store.display}</a> או <a href={`tel:${PHONES.mobile.tel}`}>{PHONES.mobile.display}</a> לפני הגעה לחנות</p>
            </li>
            <li className="returns-step">
              <span className="returns-step-number">2</span>
              <p>ספר לנו מה הבעיה ונאשר את ההחזרה — <strong>ללא אישור מראש לא ניתן לבצע החזרה</strong></p>
            </li>
            <li className="returns-step">
              <span className="returns-step-number">3</span>
              <p>הבא את המוצר לחנות ב{ADDRESS.full} — עם חשבונית או אישור הזמנה ואריזה מקורית</p>
            </li>
            <li className="returns-step">
              <span className="returns-step-number">4</span>
              <p>נבצע את ההחזר הכספי או הזיכוי באותו מעמד</p>
            </li>
          </ol>
        </section>

        {/* הגבלת אחריות */}
        <section className="returns-card returns-card--note">
          <span className="returns-card-icon"><ScrollText size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">הגבלת אחריות</h2>
          <p className="returns-text">
            טכניק טמבור לא תישא באחריות לכל נזק ישיר, עקיף, מקרי או תוצאתי שייגרם
            כתוצאה מהשימוש במוצרים הנמכרים. האחריות המקסימלית של החנות מוגבלת
            למחיר המוצר שנרכש בלבד. מדיניות זו אינה גורעת מזכויות הלקוח על פי דין.
          </p>
        </section>

        {/* יצירת קשר */}
        <section className="returns-card returns-contact">
          <span className="returns-card-icon"><Phone size={22} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2 className="returns-card-title">יש שאלה?</h2>
          <p className="returns-text">אנחנו כאן לעזור — אל תהסס לפנות אלינו</p>
          <div className="returns-contact-btns">
            <a href={`tel:${PHONES.store.tel}`} className="returns-phone-btn">{PHONES.store.display}</a>
            <a href={`tel:${PHONES.mobile.tel}`} className="returns-phone-btn">{PHONES.mobile.display}</a>
          </div>
          <p className="returns-hours">{hoursSummary(' | ')}</p>
        </section>

      </div>
    </div>
  );
}

export default Returns;
