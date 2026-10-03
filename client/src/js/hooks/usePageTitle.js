/**
 * כותרת הטאב לכל עמוד.
 *
 * האתר הוא עמוד אחד, ולכן בלי זה כל הכתובות נשאו את אותה כותרת מ-
 * index.html. זו הדבר הראשון שקורא מסך מקריא בכניסה לעמוד, והדרך
 * שבה מבדילים בין טאבים (WCAG 2.4.2).
 */
import { useEffect } from 'react';

const SITE_NAME = 'טכניק טמבור';
// הכותרת של דף הבית, כפי שהיא ב-index.html — שם היא נבחרה בשביל
// מנועי החיפוש, ואין סיבה שהניווט באתר ישנה אותה.
const HOME_TITLE = 'טכניק טמבור | חנות כלי עבודה וחומרי בניין פתח תקווה';

/** מחזיר את הכותרת המלאה לעמוד, או את כותרת הבית כשאין שם. */
function fullTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : HOME_TITLE;
}

/**
 * קובע את כותרת הטאב כל עוד הרכיב מוצג.
 *
 * restore מחזיר את הכותרת הקודמת ביציאה. המגירות צריכות אותו, כי
 * הן נפתחות מעל עמוד שכבר קבע כותרת, והסגירה צריכה להחזיר אותה.
 * עמוד רגיל לא צריך: העמוד הבא קובע את שלו.
 */
export function usePageTitle(title, { restore = false } = {}) {
  useEffect(() => {
    const previous = document.title;
    document.title = fullTitle(title);
    return restore ? () => { document.title = previous; } : undefined;
  }, [title, restore]);
}
