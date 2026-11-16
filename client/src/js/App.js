/**
 * שורש האפליקציה: מגדיר את טבלת הניתוב ומחבר אליה את ה-store.
 *
 * The shared storefront state (cart, wishlist, product availability) lives in one classic Redux
 * store, created once per mount and provided here. The state survives a move between URLs
 * because the Provider sits above the routes. The checkout form and the menu state are React
 * state of StoreLayout (the component that stays mounted across all storefront routes).
 *
 * מסך הניהול נטען בעצלתיים (React.lazy): הקוד שלו — הלשוניות, ההוקים
 * שלהן והקונפטי — יושב ב-chunk נפרד שהדפדפן מוריד רק כשנכנסים ל-/admin.
 * לקוח בחנות לא מוריד אותו בכלל. ה-CSS של הניהול נשאר בקובץ הראשי: סדר
 * ה-imports ב-css/app.css הוא ה-cascade, והוצאת חלק ממנו הייתה משנה אותו.
 */
import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import '../css/app.css';
import { createAppStore } from './store';
import { checkAvailability } from './store/availability/availabilityActions';
import { selectAvailabilityKey } from './store/availability/availabilitySelectors';
import StoreLayout from './StoreLayout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import NotFoundPage from './pages/NotFoundPage';
import About from './pages/About';
import Contact from './pages/Contact';
import Returns from './pages/Returns';
import Accessibility from './pages/Accessibility';

const AdminRoute = lazy(() => import('./routes/AdminRoute'));

/**
 * מה שמוצג בזמן שקוד הניהול יורד: אותו רקע ריק ש-AdminRoute מציג בזמן
 * בדיקת ההתחברות, כדי שלא יהבהב מסך אחר בדרך. role=status מודיע לקורא
 * מסך שמשהו נטען.
 */
const adminLoading = (
  <div className="admin-login-page" role="status" aria-label="טוען את מסך הניהול" />
);

/**
 * The routes. It also keeps the cart fresh: the cart can hold a snapshot of a product that was
 * hidden, sold out or re-priced since (it is saved in localStorage), so the store asks the server
 * about the cart's products on the first load, whenever the set of ids changes, on entering the
 * cart or the checkout, and when the tab becomes visible again. This runs whether or not the cart
 * drawer is open, so the marks are ready when it opens.
 */
function AppRoutes() {
  const dispatch = useDispatch();
  const availabilityKey = useSelector(selectAvailabilityKey);
  const { pathname } = useLocation();

  // The cart is checked again whenever the customer comes back to the tab, and on entering the cart
  // or the checkout (the screens where a stale price or product matters). "Visible" only counts up
  // on the event, so nothing loops: the check changes prices and blocked lines, never the ids.
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    /** Counts the moments the tab becomes visible again. */
    function onVisibility() {
      if (document.visibilityState === 'visible') setVisibleCount((count) => count + 1);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  const cartScreen = pathname === '/cart' || pathname === '/checkout' ? pathname : '';

  // One effect, so the first load, a change of the ids, entering a cart screen and coming back to
  // the tab each start one request, and each aborts the one before it. The thunk returns the
  // function that aborts the request, which is exactly the effect cleanup.
  useEffect(
    () => dispatch(checkAvailability(availabilityKey)),
    [dispatch, availabilityKey, cartScreen, visibleCount],
  );

  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="returns" element={<Returns />} />
        <Route path="accessibility" element={<Accessibility />} />

        {/* מודאלים עם כתובת — המסגרת מציגה אותם מעל עמוד הבית */}
        <Route path="cart" element={<HomePage />} />
        <Route path="checkout" element={<HomePage />} />
        <Route path="wishlist" element={<HomePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
      <Route
        path="/admin/:tab"
        element={<Suspense fallback={adminLoading}><AdminRoute /></Suspense>}
      />
    </Routes>
  );
}

/** מציג את האפליקציה: ה-store של החנות והניתוב. */
function App() {
  // One store per mount, read from localStorage once, like the hooks it replaced.
  const [store] = useState(() => createAppStore());

  return (
    <Provider store={store}>
      <AppRoutes />
    </Provider>
  );
}

export default App;
