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
 * What a mail log line may say about a send: a fixed label chosen in code by the caller, such as
 * "new-order store #12". Callers never build it from a name, an address or a subject. This only
 * keeps the label to plain characters and a short length, so a stray newline or a very long text
 * cannot forge or flood a log line.
 */
function safeLabel(label) {
  const text = typeof label === 'string' ? label.replace(/[^A-Za-z0-9 #._-]/g, '').trim().slice(0, 60) : '';
  return text || 'mail';
}

/** The SMTP codes of a failure (ECONNECTION, EAUTH, 550), never its message. */
function failureCodes(err) {
  const parts = [];
  if (typeof err?.code === 'string' && /^[A-Z0-9_]{3,24}$/.test(err.code)) parts.push(err.code);
  if (Number.isInteger(err?.responseCode) && err.responseCode >= 100 && err.responseCode <= 599) parts.push(err.responseCode);
  return parts.length > 0 ? parts.join(' ') : 'no code';
}

/**
 * שולח מייל ומחזיר האם הצליח, בלי לזרוק שגיאה.
 * The log line carries `label` and the outcome only: never the recipient, the subject (the
 * new-order subject holds the customer's name) or the text of an error.
 *
 * sent: false עם reason 'timeout' פירושו שהשליחה לא אושרה בזמן, לא שהמייל לא יצא:
 * ייתכן ש-SMTP קיבל אותו אחרי שהפסקנו לחכות. התוצאה אינה ידועה.
 */
async function send({ to, subject, html }, { deadlineMs = SEND_DEADLINE_MS, label } = {}) {
  if (!to) return { sent: false, reason: 'אין נמען' };
  const tag = safeLabel(label);

  if (!config.mail.enabled) {
    console.log(`[mail disabled] ${tag}`);
    return { sent: false, reason: 'MAIL_ENABLED=false' };
  }

  try {
    const outcome = await withDeadline(
      getTransporter().sendMail({ from: config.mail.from, to, subject, html }),
      deadlineMs
    );
    if (outcome === TIMED_OUT) {
      console.error(`✗ mail not confirmed within ${deadlineMs}ms, outcome unknown | ${tag}`);
      return { sent: false, reason: 'timeout' };
    }
    console.log(`mail sent | ${tag} ✓`);
    return { sent: true };
  } catch (err) {
    // The log gets the SMTP codes only, and so does the caller: err.message of a failed send usually repeats the recipient.
    console.error(`✗ mail failed | ${tag} | ${failureCodes(err)}`);
    return { sent: false, reason: 'delivery_failed' };
  }
}

module.exports = { send, withDeadline, TIMED_OUT };
