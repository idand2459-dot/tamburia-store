/**
 * המסגרת של החנות: נאבאר, כרזה, פוטר והכפתורים הצפים, סביב ה-Outlet.
 *
 * העגלה, איתור ההזמנות והמועדפים הם חלונות מודאליים שנפתחים לפי
 * הכתובת ולא לפי מצב מקומי. זה מה שנותן להם כתובת אמיתית בלי לשנות
 * את העיצוב: /cart מציג את המודאל מעל עמוד הבית, וכפתור "חזור"
 * בדפדפן פשוט סוגר אותו, כי הוא חוזר לכתובת הקודמת.
 */
import { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
import Navbar from './components/Navbar';
import MarqueeBanner from './components/MarqueeBanner';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ScrollToTop from './components/ScrollToTop';
import PaintCalcBtn from './features/calculators/PaintCalcBtn';
import CartModal from './features/cart/CartModal';
import OrderHistory from './features/cart/OrderHistory';
import Wishlist from './features/cart/Wishlist';
import { useStore } from './context/storeContext';

/**
 * מסמן על ה-body שמגירה פתוחה, כדי שה-CSS יסתיר את הכפתורים הצפים.
 *
 * ארבע המגירות מסומנות באותו דגל: התפריט, העגלה, איתור ההזמנות
 * והמועדפים. כולן מכסות את המסך מהצד, וכל כפתור צף שנשאר מעליהן הוא
 * מכשול — בטלפון אופקי כפתור מחשבון הצבע יושב בדיוק על "צור קשר"
 * שבתפריט, ובולע את הלחיצה.
 *
 * ההסתרה היא ב-CSS ולא ברינדור מותנה, כדי שתהיה עמימה קצרה בכניסה
 * וביציאה במקום היעלמות בפריים אחד (components/_buttons.css).
 */
function useDrawerBodyClass(open) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('has-drawer');
    return () => document.body.classList.remove('has-drawer');
  }, [open]);
}

const OVERLAY_PATHS = ['/cart', '/checkout', '/orders/lookup', '/wishlist'];

/** האם הכתובת היא של מודאל, שמוצג מעל העמוד ולא במקומו. */
function isOverlayPath(pathname) {
  return OVERLAY_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * מגלל לראש העמוד בכל מעבר כתובת, למעט פתיחת מודאל, ומעביר את
 * המיקוד ל-<main>.
 *
 * המיקוד הוא בשביל קורא מסך ומקלדת: בלעדיו, אחרי לחיצה על קישור
 * בניווט המיקוד נשאר על הקישור, והקורא לא אומר דבר על כך שהעמוד
 * התחלף. לא בטעינה הראשונה — שם קישור "דלג לתוכן" צריך להיות התחנה
 * הראשונה. וגם לא ביציאה ממודאל: שם המגירה מחזירה את המיקוד לכפתור
 * שפתח אותה, וזה המקום הנכון.
 */
function useScrollToTopOnNavigate(pathname) {
  const previous = useRef(null);
  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (isOverlayPath(pathname)) return;
    window.scrollTo(0, 0);
    if (from === null || isOverlayPath(from)) return;
    document.getElementById('main-content')?.focus({ preventScroll: true });
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
  useDrawerBodyClass(
    store.menuOpen || onCart || onCheckout || onOrderLookup || onWishlist,
  );

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

  const overlayOpen = onCart || onCheckout || onOrderLookup || onWishlist;

  return (
    <div className="App">
      {/* כל מה שמאחורי המודאל. inert כשמודאל פתוח: קורא המסך לא רואה את
          העמוד שמאחור, ו-Tab לא מגיע אליו. display: contents, כך שהעטיפה
          לא משנה דבר בפריסה. */}
      <div className="store-frame" inert={overlayOpen || undefined}>
        <a className="skip-link" href="#main-content">דלג לתוכן</a>
        <Navbar />

        {/* כשהתפריט פתוח הוא לבדו פעיל, כמו המגירות */}
        <div className="store-frame" inert={store.menuOpen || undefined}>
          <MarqueeBanner />

          <main id="main-content" tabIndex={-1}>
            <Outlet />
          </main>

          <Footer />

          {/* הכפתורים הצפים, באזור משלהם כדי שקורא מסך ימצא אותם — הם
              יושבים מחוץ ל-main ולפוטר. display: contents, כמו העטיפות. */}
          <aside className="store-frame" aria-label="פעולות מהירות">
            <WhatsAppButton />
            <ScrollToTop />
            {/* בלי menuOpen: הכפתור לא זז יותר כדי לפנות מקום לתפריט, אלא
                נעלם איתו ככל הכפתורים הצפים (useDrawerBodyClass למעלה). */}
            {location.pathname === '/' && <PaintCalcBtn />}
          </aside>
        </div>
      </div>

      {(onCart || onCheckout) && (
        <CartModal
          cartStep={cartStep}
          setCartStep={goToCartStep}
          closeCart={() => { store.clearOrderSuccess(); closeOverlay(); }}
        />
      )}

      {onOrderLookup && <OrderHistory onClose={closeOverlay} />}

      {/* הניווט לעמוד מוצר הוא קישור בתוך החלון עצמו, ולכן אין כאן
          onSelectProduct: מעבר הכתובת הוא גם הסגירה. */}
      {onWishlist && <Wishlist onClose={closeOverlay} />}
    </div>
  );
}

export default StoreLayout;
