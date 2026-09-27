/**
 * שורש האפליקציה: מרכיב את המצב המשותף ומגדיר את טבלת הניתוב.
 *
 * המצב יושב כאן ולא בתוך המסכים, כדי שהוא ישרוד מעבר בין כתובות —
 * העגלה לא מתאפסת כשעוברים מקטגוריה למוצר. כל תחום מנוהל בהוק נפרד
 * תחת hooks/, וכאן הם מחוברים לאובייקט אחד שעובר ב-StoreContext.
 * צורת האובייקט הזה היא החוזה מול כל המסכים, ואסור לה להשתנות.
 */
import { useState, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import '../css/app.css';
import { StoreContext } from './context/storeContext';
import { useCart } from './hooks/useCart';
import { useWishlist } from './hooks/useWishlist';
import { useCheckoutForm } from './hooks/useCheckoutForm';
import StoreLayout from './StoreLayout';
import HomePage from './pages/HomePage';
import CategoryView from './features/catalog/CategoryView';
import ProductView from './features/catalog/ProductView';
import AdminRoute from './routes/AdminRoute';
import NotFoundPage from './pages/NotFoundPage';
import About from './pages/About';
import Contact from './pages/Contact';
import Returns from './pages/Returns';

/** מציג את האפליקציה ומנהל את המצב המשותף לכל המסכים. */
function App() {
  const cart = useCart();
  const wishlist = useWishlist();
  const checkout = useCheckoutForm(cart);

  // התפריט הנפתח אינו שייך לאף אחד משלושת התחומים, ולכן נשאר כאן.
  const [menuOpen, setMenuOpen] = useState(false);

  const store = useMemo(() => ({
    ...cart,
    ...wishlist,
    ...checkout,
    menuOpen, setMenuOpen,
  }), [cart, wishlist, checkout, menuOpen]);

  return (
    <StoreContext.Provider value={store}>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<HomePage />} />
          <Route path="category/:slug" element={<CategoryView />} />
          <Route path="product/:id" element={<ProductView />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="returns" element={<Returns />} />

          {/* מודאלים עם כתובת — המסגרת מציגה אותם מעל עמוד הבית */}
          <Route path="cart" element={<HomePage />} />
          <Route path="checkout" element={<HomePage />} />
          <Route path="orders/lookup" element={<HomePage />} />
          <Route path="wishlist" element={<HomePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
        <Route path="/admin/:tab" element={<AdminRoute />} />
      </Routes>
    </StoreContext.Provider>
  );
}

export default App;
