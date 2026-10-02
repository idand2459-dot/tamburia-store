/**
 * קרוסלת חוות דעת על החנות, עם טופס הוספה.
 */
import { useState, useEffect, useRef } from 'react';
import { X, PenLine, CheckCircle, AlertCircle, Loader, Quote, ChevronRight, ChevronLeft, Pause, Play } from 'lucide-react';
import Stars from './product-page/Stars';
import reviewsPhoto600 from '../../../assets/images/sections/reviews-photo-600.webp';
import reviewsPhoto1000 from '../../../assets/images/sections/reviews-photo-1000.webp';
import { averageRating } from '../../utils/rating';
import { getReviews } from '../../services/reviewService';
import { useReviewSubmit } from '../../hooks/useReviewSubmit';

const EMPTY_FORM = { reviewer_name: '', rating: 5, text: '', type: 'store' };

/** מציג את קרוסלת חוות הדעת ואת טופס ההוספה. */
function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const intervalRef = useRef(null);

  // ההחלפה האוטומטית. WCAG 2.2.2: תוכן שזז מעצמו יותר מחמש שניות
  // צריך דרך לעצור אותו, ולכן יש כפתור השהיה. מי שביקש תנועה מופחתת
  // מתחיל במצב עצור. hovering ו-focused עוצרים זמנית, כדי שהביקורת לא
  // תתחלף מתחת למי שקורא אותה או מתחת למיקוד.
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);

  /* הניקוי הוא של ההצלחה בלבד: בכישלון הטופס נשאר כמו שהוא, כי מה
     שהלקוח כתב הוא הדבר היחיד כאן שאי אפשר לשחזר. */
  const { submitting, error, submit, clearError } = useReviewSubmit(() => {
    setSubmitted(true);
    setFormData(EMPTY_FORM);
  });

  useEffect(() => {
    getReviews({ type: 'store' }).then(setReviews).catch(() => {});
  }, []);

  useEffect(() => {
    if (reviews.length <= 1 || !playing || hovering || focused) return undefined;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [reviews.length, playing, hovering, focused]);

  /* מעבר ידני עוצר את ההחלפה האוטומטית לגמרי, כמו קודם — אבל עכשיו
     דרך playing, כך שכפתור ההשהיה מראה את המצב האמיתי. */

  /** עובר לחוות הדעת הקודמת. */
  function prev() {
    setPlaying(false);
    setCurrent(c => (c === 0 ? reviews.length - 1 : c - 1));
  }

  /** עובר לחוות הדעת הבאה. */
  function next() {
    setPlaying(false);
    setCurrent(c => (c + 1) % reviews.length);
  }

  /**
   * שולח את הטופס לשרת.
   *
   * הטופס נשאר פתוח: התודה מוצגת *במקומו*, בתוך אותה מסגרת. קודם
   * השליחה כיבתה את showForm, והמסגרת נעלמה עם ההודעה שבתוכה — כך
   * שגם הצלחה לא אמרה דבר. זה בדיוק מה שתוקן בעמוד המוצר.
   */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.reviewer_name || !formData.text) return;
    await submit(formData);
  }

  /** פותח או סוגר את הטופס. פתיחה מתחילה בלי שגיאה ובלי תודה ישנה. */
  function toggleForm() {
    if (showForm) {
      setShowForm(false);
      return;
    }
    setSubmitted(false);
    clearError();
    setShowForm(true);
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
                  <Stars rating={Math.round(avgRating)} />
                  <span className="reviews-avg-count">({reviews.length} ביקורות)</span>
                </div>
              )}
              <button className="add-review-btn" onClick={toggleForm}>
                {showForm ? <><X size={18} aria-hidden="true" /> סגור</> : <><PenLine size={18} aria-hidden="true" /> כתוב ביקורת</>}
              </button>
            </div>
          </div>

          {/* טופס ביקורת */}
          {showForm && (
            <div className="review-form-wrap">
              {submitted ? (
                <div className="review-submitted" role="status">
                  <span><CheckCircle size={40} aria-hidden="true" /></span>
                  <p>תודה! הביקורת שלך התקבלה ותפורסם לאחר אישור.</p>
                </div>
              ) : (
                <form className="review-form" onSubmit={handleSubmit}>
                  <h3>ביקורת על החנות</h3>
                  <div className="review-form-fields">
                    <div className="review-field">
                      <label htmlFor="store-review-name">שמך <span aria-hidden="true">*</span></label>
                      <input id="store-review-name" placeholder="ישראל ישראלי" value={formData.reviewer_name}
                        autoComplete="name"
                        onChange={e => setFormData({...formData, reviewer_name: e.target.value})} required />
                    </div>
                    <div className="review-field">
                      <span className="review-field-label" id="store-review-rating">דירוג</span>
                      <Stars rating={formData.rating} interactive labelledBy="store-review-rating"
                        onRate={r => setFormData({...formData, rating: r})} />
                    </div>
                    <div className="review-field full">
                      <label htmlFor="store-review-text">הביקורת שלך <span aria-hidden="true">*</span></label>
                      <textarea id="store-review-text" placeholder="שתף את החוויה שלך..." rows={3}
                        value={formData.text}
                        onChange={e => setFormData({...formData, text: e.target.value})} required />
                    </div>
                  </div>
                  {error && (
                    <p className="review-error" role="alert">
                      <AlertCircle size={15} aria-hidden="true" /> {error}
                    </p>
                  )}
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
            <div
              className="reviews-carousel"
              role="region"
              aria-roledescription="קרוסלה"
              aria-label="ביקורות לקוחות"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              onFocus={() => setFocused(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
            >
              <button className="carousel-arrow carousel-arrow-right" onClick={prev} aria-label="הביקורת הקודמת">
                <ChevronRight size={20} aria-hidden="true" />
              </button>

              <div className="reviews-track">
                {reviews.map((review, i) => (
                  <div
                    key={review.id}
                    className={`review-card ${i === current ? 'active' : i === (current + 1) % reviews.length ? 'next' : i === (current - 1 + reviews.length) % reviews.length ? 'prev' : 'hidden'}`}
                    role="group"
                    aria-roledescription="ביקורת"
                    aria-label={`${i + 1} מתוך ${reviews.length}`}
                    aria-hidden={i === current ? undefined : 'true'}
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
                        <Stars rating={review.rating} />
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
                {reviews.length > 1 && (
                  <button
                    type="button"
                    className="carousel-pause"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? 'עצור את החלפת הביקורות' : 'הפעל את החלפת הביקורות'}
                  >
                    {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                  </button>
                )}
                {reviews.map((_, i) => (
                  <button key={i} className={`carousel-dot ${i === current ? 'active' : ''}`}
                    aria-label={`ביקורת ${i + 1}`}
                    aria-current={i === current ? 'true' : undefined}
                    onClick={() => { setPlaying(false); setCurrent(i); }} />
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