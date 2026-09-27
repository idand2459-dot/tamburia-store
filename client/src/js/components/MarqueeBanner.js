import {
  Wrench, MapPin, Phone, Smartphone, Clock, Star, Handshake, Banknote, Headset,
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

/** מציג את רצועת ההודעות הנגללת. */
function MarqueeBanner() {
  return (
    <div className="marquee-banner">
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
    </div>
  );
}

export default MarqueeBanner;