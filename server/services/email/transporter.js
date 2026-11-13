/**
 * מחזיק את חיבור ה-SMTP ושולח דרכו מיילים.
 * השליחה לעולם אינה זורקת, כדי שתקלת מייל לא תכשיל הזמנה שנשמרה.
 *
 * וגם לעולם אינה תלויה לנצח: ה-timeouts של nodemailer חוסמים כל שלב בחיבור, ומעליהם
 * דדליין כולל שמבטיח שהקורא מקבל תשובה. הזמנה ממתינה למיילים לפני שהיא עונה ללקוח, ולכן
 * SMTP תקוע לא יכול להפוך לבקשה תקועה.
 */
const nodemailer = require('nodemailer');
const config = require('../../config/env');

/** הדדליין הכולל לשליחה אחת. גדול מ-socketTimeout, כדי שהוא רק רשת ביטחון. */
const SEND_DEADLINE_MS = 10_000;

const TIMED_OUT = Symbol('timed out');

let cached = null;

/** מחזיר את ה-transporter, ויוצר אותו בפעם הראשונה שנדרש. */
function getTransporter() {
  if (!cached) {
    cached = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.pass },
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      dnsTimeout: 5_000,
      socketTimeout: 8_000,
    });
  }
  return cached;
}

/**
 * ממתין להבטחה לכל היותר ms. הדדליין נפתר (לא נדחה) עם TIMED_OUT, הטיימר תמיד מתנקה,
 * ודחייה מאוחרת של ההבטחה שהפסידה נבלעת כדי שלא תהפוך ל-unhandled rejection.
 */
function withDeadline(promise, ms) {
  let timer;
  const work = Promise.resolve(promise);
  work.catch(() => { /* הקורא מקבל את הדחייה דרך ה-race; כאן רק מונעים unhandled rejection */ });
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms); });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/**
 * שולח מייל ומחזיר האם הצליח, בלי לזרוק שגיאה.
 *
 * sent: false עם reason 'timeout' פירושו שהשליחה לא אושרה בזמן, לא שהמייל לא יצא:
 * ייתכן ש-SMTP קיבל אותו אחרי שהפסקנו לחכות. התוצאה אינה ידועה.
 */
async function send({ to, subject, html }, { deadlineMs = SEND_DEADLINE_MS } = {}) {
  if (!to) return { sent: false, reason: 'אין נמען' };

  if (!config.mail.enabled) {
    console.log(`[מייל כבוי] "${subject}" → ${to}`);
    return { sent: false, reason: 'MAIL_ENABLED=false' };
  }

  try {
    const outcome = await withDeadline(
      getTransporter().sendMail({ from: config.mail.from, to, subject, html }),
      deadlineMs
    );
    if (outcome === TIMED_OUT) {
      console.error(`✗ שליחת מייל לא אושרה בזמן (${deadlineMs}ms) — התוצאה אינה ידועה | ${subject}`);
      return { sent: false, reason: 'timeout' };
    }
    console.log(`מייל נשלח → ${to} | ${subject} ✓`);
    return { sent: true };
  } catch (err) {
    console.error(`✗ שליחת מייל נכשלה → ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { send, withDeadline, TIMED_OUT };
