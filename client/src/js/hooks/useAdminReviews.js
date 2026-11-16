/**
 * חוות הדעת של מסך הניהול: הרשימה המלאה, האישור והמחיקה.
 *
 * Receives the admin API (adminApi, see services/adminService.js) as an argument; the hook
 * no longer builds its own requests.
 * הנתיב הוא /api/reviews/all ולא /api/reviews, כי המנהל צריך לראות
 * גם את אלה שטרם אושרו.
 */
import { useState, useEffect, useCallback } from 'react';
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';

/** מנהל את חוות הדעת ואת אישורן. */
export function useAdminReviews(adminApi) {
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState('');

  /** טוען את כל חוות הדעת, כולל אלה שטרם אושרו. */
  const fetchReviews = useCallback(() => {
    adminApi.getReviews().then(r => r.json()).then(data => setReviews(Array.isArray(data) ? data : [])).catch(() => {});
  }, [adminApi]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  /** מאשר פרסום של חוות דעת. */
  const approveReview = useCallback(async (id) => {
    try {
      const res = await adminApi.approveReview(id);

      if (!res.ok) {
        setReviewsError(await errorMessageFrom(res, 'אישור הביקורת נכשל.'));
        return;
      }
      setReviewsError(''); fetchReviews();
    } catch {
      setReviewsError(NETWORK_ERROR);
    }
  }, [adminApi, fetchReviews]);

  /** מוחק חוות דעת לאחר אישור המשתמש. */
  const deleteReview = useCallback(async (id) => {
    if (!window.confirm('למחוק ביקורת?')) return;

    try {
      const res = await adminApi.deleteReview(id);
      if (!res.ok) {
        setReviewsError(await errorMessageFrom(res, 'מחיקת הביקורת נכשלה.'));
        return;
      }
      setReviewsError(''); fetchReviews();
    } catch {
      setReviewsError(NETWORK_ERROR);
    }
  }, [adminApi, fetchReviews]);

  return { reviews, fetchReviews, approveReview, deleteReview, reviewsError };
}
