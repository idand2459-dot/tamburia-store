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
 * העגלה והמועדפים נשלפים כאן מההקשר ולא מגיעים בפרופס, בדיוק כמו
 * בעמוד הקטגוריה: זה מה שהכרטיס צריך, ועמוד המוצר אינו מתווך בזה.
 * הניווט הוא הקישור שבתוך הכרטיס עצמו, ולכן אין כאן onSelectProduct.
 *
 * ההבדל בין שתי הרשתות אינו רק בכותרת: "מוצרים נוספים מהקטגוריה"
 * נשלפים מהשרת ולכן הם תמיד מה שנמכר עכשיו, ו"צפית לאחרונה" נקראים
 * מ-localStorage ויכולים להיות צילום של מוצר שהוסתר מאז. רק השנייה
 * נבדקת מול הקטלוג.
 */
import { useMemo } from 'react';
import ProductList from '../../../components/ProductList';
import { useStore } from '../../../context/storeContext';
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
  const { addToCart, wishlistIds, toggleCardWishlist } = useStore();

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
