/**
 * תשתית השידור בזמן אמת: שרת WebSocket ותו לא.
 *
 * הקובץ הזה אינו יודע דבר על הזמנות, חוות דעת או כל מושג עסקי אחר —
 * הוא יודע רק "שלח את ה-JSON הזה לכל מי שמחובר". מי שמחליט *מתי*
 * לשדר ו*מה* הוא שכבת הלוגיקה העסקית (services/*.service.js), ולכן
 * אין כאן שום require ל-models/, ל-controllers/ או לוולידטורים.
 * התלויות היחידות הן ws ו-services/auth לבדיקת הלחיצת-יד.
 *
 * החיבור עולה על אותו שרת HTTP ולא על פורט נוסף, כדי שלא יידרש
 * חור נוסף בחומת האש ושהעוגייה תישלח אליו כמו לכל בקשה רגילה.
 */
const { WebSocketServer, WebSocket } = require('ws');
const config = require('../config/env');
const { verifyToken, readCookie } = require('./auth.service');

const WS_PATH = '/ws';

// ה-Set ברמת המודול ולא בתוך attachRealtime, כדי ש-broadcast יעבוד
// גם כשלא חובר שרת בכלל — בבדיקות, למשל, הוא פשוט לא עושה כלום.
const clients = new Set();

/** פותח שרת WebSocket על שרת ה-HTTP הקיים ומנהל את המחוברים. */
function attachRealtime(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      pathname = req.url;
    }

    // כל נתיב אחר נסגר במקום להישאר תלוי — אין בשרת הזה מאזין upgrade
    // אחר שהיה יכול לטפל בו.
    if (pathname !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    // אותה עוגייה ואותו אימות כמו בכל נתיב ניהול — verifyToken מיובא
    // ולא משוחזר כאן, כדי שלא יהיו שתי גרסאות של אותה בדיקה.
    const token = readCookie(req, config.auth.cookieName);
    if (!verifyToken(token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    // בלי ההסרה הזו ה-Set היה גדל בלי גבול עם חיבורים מתים.
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  return wss;
}

/** שולח הודעה מסוג נתון לכל המחוברים, ומנקה חיבורים שאינם פתוחים. */
function broadcast(eventType, payload) {
  const message = JSON.stringify({ type: eventType, payload });

  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.delete(ws);
      continue;
    }
    try {
      ws.send(message);
    } catch {
      // שליחה שנכשלה לא תפיל את הפעולה שקראה לשידור.
      clients.delete(ws);
    }
  }
}

module.exports = { attachRealtime, broadcast };
