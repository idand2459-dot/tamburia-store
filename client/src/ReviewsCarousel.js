import { useState, useEffect, useRef } from 'react';

function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ reviewer_name: '', rating: 5, text: '', type: 'store' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch('/api/reviews?type=store')
      .then(r => r.json())
      .then(data => setReviews(data))
      .catch(() => {});
  }, []);

  // גלילה אוטומטית
  useEffect(() => {
    if (reviews.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [reviews.length]);

  function prev() {
    clearInterval(intervalRef.current);
    setCurrent(c => (c === 0 ? reviews.length - 1 : c - 1));
  }

  function next() {
    clearInterval(intervalRef.current);
    setCurrent(c => (c + 1) % reviews.length);
  }

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

  function renderStars(rating, interactive = false, onRate = null) {
    return (
      <div className="stars">
        {[1,2,3,4,5].map(s => (
          <span
            key={s}
            className={`star ${s <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
            onClick={() => interactive && onRate && onRate(s)}
          >★</span>
        ))}
      </div>
    );
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ממוצע דירוגים
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <div className="reviews-header-text">
          <h2>מה לקוחות אומרים עלינו</h2>
          {avgRating && (
            <div className="reviews-avg">
              <span className="reviews-avg-num">{avgRating}</span>
              {renderStars(Math.round(avgRating))}
              <span className="reviews-avg-count">({reviews.length} ביקורות)</span>
            </div>
          )}
        </div>
        <button className="add-review-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ סגור' : '✍️ כתוב ביקורת'}
        </button>
      </div>

      {/* טופס ביקורת */}
      {showForm && (
        <div className="review-form-wrap">
          {submitted ? (
            <div className="review-submitted">
              <span>🎉</span>
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
                {submitting ? '⏳ שולח...' : '✅ שלח ביקורת'}
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
          <button className="carousel-arrow carousel-arrow-right" onClick={prev}>‹</button>

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
                <p className="review-text">"{review.text}"</p>
              </div>
            ))}
          </div>

          <button className="carousel-arrow carousel-arrow-left" onClick={next}>›</button>

          {/* Dots */}
          <div className="carousel-dots">
            {reviews.map((_, i) => (
              <button key={i} className={`carousel-dot ${i === current ? 'active' : ''}`}
                onClick={() => { clearInterval(intervalRef.current); setCurrent(i); }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewsCarousel;