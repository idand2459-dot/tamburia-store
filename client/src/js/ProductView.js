/**
 * עמוד מוצר: /product/:id
 *
 * זה המסך שהופך קישור ישיר לאפשרי. קודם המוצר הועבר כאובייקט
 * מהרשימה, ולכן פתיחת הכתובת ישירות לא הייתה יכולה לעבוד. כאן
 * המוצר נטען לפי המזהה מ-GET /api/products/:id, כך ש-/product/123
 * עובד גם בטאב חדש, גם ברענון וגם בשיתוף הקישור.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ProductPage from './ProductPage';
import NotFoundPage from './NotFoundPage';
import { ProductCardSkeleton } from './LoadingStates';
import { useStore } from './storeContext';

/** טוען את המוצר לפי המזהה שבכתובת ומציג אותו. */
function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
      <main>
        <div className="products-grid">
          {Array(3).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </main>
    );
  }

  /**
   * חוזר אחורה כשיש לאן. בקישור ישיר אין היסטוריה באתר, ולכן
   * "חזור" עולה לקטגוריה של המוצר במקום להוציא מהאתר.
   */
  function goBack() {
    if (location.key !== 'default') navigate(-1);
    else navigate(product?.category ? `/category/${product.category}` : '/');
  }

  return (
    <ProductPage
      product={product}
      onBack={goBack}
      onAddToCart={addToCart}
      onSelectProduct={(next) => navigate(`/product/${next.id}`)}
    />
  );
}

export default ProductView;
