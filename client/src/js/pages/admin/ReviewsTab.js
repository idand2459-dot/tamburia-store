/**
 * לשונית חוות הדעת: הרשימה המלאה, אישור פרסום ומחיקה.
 */

/** מציג את לשונית חוות הדעת. */
function ReviewsTab({ reviews, onApprove, onDelete, reviewsError }) {
  return (
    <div>
      <div className="admin-results-info" style={{marginBottom: 20}}>
        סה"כ {reviews.length} ביקורות • {reviews.filter(r => !r.approved).length} ממתינות לאישור
      </div>
      {reviewsError && <div className="admin-error">⚠️ {reviewsError}</div>}
      {reviews.length === 0 ? <div className="admin-empty">אין ביקורות עדיין</div> : (
        <div className="reviews-admin-list">
          {reviews.map(review => (
            <div key={review.id} className={`review-admin-card ${!review.approved ? 'pending' : ''}`}>
              <div className="review-admin-top">
                <div>
                  <strong>{review.reviewer_name}</strong>
                  <span className="review-admin-type">{review.type === 'store' ? '🏪 חנות' : `📦 ${review.product_name || 'מוצר'}`}</span>
                  <span className="review-admin-date">{new Date(review.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <div className="stars">
                  {[1,2,3,4,5].map(s => <span key={s} className={`star ${s <= review.rating ? 'filled' : ''}`}>★</span>)}
                </div>
              </div>
              <p className="review-admin-text">{review.text}</p>
              <div className="review-admin-actions">
                {!review.approved ? (
                  <button className="review-approve-btn" onClick={() => onApprove(review.id)}>✅ אשר פרסום</button>
                ) : (
                  <span className="review-approved-badge">✓ מפורסם</span>
                )}
                <button className="delete-btn" onClick={() => onDelete(review.id)}>מחק</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewsTab;
