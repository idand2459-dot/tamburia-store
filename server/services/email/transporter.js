const nodemailer = require('nodemailer');
const config = require('../../config/env');

let cached = null;

/** נוצר בפעם הראשונה שצריך אותו — לא בעליית השרת */
function getTransporter() {
  if (!cached) {
    cached = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return cached;
}

/**
 * שליחה שלעולם לא זורקת.
 * הזמנה שכבר נשמרה ב-DB לא תיכשל כלפי הלקוח בגלל תקלת SMTP —
 * זו בדיוק ההתנהגות של הקוד הישן, רק במקום אחד במקום בשלושה.
 */
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
