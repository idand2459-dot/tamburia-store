/**
 * עזרים משותפים לחבילות הבדיקה: התחברות כאדמין ושמירת העוגייה.
 */

/** מתחבר כאדמין ומחזיר את מחרוזת העוגייה לשליחה בבקשות הבאות. */
async function login(baseUrl) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('חסר ADMIN_PASSWORD בסביבה');

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw new Error(`התחברות האדמין נכשלה: ${res.status}`);
  }

  const cookie = (res.headers.getSetCookie?.() || [])
    .find((c) => c.startsWith('tamburia_admin='));

  if (!cookie) throw new Error('לא התקבלה עוגיית התחברות');
  return cookie.split(';')[0];
}

module.exports = { login };
