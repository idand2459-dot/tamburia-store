/**
 * הצליל שמודיע על הזמנה חדשה במסך הניהול, ומתג ההשתקה שלו.
 *
 * הצליל מיוצר ב-Web Audio ולא מקובץ: שני צלילים קצרים הם שתי
 * אוסילטורות, וכך אין נכס להוריד, אין מה לשמור במטמון ואין בקשת רשת
 * שיכולה להיכשל בדיוק כשההזמנה נכנסת.
 *
 * דפדפנים אוסרים השמעה לפני שהמשתמש נגע בעמוד, ולכן לחיצה על המתג
 * להדלקה משמיעה את הצליל פעם אחת: זו גם הנגיעה שמשחררת את האודיו וגם
 * הדרך לשמוע איך זה נשמע. אם הדפדפן חוסם בכל זאת — אין שגיאה ואין
 * הודעה, הקונפטי ממשיך כרגיל וההזמנה מופיעה ברשימה. התראה חזותית היא
 * ההתראה האמיתית; הצליל הוא תוספת.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'tamburia_admin_sound';

/* קוינטה עולה, סול ואז דו. אינטרוול פתוח ולא צורם, ובטווח שנשמע גם
   ברמקול של טלפון שמונח על דלפק. */
const NOTES = [
  { freq: 784.0, at: 0, length: 0.18 },
  { freq: 1046.5, at: 0.13, length: 0.34 },
];

const PEAK_GAIN = 0.18;

/** קורא את העדפת הצליל מהאחסון. ברירת המחדל היא מופעל. */
function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // מצב פרטי או אחסון חסום — ההעדפה פשוט לא נזכרת.
    return true;
  }
}

/** שומר את העדפת הצליל, ומתעלם מכישלון אחסון. */
function writePreference(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* אין אחסון — ההעדפה תקפה לגלישה הזו בלבד */
  }
}

/** מנגן צליל אחד על הקשר האודיו הנתון. */
function playNote(ctx, { freq, at, length }) {
  const start = ctx.currentTime + at;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  // מעטפה: עלייה מהירה ודעיכה מעריכית. בלעדיה נשמע קליק בהתחלה
  // ובסוף, כי האות נחתך באמצע גל.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** מחזיר את מצב הצליל, מתג ומשמיע. */
export function useNewOrderChime() {
  const [soundOn, setSoundOn] = useState(readPreference);

  // קשר אודיו אחד לכל חיי המסך. דפדפנים מגבילים את מספר הקשרים
  // הפתוחים, והזמנה חדשה יכולה להגיע פעמים רבות במשמרת.
  const ctxRef = useRef(null);

  // המשמיע נקרא מתוך useAdminOrders, שמחזיק אותו ב-ref. קריאת המצב
  // דרך ref ולא מה-closure שומרת את playChime יציב לאורך כל הריצה,
  // ולכן ההוק שקורא לו אינו נרשם מחדש ל-WebSocket בכל שינוי.
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  /** מנגן את הצליל. שקט כשהצליל כבוי או כשהדפדפן חוסם. */
  const playChime = useCallback(() => {
    if (!soundOnRef.current) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;

      // קשר שנוצר בלי נגיעת משתמש נולד מושתק. resume מחזיר הבטחה
      // שנדחית כשהדפדפן מסרב, וזו דחייה שאין עליה מה לדווח.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      NOTES.forEach((note) => playNote(ctx, note));
    } catch {
      /* אין Web Audio, או שהדפדפן סירב — ההתראה החזותית נשארה */
    }
  }, []);

  /** הופך את מצב הצליל. הדלקה משמיעה פעם אחת, וכך גם משחררת אודיו. */
  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      writePreference(next);
      if (next) {
        soundOnRef.current = true;
        playChime();
      }
      return next;
    });
  }, [playChime]);

  // סוגר את הקשר ביציאה מהמסך, כדי לא להשאיר חומרת אודיו פתוחה.
  useEffect(() => () => {
    ctxRef.current?.close?.().catch?.(() => {});
  }, []);

  return { soundOn, toggleSound, playChime };
}
