/**
 * הרצה לפני כל קובץ בדיקות. CRA טוען אותו לבד אם הוא קיים.
 *
 * ה-jsdom שמגיע עם react-scripts 5 קדם ל-TextEncoder/TextDecoder
 * הגלובליים, ו-react-router 7 משתמש בהם ברגע הטעינה. בלי ההשלמה
 * הזו כל בדיקה שמרנדרת רכיב עם ניווט נופלת עוד לפני ה-import.
 * ב-Node עצמו הם קיימים מאז גרסה 11, ומשם הם נלקחים.
 */
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
