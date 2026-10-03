/**
 * דירוג בכוכבים, לקריאה או לבחירה.
 *
 * קובץ נפרד ולא פונקציה בתוך אחד הרכיבים, כי כמה צרכנים משתמשים בו:
 * סיכום הדירוג שליד שם המוצר (ProductDetails), רשימת הביקורות והטופס
 * (ProductReviewsSection), וקרוסלת הביקורות בדף הבית.
 *
 * לקורא מסך הכוכבים עצמם אינם אומרים דבר — הם אייקונים. לכן:
 * - לקריאה, השורה כולה היא תמונה אחת עם תווית "דירוג 4 מתוך 5".
 * - לבחירה, כל כוכב הוא כפתור אמיתי, עם שם ("4 כוכבים") ו-aria-pressed.
 *   קודם הם היו span עם onClick, ומקלדת לא יכלה לדרג בכלל.
 */
import { Star } from 'lucide-react';

const LEVELS = [1, 2, 3, 4, 5];

/**
 * מציג חמישה כוכבים לפי דירוג, ומאפשר לדרג כש-interactive דולק.
 * labelledBy הוא המזהה של התווית שמעל, כשהכוכבים הם שדה בטופס.
 */
function Stars({ rating, interactive = false, onRate = null, labelledBy }) {
  if (!interactive) {
    return (
      <div className="stars" role="img" aria-label={`דירוג ${rating} מתוך 5`}>
        {LEVELS.map((s) => (
          <span key={s} className={`star ${s <= rating ? 'filled' : ''}`}>
            <Star size={18} fill={s <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="stars" role="group" aria-labelledby={labelledBy}>
      {LEVELS.map((s) => (
        <button
          key={s}
          type="button"
          className={`star interactive ${s <= rating ? 'filled' : ''}`}
          aria-label={s === 1 ? 'כוכב אחד' : `${s} כוכבים`}
          aria-pressed={s === rating}
          onClick={() => onRate && onRate(s)}
        >
          <Star size={18} fill={s <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default Stars;
