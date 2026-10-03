/**
 * צורת התשובה של כל רשימה ב-API, במקום אחד.
 *
 * בלי limit ו-offset הרשימה חוזרת כמערך שטוח — זה החוזה שהחנות נשענת
 * עליו. עם אחד מהם היא עטופה: { [key]: rows, pagination }. השירותים
 * מחזירים total רק כשהתבקש דפדוף, ולכן total שאינו מוגדר פירושו מערך.
 */

/** שולח רשימה כמערך, או עטופה בפרטי דפדוף כשיש total. */
function sendList(res, key, rows, total, options) {
  if (total === undefined) return res.json(rows);
  return res.json({
    [key]: rows,
    pagination: {
      total,
      limit: options.limit ?? total,
      offset: options.offset ?? 0,
    },
  });
}

module.exports = { sendList };
