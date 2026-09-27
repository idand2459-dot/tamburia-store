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
 * כתמיד, היא לא הייתה שלנו מלכתחילה.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductPage from '../../pages/ProductPage';
import NotFoundPage from '../../pages/NotFoundPage';
import { ProductCardSkeleton } from '../../components/LoadingStates';
import { useStore } from '../../context/storeContext';

/** טוען את המוצר לפי המזהה שבכתובת ומציג אותו. */
function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useStore();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setProduct(null);

    // מזהה שאינו מספר חוסך פנייה לשרת.
    if (!/^\d+$/.test(id)) {
      setStatus('missing');
      return;
    }

    fetch(`/api/products/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('missing'); });

    return () => { cancelled = true; };
  }, [id]);

  if (status === 'missing') return <NotFoundPage />;

  if (status === 'loading') {
    return (
      <main className="product-page">
        {/* אותה רשת שהקטגוריה משתמשת בה, כי אותו שלד יושב בה. */}
        <div className="product-grid">
          {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </main>
    );
  }

  return (
    <ProductPage
      product={product}
      onAddToCart={addToCart}
      onSelectProduct={(next) => navigate(`/product/${next.id}`)}
    />
  );
}

export default ProductView;
