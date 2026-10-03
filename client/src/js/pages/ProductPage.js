/**
 * עמוד מוצר: /product/:id
 *
 * זה המסך שהופך קישור ישיר לאפשרי. קודם המוצר הועבר כאובייקט
 * מהרשימה, ולכן פתיחת הכתובת ישירות לא הייתה יכולה לעבוד. כאן
 * המוצר נטען לפי המזהה מ-GET /api/products/:id, כך ש-/product/123
 * עובד גם בטאב חדש, גם ברענון וגם בשיתוף הקישור.
 *
 * אין כאן יותר פונקציית "חזור": כפתור החזרה הכבד שמעל המוצר הוחלף
 * בשביל ניווט, וחוליית הקטגוריה שבו היא בדיוק מה שאותה פונקציה
 * עשתה בקישור ישיר — /category/:id. מחוות ה"חזור" של הדפדפן עובדת
 * כתמיד, היא לא הייתה שלנו מלכתחילה. גם המעבר למוצר אחר אינו עובר
 * יותר כאן: הכרטיסים שבתחתית העמוד הם קישורים אמיתיים.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProductDetails from '../features/catalog/product-page/ProductDetails';
import NotFoundPage from './NotFoundPage';
import { ProductCardSkeleton } from '../components/LoadingStates';
import { useStore } from '../context/storeContext';
import { getProduct, isAbortError } from '../services/productService';

/** טוען את המוצר לפי המזהה שבכתובת ומציג אותו. */
function ProductPage() {
  const { id } = useParams();
  const { addToCart } = useStore();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setProduct(null);

    // מזהה שאינו מספר חוסך פנייה לשרת.
    if (!/^\d+$/.test(id)) {
      setStatus('missing');
      return undefined;
    }

    getProduct(id, { signal: controller.signal })
      .then((data) => {
        setProduct(data);
        setStatus('ready');
      })
      // כל כישלון שאינו ביטול מוביל לאותו מסך: 404 מהשרת, תקלה בו
      // או רשת שנפלה. isNotFound קיים בשירות למי שיצטרך להפריד,
      // אבל כאן אין לקורא מה לעשות עם ההבדל.
      .catch((err) => { if (!isAbortError(err)) setStatus('missing'); });

    return () => controller.abort();
  }, [id]);

  if (status === 'missing') return <NotFoundPage />;

  if (status === 'loading') {
    return (
      <div className="product-page">
        {/* אותה רשת שהקטגוריה משתמשת בה, כי אותו שלד יושב בה. */}
        <div className="product-grid">
          {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return <ProductDetails product={product} onAddToCart={addToCart} />;
}

export default ProductPage;
