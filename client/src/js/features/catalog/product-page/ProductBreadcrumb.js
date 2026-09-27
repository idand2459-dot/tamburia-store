/**
 * שביל הניווט שמעל המוצר: ראשי ← קטגוריה ← שם המוצר.
 *
 * שם הקטגוריה נשלף מ-categories.js ולא ממפה מקומית של תרגומים: זה
 * מקור האמת לשמות הקטגוריות, וכל מפה נוספת הייתה נתון שני שצריך
 * לתחזק. מזהה שאינו מוכר פשוט לא מקבל חוליה.
 *
 * הקישורים אמיתיים ולא כפתורים שחוזרים בהיסטוריה, כי בקישור ישיר
 * למוצר אין היסטוריה באתר — חוליית הקטגוריה מובילה ל-/category/:id
 * וגם עובדת בלחיצה אמצעית ובפתיחה בלשונית חדשה.
 */
import { Link } from 'react-router-dom';
import categories from '../categories';

/** מציג את שביל הניווט של המוצר. */
function ProductBreadcrumb({ categoryId, productName }) {
  const category = categories.find((c) => c.id === categoryId);

  return (
    <nav className="breadcrumb" aria-label="מסלול ניווט">
      <Link to="/">ראשי</Link>
      <span className="breadcrumb-sep" aria-hidden="true">←</span>

      {category && (
        <>
          <Link to={`/category/${category.id}`}>{category.name}</Link>
          <span className="breadcrumb-sep" aria-hidden="true">←</span>
        </>
      )}

      <span className="breadcrumb-current" aria-current="page">{productName}</span>
    </nav>
  );
}

export default ProductBreadcrumb;
