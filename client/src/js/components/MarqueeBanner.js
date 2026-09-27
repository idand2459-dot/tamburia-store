import {
  Wrench, MapPin, Phone, Smartphone, Clock, Star, Handshake, Banknote,
} from 'lucide-react';

const ITEMS = [
  { Icon: Wrench,     text: 'טכניק טמבור' },
  { Icon: MapPin,     text: 'בר כוכבא 52, פתח תקווה' },
  { Icon: Phone,      text: '03-9315750' },
  { Icon: Smartphone, text: '050-6735040' },
  { Icon: Clock,      text: 'א׳-ה׳: 7:00-20:00' },
  { Icon: Clock,      text: 'ו׳: 7:00-15:00' },
  { Icon: Star,       text: 'נוסדה 1991' },
  { Icon: Handshake,  text: 'יחס אישי ואדיב' },
  { Icon: Banknote,   text: 'מחירים טובים' },
  { Icon: Wrench,     text: 'עזרה טכנית מקצועית' },
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