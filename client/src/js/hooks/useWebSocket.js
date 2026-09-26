/**
 * חיבור WebSocket גנרי: תעבורה בלבד.
 *
 * ההוק הזה אינו יודע דבר על הזמנות, קונפטי או משמעות של אירוע כלשהו.
 * הוא מקבל מפה של סוג-אירוע → callback, ומפעיל את המתאים כשהודעה
 * מאותו סוג מגיעה. מי שיודע מה המשמעות הוא ההוק התחומי שקורא לו —
 * אותה חלוקה בדיוק כמו בצד השרת, שבו services/realtime.js הוא תשתית
 * ו-order.service.js הוא זה שמחליט מה לשדר.
 *
 * הכתובת נגזרת מ-window.location ולכן היא תמיד same-origin: בייצור
 * האפליקציה מוגשת מאותו שרת שפותח את ה-WebSocket, והעוגייה נשלחת
 * בלחיצת היד כמו בכל בקשה. בפיתוח מול CRA על פורט אחר ה-proxy של
 * CRA אינו מעביר שדרוג WebSocket, ולכן שם החיבור לא יעלה — הסקר
 * החלופי הוא מה שמכסה את המקרה הזה.
 *
 * ה-callbacks נשמרים ב-ref ולא ב-dependency של ה-effect, כי הקורא
 * בונה את המפה מחדש בכל רינדור — בלי זה כל רינדור היה סוגר את
 * החיבור ופותח אחד חדש.
 */
import { useEffect, useRef } from 'react';

const RETRY_MS = 3000;
const DEFAULT_PATH = '/ws';

/** בונה כתובת WebSocket same-origin לנתיב נתון. */
function socketUrl(path) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

/** מתחבר ומפעיל את ה-callback המתאים לכל הודעה שמגיעה. */
export function useWebSocket(handlers, { path = DEFAULT_PATH } = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let socket = null;
    let retryTimer = null;
    let unmounted = false;

    /** פותח חיבור, ומתזמן ניסיון נוסף אם הוא נסגר. */
    function connect() {
      socket = new WebSocket(socketUrl(path));

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!message || typeof message.type !== 'string') return;

        const handler = handlersRef.current?.[message.type];
        if (handler) handler(message.payload);
      };

      // חיבור שנפל חוזר לנסות אחרי השהיה קבועה, כדי שלא יישאר מת
      // לנצח אחרי הפסקת רשת או הפעלה מחדש של השרת. onerror אינו
      // מתזמן בעצמו — אחריו תמיד מגיע onclose.
      socket.onclose = () => {
        if (unmounted) return;
        retryTimer = setTimeout(connect, RETRY_MS);
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket) {
        // ניקוי ה-onclose לפני הסגירה, אחרת הסגירה עצמה הייתה
        // מתזמנת ניסיון חיבור חדש אחרי שהרכיב כבר ירד.
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, [path]);
}
