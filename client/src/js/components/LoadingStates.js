/**
 * רכיבי מצב טעינה: שלדי כרטיסים וספינר.
 */
/**
 * מציג שלד טעינה של כרטיס מוצר.
 *
 * הצורה היא של ProductCard: חלון תמונה ריבועי, שתי שורות טקסט ושורת
 * מחיר עם ריבוע הכפתור בצידה. שלד שאינו בצורת מה שיבוא אחריו גורם
 * לעמוד לקפוץ ברגע שהנתונים מגיעים.
 */
export function ProductCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image" />
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-line skeleton-line--short" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton-card-foot">
          <div className="skeleton skeleton-price" />
          <div className="skeleton skeleton-btn" />
        </div>
      </div>
    </div>
  );
}

/** מציג שלד טעינה של כרטיס קטגוריה. */
export function CategoryCardSkeleton() {
  return <div className="skeleton skeleton-category-card" />;
}

/** מציג ספינר טעינה בגודל ובצבע הנתונים. */
export function Spinner({ size = 'medium', color = 'white' }) {
  return (
    <span className={`spinner spinner-${size} spinner-${color}`} />
  );
}