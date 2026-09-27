/**
 * המסגרת של החנות: נאבאר, כרזה, פוטר והכפתורים הצפים, סביב ה-Outlet.
 *
 * העגלה, איתור ההזמנות והמועדפים הם חלונות מודאליים שנפתחים לפי
 * הכתובת ולא לפי מצב מקומי. זה מה שנותן להם כתובת אמיתית בלי לשנות
 * את העיצוב: /cart מציג את המודאל מעל עמוד הבית, וכפתור "חזור"
 * בדפדפן פשוט סוגר אותו, כי הוא חוזר לכתובת הקודמת.
 */
import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
import Navbar from './components/Navbar';
import MarqueeBanner from './components/MarqueeBanner';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ScrollToTop from './components/ScrollToTop';
import PaintCalcBtn from './features/calculator/PaintCalcBtn';
import CartModal from './components/cart/CartModal';
import OrderHistory from './pages/OrderHistory';
import Wishlist from './pages/Wishlist';
import { useStore } from './context/storeContext';

/** מגלל לראש העמוד בכל מעבר כתובת, למעט פתיחת מודאל. */
function useScrollToTopOnNavigate(pathname) {
  useEffect(() => {
    const isOverlay = ['/cart', '/checkout', '/orders/lookup', '/wishlist']
      .some((p) => pathname.startsWith(p));
    if (!isOverlay) window.scrollTo(0, 0);
  }, [pathname]);
}

/** מציג את מסגרת החנות ואת המסך הפעיל. */
function StoreLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useStore();

  const onCart = Boolean(useMatch('/cart'));
  const onCheckout = Boolean(useMatch('/checkout'));
  const onOrderLookup = Boolean(useMatch('/orders/lookup'));
  const onWishlist = Boolean(useMatch('/wishlist'));

  useScrollToTopOnNavigate(location.pathname);

  /**
   * סוגר מודאל. חוזר אחורה כשיש לאן, ואחרת עולה לעמוד הבית — כך
   * שסגירה של קישור ישיר ל-/cart לא מוציאה מהאתר.
   */
  function closeOverlay() {
    if (location.key === 'default') navigate('/');
    else navigate(-1);
  }

  const cartStep = store.orderSuccess && onCheckout
    ? 'success'
    : onCheckout ? 'details' : 'cart';

  /**
   * מעביר בין שלבי העגלה דרך הכתובת.
   * קדימה (עגלה → פרטים) מוסיף רשומה להיסטוריה, כדי ש"חזור" בדפדפן
   * יחזיר לעגלה. אחורה נעשה בחזרה בהיסטוריה ולא בדחיפה של /cart,
   * אחרת נוצרות שתי רשומות של אותה עגלה ו"חזור" היה מחזיר לטופס.
   */
  function goToCartStep(step) {
    if (step === 'details') {
      navigate('/checkout');
      return;
    }
    if (onCheckout && location.key !== 'default') navigate(-1);
    else navigate('/cart');
  }

  return (
    <div className="App">
      <Navbar />
      <MarqueeBanner />

      <Outlet />

      <Footer />

      {(onCart || onCheckout) && (
        <CartModal
          cartStep={cartStep}
          setCartStep={goToCartStep}
          closeCart={() => { store.clearOrderSuccess(); closeOverlay(); }}
        />
      )}

      {onOrderLookup && <OrderHistory onClose={closeOverlay} />}

      {onWishlist && (
        <Wishlist
          onClose={closeOverlay}
          onSelectProduct={(product) => navigate(`/product/${product.id}`)}
        />
      )}

      <WhatsAppButton />
      <ScrollToTop />
      {location.pathname === '/' && <PaintCalcBtn menuOpen={store.menuOpen} />}
    </div>
  );
}

export default StoreLayout;
