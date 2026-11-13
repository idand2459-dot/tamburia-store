/**
 * שתי רשתות המוצרים שבתחתית עמוד המוצר: "מוצרים נוספים מהקטגוריה"
 * ו"צפית לאחרונה".
 *
 * שתיהן מציגות את כרטיס המוצר המשותף (components/ProductCard) באותה
 * רשת שעמוד הקטגוריה משתמש בה — 4 / 3 / 2 עמודות — ולא כרטיס קטן
 * משלהן. הכרטיס הקטן שהיה כאן היה מוצר בתצוגה שנייה: תמונה חתוכה,
 * מחיר אדום ושורת מלאי משלו, וכל תוספת לכרטיס האמיתי (מועדפים,
 * תת-קטגוריה, מספר גרסאות) לא הגיעה אליו.
 *
 * העגלה והמועדפים נשלפים כאן מה-store ולא מגיעים בפרופס, בדיוק כמו
 * בעמוד הקטגוריה: זה מה שהכרטיס צריך, ועמוד המוצר אינו מתווך בזה.
 * Availability of the recently viewed products stays a local hook (useAvailability): it is not
 * shared state, only this component reads it.
 * הניווט הוא הקישור שבתוך הכרטיס עצמו, ולכן אין כאן onSelectProduct.
 *
 * ההבדל בין שתי הרשתות אינו רק בכותרת: "מוצרים נוספים מהקטגוריה"
 * נשלפים מהשרת ולכן הם תמיד מה שנמכר עכשיו, ו"צפית לאחרונה" נקראים
 * מ-localStorage ויכולים להיות צילום של מוצר שהוסתר מאז. רק השנייה
 * נבדקת מול הקטלוג.
 */
import { useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ProductList from '../../../components/ProductList';
import { addItem } from '../../../store/cart/cartActions';
import { toggleWishlist } from '../../../store/wishlist/wishlistActions';
import { selectWishlistIds } from '../../../store/wishlist/wishlistSelectors';
import { useAvailability } from '../../../hooks/useAvailability';

/* לכל היותר ארבעה — שורה אחת על מסך רחב. */
const MAX_ITEMS = 4;

/** מציג רשת אחת של כרטיסי מוצר עם כותרת. */
function RelatedGrid({
  title, items, categoryId, addToCart, wishlistIds, onToggleWishlist, unavailableIds,
}) {
  return (
    <section className="product-related">
      <h2 className="product-related-title">{title}</h2>
      {/* אותה רשת של עמוד הקטגוריה, בלי החשיפה המדורגת: כאן הכרטיסים
          מופיעים מיד, כמו קודם. */}
      <ProductList
        products={items.slice(0, MAX_ITEMS)}
        /* הנצפים לאחרונה נשמרים עם הקטגוריה שלהם, ולכן כל כרטיס מקבל
           את האייקון של עצמו; רשומה שנשמרה לפני זה נופלת לקטגוריה
           שהרשת הזו כולה שייכת לה, ואם אין — בלי אייקון. */
        categoryIdFor={(p) => p.category || categoryId}
        onAddToCart={addToCart}
        wishlistIds={wishlistIds}
        onToggleWishlist={onToggleWishlist}
        unavailableIds={unavailableIds}
      />
    </section>
  );
}

/** מציג את המוצרים מאותה קטגוריה ואת "צפית לאחרונה". */
function RelatedProducts({ recentlyViewed, relatedProducts, categoryId }) {
  const dispatch = useDispatch();
  const wishlistIds = useSelector(selectWishlistIds);
  const addToCart = useCallback((product, quantity) => dispatch(addItem(product, quantity)), [dispatch]);
  const toggleCardWishlist = useCallback((product) => dispatch(toggleWishlist(product)), [dispatch]);

  const recentIds = useMemo(() => recentlyViewed.map((p) => p.id), [recentlyViewed]);
  const unavailableIds = useAvailability(recentIds);

  const shared = {
    addToCart,
    wishlistIds,
    onToggleWishlist: toggleCardWishlist,
  };

  return (
    <>
      {relatedProducts.length > 0 && (
        <RelatedGrid
          title="מוצרים נוספים מהקטגוריה"
          items={relatedProducts}
          categoryId={categoryId}
          {...shared}
        />
      )}

      {recentlyViewed.length > 0 && (
        <RelatedGrid
          title="צפית לאחרונה"
          items={recentlyViewed}
          unavailableIds={unavailableIds}
          {...shared}
        />
      )}
    </>
  );
}

export default RelatedProducts;
