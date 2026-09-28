/**
 * קרוסלת חוות דעת על החנות, עם טופס הוספה.
 */
import { useState, useEffect, useRef } from 'react';
import { Star, X, PenLine, CheckCircle, Loader, Quote, ChevronRight, ChevronLeft } from 'lucide-react';
import reviewsPhoto600 from '../../../assets/images/sections/reviews-photo-600.webp';
import reviewsPhoto1000 from '../../../assets/images/sections/reviews-photo-1000.webp';
import { averageRating } from '../../utils/rating';
import { getReviews } from '../../services/reviewService';

/** מציג את קרוסלת חוות הדעת ואת טופס ההוספה. */
function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ reviewer_name: '', rating: 5, text: '', type: 'store' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    getReviews({ type: 'store' }).then(setReviews).catch(() => {});
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [reviews.length]);

  /** עובר לחוות הדעת הקודמת. */
  function prev() {
    clearInterval(intervalRef.current);
    setCurrent(c => (c === 0 ? reviews.length - 1 : c - 1));
  }

  /** עובר לחוות הדעת הבאה. */
  function next() {
    clearInterval(intervalRef.current);
    setCurrent(c => (c + 1) % reviews.length);
  }

  /** שולח את הטופס לשרת. */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.reviewer_name || !formData.text) return;
    setSubmitting(true);
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setSubmitting(false);
    setSubmitted(true);
    setShowForm(false);
    setFormData({ reviewer_name: '', rating: 5, text: '', type: 'store' });
  }

  /** מציג דירוג בכוכבים, ואופציונלית מאפשר לדרג. */
  function renderStars(rating, interactive = false, onRate = null) {
    return (
      <div className="stars">
        {[1,2,3,4,5].map(s => (
          <span
            key={s}
            className={`star ${s <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
            onClick={() => interactive && onRate && onRate(s)}
          >
            <Star size={18} fill={s <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
          </span>
        ))}
      </div>
    );
  }

  /** ממיר תאריך לתצוגה בעברית. */
  function formatDate(d) {
    return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const avgRating = averageRating(reviews);

  return (
    /* section ולא div: זה מקטע מלא-רוחב בדף הבית, והרקע הבהיר שלו נצבע על
       האלמנט הזה. התוכן יושב ב-.reviews-inner, כמו בשאר המקטעים. */
    <section className="reviews-section">
      <div className="reviews-inner">
        {/* התצלום — לוח ממוסגר לצד הביקורות, לעולם לא מאחוריהן. הוא נושא
            תוכן ולכן יש לו alt ולא aria-hidden. */}
        <div className="reviews-media">
          <img
            className="reviews-photo"
            src={reviewsPhoto1000}
            srcSet={`${reviewsPhoto600} 600w, ${reviewsPhoto1000} 1000w`}
            sizes="(max-width: 900px) calc(100vw - 40px), 400px"
            alt="לחיצת יד בין מוכר ללקוח ליד הדלפק"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* עמודת הטקסט: הכותרת, הטופס והקרוסלה. עטיפה אחת ולא שלושה פריטי
            רשת — הטופס קיים רק כשהוא פתוח, ופריט שמופיע ונעלם אי אפשר
            למקם בשורה קבועה. */}
        <div className="reviews-col">
          <div className="reviews-header">
            <span className="section-pill section-pill--light">ביקורות</span>
            <h2 className="reviews-title">מה לקוחות אומרים עלינו</h2>
            {/* הדירוג והכפתור באותה שורה — שניהם רהיטי המקטע, ולא שתי
                שורות נפרדות */}
            <div className="reviews-header-actions">
              {avgRating && (
                <div className="reviews-avg">
                  <span className="reviews-avg-num">{avgRating}</span>
                  {renderStars(Math.round(avgRating))}
                  <span className="reviews-avg-count">({reviews.length} ביקורות)</span>
                </div>
              )}
              <button className="add-review-btn" onClick={() => setShowForm(!showForm)}>
                {showForm ? <><X size={18} aria-hidden="true" /> סגור</> : <><PenLine size={18} aria-hidden="true" /> כתוב ביקורת</>}
              </button>
            </div>
          </div>

          {/* טופס ביקורת */}
          {showForm && (
            <div className="review-form-wrap">
              {submitted ? (
                <div className="review-submitted">
                  <span><CheckCircle size={40} aria-hidden="true" /></span>
                  <p>תודה! הביקורת שלך התקבלה ותפורסם לאחר אישור.</p>
                </div>
              ) : (
                <form className="review-form" onSubmit={handleSubmit}>
                  <h3>ביקורת על החנות</h3>
                  <div className="review-form-fields">
                    <div className="review-field">
                      <label>שמך *</label>
                      <input placeholder="ישראל ישראלי" value={formData.reviewer_name}
                        onChange={e => setFormData({...formData, reviewer_name: e.target.value})} required />
                    </div>
                    <div className="review-field">
                      <label>דירוג *</label>
                      {renderStars(formData.rating, true, r => setFormData({...formData, rating: r}))}
                    </div>
                    <div className="review-field full">
                      <label>הביקורת שלך *</label>
                      <textarea placeholder="שתף את החוויה שלך..." rows={3}
                        value={formData.text}
                        onChange={e => setFormData({...formData, text: e.target.value})} required />
                    </div>
                  </div>
                  <button type="submit" className="review-submit-btn" disabled={submitting}>
                    {submitting ? <><Loader size={18} aria-hidden="true" /> שולח...</> : <><CheckCircle size={18} aria-hidden="true" /> שלח ביקורת</>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Carousel */}
          {reviews.length === 0 ? (
            <div className="reviews-empty">
              <p>אין ביקורות עדיין — היה הראשון! 😊</p>
            </div>
          ) : (
            <div className="reviews-carousel">
              <button className="carousel-arrow carousel-arrow-right" onClick={prev} aria-label="הביקורת הקודמת">
                <ChevronRight size={20} aria-hidden="true" />
              </button>

              <div className="reviews-track">
                {reviews.map((review, i) => (
                  <div
                    key={review.id}
                    className={`review-card ${i === current ? 'active' : i === (current + 1) % reviews.length ? 'next' : i === (current - 1 + reviews.length) % reviews.length ? 'prev' : 'hidden'}`}
                  >
                    <div className="review-card-top">
                      <div className="reviewer-avatar">
                        {review.reviewer_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="reviewer-name">{review.reviewer_name}</div>
                        <div className="review-date">{formatDate(review.created_at)}</div>
                      </div>
                      <div className="review-card-stars">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    {/* הגרשיים שהיו סביב הטקסט הוחלפו בסימן הציטוט הזה: שניהם
                        אמרו את אותו דבר, והאייקון אומר אותו בלי להיכנס לטקסט. */}
                    <Quote className="review-quote-mark" size={18} aria-hidden="true" />
                    <p className="review-text">{review.text}</p>
                  </div>
                ))}
              </div>

              <button className="carousel-arrow carousel-arrow-left" onClick={next} aria-label="הביקורת הבאה">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>

              {/* Dots */}
              <div className="carousel-dots">
                {reviews.map((_, i) => (
                  <button key={i} className={`carousel-dot ${i === current ? 'active' : ''}`}
                    aria-label={`ביקורת ${i + 1}`}
                    aria-current={i === current ? 'true' : undefined}
                    onClick={() => { clearInterval(intervalRef.current); setCurrent(i); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ReviewsCarousel;