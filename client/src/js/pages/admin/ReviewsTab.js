/**
 * לשונית חוות הדעת: הרשימה המלאה, אישור פרסום ומחיקה.
 */
import { AlertTriangle, Store, Package, Star, CheckCircle, Check } from 'lucide-react';

/** מציג את לשונית חוות הדעת. */
function ReviewsTab({ reviews, onApprove, onDelete, reviewsError }) {
  return (
    <div className="admin-reviews">
      <p className="admin-tab-summary">
        סה"כ {reviews.length} ביקורות • {reviews.filter(r => !r.approved).length} ממתינות לאישור
      </p>
      {reviewsError && <div className="admin-error"><AlertTriangle size={18} aria-hidden="true" /> {reviewsError}</div>}
      {reviews.length === 0 ? <div className="admin-empty">אין ביקורות עדיין</div> : (
        <div className="reviews-admin-list">
          {reviews.map(review => (
            <div key={review.id} className={`review-admin-card ${!review.approved ? 'pending' : ''}`}>
              <div className="review-admin-top">
                <div>
                  <strong>{review.reviewer_name}</strong>
                  <span className="review-admin-type">{review.type === 'store' ? <><Store size={16} aria-hidden="true" /> חנות</> : <><Package size={16} aria-hidden="true" /> {review.product_name || 'מוצר'}</>}</span>
                  <span className="review-admin-date">{new Date(review.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <div className="stars">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`star ${s <= review.rating ? 'filled' : ''}`}>
                      <Star size={18} fill={s <= review.rating ? 'currentColor' : 'none'} aria-hidden="true" />
                    </span>
                  ))}
                </div>
              </div>
              <p className="review-admin-text">{review.text}</p>
              <div className="review-admin-actions">
                {!review.approved ? (
                  <button type="button" className="review-approve-btn" onClick={() => onApprove(review.id)}><CheckCircle size={18} aria-hidden="true" /> אשר פרסום</button>
                ) : (
                  <span className="review-approved-badge"><Check size={16} aria-hidden="true" /> מפורסם</span>
                )}
                <button type="button" className="review-delete-btn" onClick={() => onDelete(review.id)}>מחק</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewsTab;
