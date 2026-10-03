/**
 * חוות הדעת על המוצר: הרשימה וטופס הכתיבה.
 *
 * הרשימה מגיעה בפרופס ולא נשלפת כאן, כי ProductDetails צריך אותה גם
 * לסיכום הדירוג שליד שם המוצר. מצב הטופס לעומת זה מקומי, ומתאפס
 * במעבר מוצר באפקט משלו — אותו איפוס שהיה קודם באפקט של ההורה.
 *
 * ביקורת שנשלחה אינה מרעננת את הרשימה, כמו קודם: היא מתפרסמת רק
 * לאחר אישור בניהול, ולכן שליפה מחדש לא הייתה מציגה אותה בכל מקרה.
 * מה שכן מוצג הוא התודה: השליחה סוגרת את *הטופס* ולא את המסגרת שבה
 * הוא יושב, ובמקומו נכנסת הודעת האישור. קודם השליחה כיבתה את
 * showReviewForm, ולכן המסגרת נעלמה עם ההודעה שבתוכה ואי אפשר היה
 * להגיע אליה בכלל. פתיחה מחדש של הטופס מאפסת את reviewSubmitted, כדי
 * שמי שכתב ביקורת ורוצה לכתוב עוד אחת יקבל טופס ריק ולא את התודה.
 *
 * ה-ref שמגיע בפרופס יושב על העוטף, ודרכו סיכום הדירוג שליד שם המוצר
 * גולל לכאן. ב-React 19 ref הוא prop רגיל ואין צורך ב-forwardRef.
 *
 * כפתור "כתוב ביקורת" מוצג פעם אחת: בכותרת כשיש ביקורות, ובתוך המצב
 * הריק כשאין — שם הוא ההזמנה עצמה ("היה הראשון"), ושני כפתורים זהים
 * באותו מסך לא היו אומרים יותר מאחד.
 */
import { useState, useEffect } from 'react';
import { X, PenLine, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import Stars from './Stars';
import { averageRating } from '../../../utils/rating';
import { useReviewSubmit } from '../../../hooks/useReviewSubmit';

const EMPTY_FORM = { reviewer_name: '', rating: 5, text: '' };

/** כפתור פתיחת וסגירת טופס הביקורת. */
function ReviewFormToggle({ open, onToggle }) {
  return (
    <button type="button" className="product-reviews-btn" onClick={onToggle}>
      {open
        ? <><X size={16} aria-hidden="true" /> סגור</>
        : <><PenLine size={16} aria-hidden="true" /> כתוב ביקורת</>}
    </button>
  );
}

/** מציג את רשימת חוות הדעת ואת טופס הכתיבה. */
function ProductReviewsSection({ productId, reviews, ref }) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_FORM);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  /* הניקוי הוא של ההצלחה בלבד: בכישלון הטופס נשאר כמו שהוא, כי מה
     שהלקוח כתב הוא הדבר היחיד כאן שאי אפשר לשחזר. */
  const { submitting, error, submit, clearError } = useReviewSubmit(() => {
    setReviewSubmitted(true);
    setReviewForm(EMPTY_FORM);
  });

  useEffect(() => {
    setReviewSubmitted(false);
    setShowReviewForm(false);
  }, [productId]);

  /** שולח חוות דעת חדשה על המוצר. */
  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewForm.reviewer_name || !reviewForm.text) return;
    await submit({ ...reviewForm, type: 'product', product_id: productId });
  }

  const avgRating = averageRating(reviews);

  /** פותח או סוגר את הטופס. פתיחה תמיד מתחילה מטופס נקי. */
  function toggleForm() {
    if (showReviewForm) {
      setShowReviewForm(false);
      return;
    }
    setReviewSubmitted(false);
    clearError();
    setShowReviewForm(true);
  }

  return (
    <div className="product-reviews" ref={ref}>
      <div className="product-reviews-header">
        <div className="product-reviews-heading">
          <h2>ביקורות על המוצר</h2>
          {avgRating && (
            <span className="product-reviews-summary">
              <Stars rating={Math.round(avgRating)} />
              <b>{avgRating}</b>
              <span>({reviews.length})</span>
            </span>
          )}
        </div>

        {reviews.length > 0 && <ReviewFormToggle open={showReviewForm} onToggle={toggleForm} />}
      </div>

      {showReviewForm && (
        <div className="review-form-wrap">
          {reviewSubmitted ? (
            <div className="review-submitted" role="status"><span><CheckCircle size={40} aria-hidden="true" /></span><p>תודה! הביקורת תפורסם לאחר אישור.</p></div>
          ) : (
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <div className="review-form-fields">
                <div className="review-field">
                  <label htmlFor="product-review-name">שמך <span aria-hidden="true">*</span></label>
                  <input id="product-review-name" placeholder="ישראל ישראלי" value={reviewForm.reviewer_name}
                    autoComplete="name"
                    onChange={e => setReviewForm({...reviewForm, reviewer_name: e.target.value})} required />
                </div>
                <div className="review-field">
                  <span className="review-field-label" id="product-review-rating">דירוג</span>
                  <Stars rating={reviewForm.rating} interactive labelledBy="product-review-rating"
                    onRate={r => setReviewForm({...reviewForm, rating: r})} />
                </div>
                <div className="review-field full">
                  <label htmlFor="product-review-text">הביקורת שלך <span aria-hidden="true">*</span></label>
                  <textarea id="product-review-text" placeholder="מה דעתך על המוצר?" rows={3} value={reviewForm.text}
                    onChange={e => setReviewForm({...reviewForm, text: e.target.value})} required />
                </div>
              </div>
              {error && (
                <p className="review-error" role="alert">
                  <AlertCircle size={15} aria-hidden="true" /> {error}
                </p>
              )}
              <button type="submit" className="review-submit-btn" disabled={submitting}>
                {submitting
                  ? <><Loader size={18} aria-hidden="true" /> שולח...</>
                  : <><CheckCircle size={18} aria-hidden="true" /> שלח ביקורת</>}
              </button>
            </form>
          )}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="product-reviews-empty">
          <p>עדיין אין ביקורות — היה הראשון</p>
          <ReviewFormToggle open={showReviewForm} onToggle={toggleForm} />
        </div>
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
