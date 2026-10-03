/**
 * מאמת את גוף בקשת ההתחברות לניהול.
 *
 * הבדיקה כאן היא של צורה בלבד — שנשלחה מחרוזת לא ריקה. האם הסיסמה
 * נכונה מכריע services/auth.service, בהשוואה בזמן קבוע.
 */
const { badRequest } = require('../utils/AppError');

/** מחזיר את הסיסמה שנשלחה, או זורק 400 כשאינה מחרוזת לא ריקה. */
function parseLogin(body = {}) {
  const { password } = body || {};
  if (typeof password !== 'string' || password === '') {
    throw badRequest('חסרה סיסמה');
  }
  return password;
}

module.exports = { parseLogin };
