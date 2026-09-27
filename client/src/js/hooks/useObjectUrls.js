/**
 * ממיר רשימת קבצים לכתובות blob לתצוגה, ומשחרר אותן אחר כך.
 *
 * URL.createObjectURL תופס זיכרון עד ש-revokeObjectURL נקרא עליו. קריאה
 * לו בתוך הרינדור הייתה יוצרת כתובת חדשה בכל רינדור ולא משחררת אף אחת,
 * ובטופס שבו מצלמים תמונה אחרי תמונה זה נערם. כאן הן נוצרות פעם אחת לכל
 * רשימת קבצים, ומשוחררות כשהרשימה מתחלפת וכשהרכיב יורד.
 *
 * הזהות של מערך הקבצים היא מה שקובע: הטופס מחזיק אותו ב-state ומחליף
 * אותו רק כשמוסיפים או מסירים קובץ, ולכן אין כאן יצירה מחדש סתם.
 */
import { useState, useEffect } from 'react';

/** מחזיר כתובת blob לכל קובץ, באותו סדר. */
export function useObjectUrls(files) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file));
    setUrls(created);
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  /* רינדור ראשון של רשימה חדשה קורה לפני שה-effect רץ, ואז urls עדיין
     מתאר את הרשימה הקודמת. החזרת [] במקרה הזה עדיפה על כתובת של קובץ
     אחר — התמונה מופיעה רגע אחרי, ולא התמונה הלא נכונה. */
  return urls.length === files.length ? urls : [];
}
