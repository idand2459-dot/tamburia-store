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
import Navbar from './Navbar';
import MarqueeBanner from './MarqueeBanner';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import ScrollToTop from './ScrollToTop';
import PaintCalcBtn from './PaintCalcBtn';
import CartModal from './CartModal';
import OrderHistory from './OrderHistory';
import Wishlist from './Wishlist';
import { useStore } from './storeContext';

/** ממפה נתיב לכתובת, עבור ה-API הקיים של הנאבאר והפוטר. */
const PATHS = { home: '/', about: '/about', contact: '/contact', returns: '/returns' };

/** מחזיר את המפתח שהנאבאר מסמן כפעיל, לפי הכתובת. */
function currentPageOf(pathname) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/about')) return 'about';
  if (pathname.startsWith('/contact')) return 'contact';
  if (pathname.startsWith('/returns')) return 'returns';
  return '';
}

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

  const categoryMatch = useMatch('/category/:slug');
  const onCart = Boolean(useMatch('/cart'));
  const onCheckout = Boolean(useMatch('/checkout'));
  const onOrderLookup = Boolean(useMatch('/orders/lookup'));
  const onWishlist = Boolean(useMatch('/wishlist'));

  useScrollToTopOnNavigate(location.pathname);

  const categorySlug = categoryMatch?.params.slug;
  const rootClass = categorySlug
    ? `App cat-bg cat-bg-${categorySlug}`
    : 'App';

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
    <div className={rootClass}>
      <Navbar
        currentPage={currentPageOf(location.pathname)}
        onNavigate={(page) => navigate(PATHS[page] || '/')}
        onSelectProduct={(product) => navigate(`/product/${product.id}`)}
        cartCount={store.cartCount}
        total={store.total}
        onOpenCart={() => navigate('/cart')}
        menuOpen={store.menuOpen}
        setMenuOpen={store.setMenuOpen}
        onOpenOrderHistory={() => navigate('/orders/lookup')}
        onOpenWishlist={() => navigate('/wishlist')}
      />
      <MarqueeBanner />

      <Outlet />

      <Footer
        onNavigate={(page) => navigate(PATHS[page] || '/')}
        onSelectCategory={(category) => navigate(`/category/${category.id}`)}
      />

      {(onCart || onCheckout) && (
        <CartModal
          cart={store.cart}
          setCart={store.setCart}
          cartStep={cartStep}
          setCartStep={goToCartStep}
          closeCart={() => { store.clearOrderSuccess(); closeOverlay(); }}
          deliveryMethod={store.deliveryMethod}
          setDeliveryMethod={store.setDeliveryMethod}
          subtotal={store.subtotal}
          deliveryFee={store.deliveryFee}
          total={store.total}
          cartCount={store.cartCount}
          updateQuantity={store.updateQuantity}
          removeFromCart={store.removeFromCart}
          customerName={store.customerName}
          setCustomerName={store.setCustomerName}
          customerPhone={store.customerPhone}
          setCustomerPhone={store.setCustomerPhone}
          customerEmail={store.customerEmail}
          setCustomerEmail={store.setCustomerEmail}
          deliveryAddress={store.deliveryAddress}
          setDeliveryAddress={store.setDeliveryAddress}
          orderNotes={store.orderNotes}
          setOrderNotes={store.setOrderNotes}
          submittingOrder={store.submittingOrder}
          handlePlaceOrder={store.handlePlaceOrder}
          orderSuccess={store.orderSuccess}
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
