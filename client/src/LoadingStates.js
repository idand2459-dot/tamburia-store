// Skeleton לקארד מוצר
export function ProductCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-price" />
      <div className="skeleton skeleton-btn" />
    </div>
  );
}

// Skeleton לקארד קטגוריה
export function CategoryCardSkeleton() {
  return <div className="skeleton skeleton-category-card" />;
}

// Spinner כללי
export function Spinner({ size = 'medium', color = 'white' }) {
  return (
    <span className={`spinner spinner-${size} spinner-${color}`} />
  );
}