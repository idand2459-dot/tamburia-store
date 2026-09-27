/**
 * חוות הדעת על המוצר: הרשימה וטופס הכתיבה.
 *
 * הרשימה מגיעה בפרופס ולא נשלפת כאן, כי ProductPage צריך אותה גם
 * לסיכום הדירוג שליד שם המוצר. מצב הטופס לעומת זה מקומי, ומתאפס
 * במעבר מוצר באפקט משלו — אותו איפוס שהיה קודם באפקט של ההורה.
 *
 * ביקורת שנשלחה אינה מרעננת את הרשימה, כמו קודם: היא מתפרסמת רק
 * לאחר אישור בניהול, ולכן שליפה מחדש לא הייתה מציגה אותה בכל מקרה.
 *
 * ה-ref שמגיע בפרופס יושב על העוטף, ודרכו סיכום הדירוג שליד שם המוצר
 * גולל לכאן. ב-React 19 ref הוא prop רגיל ואין צורך ב-forwardRef.
 */
import { useState, useEffect } from 'react';
import { X, PenLine, CheckCircle } from 'lucide-react';
import Stars from './Stars';

const EMPTY_FORM = { reviewer_name: '', rating: 5, text: '' };

/** מציג את רשימת חוות הדעת ואת טופס הכתיבה. */
function ProductReviewsSection({ productId, reviews, ref }) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_FORM);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    setReviewSubmitted(false);
    setShowReviewForm(false);
  }, [productId]);

  /** שולח חוות דעת חדשה על המוצר. */
  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewForm.reviewer_name || !reviewForm.text) return;
    await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reviewForm, type: 'product', product_id: productId })
    });
    setReviewSubmitted(true);
    setShowReviewForm(false);
    setReviewForm(EMPTY_FORM);
  }

  return (
    <div className="product-reviews" ref={ref}>
      <div className="product-reviews-header">
        <h2>ביקורות על המוצר</h2>
        <button className="add-review-btn" onClick={() => setShowReviewForm(!showReviewForm)}>
          {showReviewForm ? <><X size={18} aria-hidden="true" /> סגור</> : <><PenLine size={18} aria-hidden="true" /> כתוב ביקורת</>}
        </button>
      </div>

      {showReviewForm && (
        <div className="review-form-wrap">
          {reviewSubmitted ? (
            <div className="review-submitted"><span><CheckCircle size={40} aria-hidden="true" /></span><p>תודה! הביקורת תפורסם לאחר אישור.</p></div>
          ) : (
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <div className="review-form-fields">
                <div className="review-field">
                  <label>שמך *</label>
                  <input placeholder="ישראל ישראלי" value={reviewForm.reviewer_name}
                    onChange={e => setReviewForm({...reviewForm, reviewer_name: e.target.value})} required />
                </div>
                <div className="review-field">
                  <label>דירוג *</label>
                  <Stars rating={reviewForm.rating} interactive onRate={r => setReviewForm({...reviewForm, rating: r})} />
                </div>
                <div className="review-field full">
                  <label>הביקורת שלך *</label>
                  <textarea placeholder="מה דעתך על המוצר?" rows={3} value={reviewForm.text}
                    onChange={e => setReviewForm({...reviewForm, text: e.target.value})} required />
                </div>
              </div>
              <button type="submit" className="review-submit-btn"><CheckCircle size={18} aria-hidden="true" /> שלח ביקורת</button>
            </form>
          )}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="no-product-reviews">אין ביקורות עדיין — היה הראשון!</p>
      ) : (
        <div className="product-reviews-list">
          {reviews.map(r => (
            <div key={r.id} className="product-review-item">
              <div className="product-review-top">
                <div className="reviewer-avatar">{r.reviewer_name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="reviewer-name">{r.reviewer_name}</div>
                  <div className="review-date">{new Date(r.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <Stars rating={r.rating} />
              </div>
              <p className="product-review-text">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductReviewsSection;
