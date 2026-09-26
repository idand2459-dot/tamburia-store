/**
 * דירוג בכוכבים, לקריאה או לבחירה.
 *
 * קובץ נפרד ולא פונקציה בתוך אחד הרכיבים, כי שני צרכנים משתמשים בו
 * בשני מקומות שונים בעמוד: סיכום הדירוג שליד שם המוצר (ProductPage)
 * ורשימת הביקורות והטופס (ProductReviewsSection). שכפול של אותה
 * חמישיית כוכבים בשני קבצים היה הפתרון היחיד האחר.
 */
import { Star } from 'lucide-react';

/** מציג חמישה כוכבים לפי דירוג, ומאפשר לדרג כש-interactive דולק. */
function Stars({ rating, interactive = false, onRate = null }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`star ${s <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
          onClick={() => interactive && onRate && onRate(s)}>
          <Star size={18} fill={s <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

export default Stars;
