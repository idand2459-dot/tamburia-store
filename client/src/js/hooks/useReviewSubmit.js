/**
 * שליחת חוות דעת: מצב השליחה, מצב השגיאה והשליחה עצמה.
 *
 * שני טפסי הביקורת בחנות — זה שבעמוד המוצר וזה שבקרוסלת עמוד הבית —
 * צריכים בדיוק את אותם שלושה דברים, ובעיקר את אותה התנהגות בכישלון:
 * "תודה" רק על הצלחה, הודעת השרת כשיש אחת, והטופס נשאר פתוח עם מה
 * שהלקוח כתב. הוק אחד הוא מה שמבטיח שהשניים באמת יתנהגו אותו דבר,
 * ולא רק ייראו כאילו.
 *
 * onSuccess הוא מה שכל טופס עושה אחרי הצלחה — לסמן שנשלח ולנקות —
 * כי שם השניים באמת נבדלים.
 */
import { useState } from 'react';
import { createReview } from '../services/reviewService';
import { messageFor } from '../services/http';

/** מחזיר את מצב השליחה ואת הפונקציה ששולחת חוות דעת. */
export function useReviewSubmit(onSuccess) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /** שולח את חוות הדעת; מחזיר true בהצלחה. */
  async function submit(review) {
    // שליחה כפולה בלחיצה חוזרת הייתה יוצרת שתי ביקורות זהות, והכפתור
    // ננעל רק אחרי ה-render הבא — לכן הבדיקה כאן ולא רק ב-disabled.
    if (submitting) return false;

    setSubmitting(true);
    setError(null);

    try {
      await createReview(review);
      onSuccess();
      return true;
    } catch (err) {
      setError(messageFor(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  /** מנקה את השגיאה — בפתיחה מחדש של הטופס. */
  function clearError() { setError(null); }

  return { submitting, error, submit, clearError };
}
