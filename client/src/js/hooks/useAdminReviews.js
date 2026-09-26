/**
 * חוות הדעת של מסך הניהול: הרשימה המלאה, האישור והמחיקה.
 *
 * מקבל את עוטף ה-fetch (api) כארגומנט, כמו שני ההוקים האחרים.
 * הנתיב הוא /api/reviews/all ולא /api/reviews, כי המנהל צריך לראות
 * גם את אלה שטרם אושרו.
 */
import { useState, useEffect, useCallback } from 'react';

/** מנהל את חוות הדעת ואת אישורן. */
export function useAdminReviews(api) {
  const [reviews, setReviews] = useState([]);

  /** טוען את כל חוות הדעת, כולל אלה שטרם אושרו. */
  const fetchReviews = useCallback(() => {
    api('/api/reviews/all').then(r => r.json()).then(data => setReviews(Array.isArray(data) ? data : [])).catch(() => {});
  }, [api]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  /** מאשר פרסום של חוות דעת. */
  const approveReview = useCallback(async (id) => {
    await api(`/api/reviews/${id}/approve`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({approved: true}) });
    fetchReviews();
  }, [api, fetchReviews]);

  /** מוחק חוות דעת לאחר אישור המשתמש. */
  const deleteReview = useCallback(async (id) => {
    if (!window.confirm('למחוק ביקורת?')) return;
    await api(`/api/reviews/${id}`, { method: 'DELETE' });
    fetchReviews();
  }, [api, fetchReviews]);

  return { reviews, fetchReviews, approveReview, deleteReview };
}
