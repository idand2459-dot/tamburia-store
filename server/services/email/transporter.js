/**
 * מחזיק את חיבור ה-SMTP ושולח דרכו מיילים.
 * השליחה לעולם אינה זורקת, כדי שתקלת מייל לא תכשיל הזמנה שנשמרה.
 */
const nodemailer = require('nodemailer');
const config = require('../../config/env');

let cached = null;

/** מחזיר את ה-transporter, ויוצר אותו בפעם הראשונה שנדרש. */
function getTransporter() {
  if (!cached) {
    cached = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return cached;
}

/** שולח מייל ומחזיר האם הצליח, בלי לזרוק שגיאה. */
async function send({ to, subject, html }) {
  if (!to) return { sent: false, reason: 'אין נמען' };

  if (!config.mail.enabled) {
    console.log(`[מייל כבוי] "${subject}" → ${to}`);
    return { sent: false, reason: 'MAIL_ENABLED=false' };
  }

  try {
    await getTransporter().sendMail({ from: config.mail.from, to, subject, html });
    console.log(`מייל נשלח → ${to} | ${subject} ✓`);
    return { sent: true };
  } catch (err) {
    console.error(`✗ שליחת מייל נכשלה → ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { send };
