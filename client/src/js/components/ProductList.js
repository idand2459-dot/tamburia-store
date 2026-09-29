/**
 * רשת מוצרים: הרשת, שלדי הטעינה והמצב הריק.
 *
 * שלושת אלה היו כתובים פעמיים — בעמוד הקטגוריה ובשתי הרשתות שבתחתית
 * עמוד המוצר — ומקטע "הכי נמכרים" בעמוד הבית היה כותב אותם בפעם
 * השלישית. הרכיב הזה תצוגתי בלבד: הוא אינו שולף כלום ואינו יודע
 * למה הרשימה שהוא קיבל נראית כך.
 *
 * הפלט זהה למה שכל אחד משני הקוראים ייצר קודם — אותו .product-grid,
 * אותם ProductCard, אותו שלד — ולכן ה-CSS לא השתנה. גם הדריסה
 * הממוקדת ‎.product-related .product-grid ממשיכה לתפוס: הרשת נשארת
 * בתוך ה-section של המוצרים הקשורים.
 */
import ProductCard from './ProductCard';
import Reveal, { stagger } from './Reveal';
import { ProductCardSkeleton } from './LoadingStates';

const DEFAULT_SKELETONS = 8;

/* ברירות המחדל של החשיפה המדורגת הן אלה של עמוד הקטגוריה: מהירות
   מאלה של מקטעי עמוד הבית, כי כאן יש עשרות פריטים ולא ארבעה,
   וההשהיה נעצרת אחרי שמונה כרטיסים כדי שהשורה האחרונה לא תחכה
   שנייה שלמה. */
const REVEAL_DEFAULTS = { variant: 'up', step: 40, max: 320 };

/**
 * מציג רשימת מוצרים ברשת המשותפת.
 *
 * `reveal` הוא true לברירות המחדל שלמעלה, אובייקט לדריסה חלקית שלהן,
 * או ברירת המחדל false — ואז הכרטיס מוצג כמו שהוא, בלי עטיפת חשיפה.
 * `emptyState` הוא הצומת שיוצג במקום הרשת כשאין מוצרים; בלעדיו לא
 * מוצג דבר, כי קורא שאין לו מצב ריק משלו מסתיר את המקטע כולו.
 * `categoryIdFor` מקבל מוצר ומחזיר את הקטגוריה שממנה נלקח אייקון
 * ממלא-המקום, כי לכל קורא יש תשובה אחרת לשאלה הזו.
 * `unavailableIds` מסמן מוצרים שכבר אינם בקטלוג. הוא ריק בכל רשת
 * שנשלפה מהשרת, ורלוונטי רק לרשימות ששמורות אצל הלקוח.
 */
function ProductList({
  products = [],
  loading = false,
  skeletonCount = DEFAULT_SKELETONS,
  emptyState = null,
  categoryIdFor,
  onAddToCart,
  wishlistIds = [],
  onToggleWishlist,
  unavailableIds,
  reveal = false,
}) {
  if (loading) {
    return (
      <div className="product-grid">
        {Array(skeletonCount).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }

  if (products.length === 0) return emptyState;

  const revealOptions = reveal ? { ...REVEAL_DEFAULTS, ...(reveal === true ? {} : reveal) } : null;

  return (
    <div className="product-grid">
      {products.map((product, i) => {
        const cardProps = {
          product,
          categoryId: categoryIdFor ? categoryIdFor(product) : undefined,
          onAddToCart,
          inWishlist: wishlistIds.includes(product.id),
          onToggleWishlist,
          unavailable: Boolean(unavailableIds?.has(product.id)),
        };

        /* הכרטיס עצמו הוא אלמנט החשיפה ולא div סביבו — wrapper היה
           הופך לפריט הרשת ושובר את מידות הכרטיס. */
        return revealOptions ? (
          <Reveal
            as={ProductCard}
            variant={revealOptions.variant}
            delay={stagger(i, revealOptions.step, revealOptions.max)}
            key={product.id}
            {...cardProps}
          />
        ) : (
          <ProductCard key={product.id} {...cardProps} />
        );
      })}
    </div>
  );
}

export default ProductList;
