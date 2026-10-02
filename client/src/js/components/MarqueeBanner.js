import { useState } from 'react';
import {
  Pause, Play, Wrench, MapPin, Phone, Smartphone, Clock, Star, Handshake, Banknote, Headset,
} from 'lucide-react';
import { ADDRESS, PHONES, OPEN_HOURS, hoursRange } from '../utils/storeInfo';

const ITEMS = [
  { Icon: Wrench,     text: 'טכניק טמבור' },
  { Icon: MapPin,     text: ADDRESS.full },
  { Icon: Phone,      text: PHONES.store.display },
  { Icon: Smartphone, text: PHONES.mobile.display },
  ...OPEN_HOURS.map((row) => (
    { Icon: Clock,    text: `${row.short}: ${hoursRange(row)}` }
  )),
  { Icon: Star,       text: 'נוסדה 1991' },
  { Icon: Handshake,  text: 'יחס אישי ואדיב' },
  { Icon: Banknote,   text: 'מחירים טובים' },
  { Icon: Headset,    text: 'עזרה טכנית מקצועית' },
];

/**
 * מציג את רצועת ההודעות הנגללת.
 *
 * aside עם שם: הרצועה היא מידע משני שחוזר בפוטר, והיא יושבת מחוץ
 * ל-header ול-main — בלי אזור משלה, קורא מסך היה פוגש אותה כטקסט יתום.
 *
 * כפתור ההשהיה הוא WCAG 2.2.2: תוכן שזז מעצמו בלי סוף צריך דרך לעצור
 * אותו. העצירה במעבר עכבר נשארת, אבל מקלדת ומסך מגע לא יכולים לרחף.
 */
function MarqueeBanner() {
  const [paused, setPaused] = useState(false);

  return (
    <aside className={`marquee-banner ${paused ? 'is-paused' : ''}`} aria-label="מידע על החנות">
      <button
        type="button"
        className="marquee-pause"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? 'הפעל את רצועת ההודעות' : 'עצור את רצועת ההודעות'}
      >
        {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
      </button>
      {/* שני עותקים של הרשימה, כל אחד ב-group משלו: הגלילה ל--50% מזיזה
          בדיוק group אחד, ולכן הפריים בסוף זהה לפריים בהתחלה. ה-min-width
          שב-CSS הוא מה שמבטיח שגם במסך רחב group אחד ממלא את הרוחב. */}
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="marquee-group"
            /* העותק השני הוא שכפול חזותי בלבד, ואין טעם שקורא מסך יקרא
               את אותן עשר הודעות פעמיים. */
            aria-hidden={copy === 1 ? 'true' : undefined}
          >
            {ITEMS.map(({ Icon, text }, i) => (
              <span key={i} className="marquee-item">
                <Icon size={14} aria-hidden="true" />
                {text}
                {/* המפריד הוא עיגול שה-CSS מצייר, לא תו bullet */}
                <span className="marquee-sep" aria-hidden="true" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default MarqueeBanner;