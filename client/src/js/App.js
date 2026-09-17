/**
 * שורש האפליקציה: מחזיק את המצב המשותף (עגלה, מועדפים, פרטי הזמנה)
 * ומגדיר את טבלת הניתוב.
 *
 * המצב יושב כאן ולא בתוך המסכים, כדי שהוא ישרוד מעבר בין כתובות —
 * העגלה לא מתאפסת כשעוברים מקטגוריה למוצר. המסכים מקבלים אותו
 * דרך StoreContext.
 */
import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import '../css/app.css';
import { StoreContext } from './storeContext';
import StoreLayout from './StoreLayout';
import HomePage from './HomePage';
import CategoryView from './CategoryView';
import ProductView from './ProductView';
import AdminRoute from './AdminRoute';
import NotFoundPage from './NotFoundPage';
import About from './About';
import Contact from './Contact';
import Returns from './Returns';

const DELIVERY_FEE = 20;

/** מציג את האפליקציה ומנהל את המצב המשותף לכל המסכים. */
function App() {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tamburia-cart')) || []; }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('tamburia-cart', JSON.stringify(cart));
  }, [cart]);

  const [wishlistIds, setWishlistIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tamburia-wishlist'))?.map((p) => p.id) || []; }
    catch { return []; }
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const subtotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const deliveryFee = deliveryMethod === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  const cartCount = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);

  const store = useMemo(() => {
    /** מוסיף מוצר לעגלה, או מגדיל את כמותו אם כבר קיים. */
    function addToCart(product) {
      setCart((prev) => {
        const same = (i) => i.id === product.id
          && i.selectedColor === product.selectedColor
          && i.selectedSize === product.selectedSize;

        if (prev.some(same)) {
          return prev.map((i) => (same(i) ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
        }
        return [...prev, { ...product, quantity: 1 }];
      });
    }

    /** מוסיף בבת אחת את כל מה שמחשבון הצבע או הפרויקט חישב. */
    function addBundleToCart(items) {
      setCart((prev) => {
        let updated = [...prev];
        for (const item of items) {
          const exists = updated.find((i) => i.id === item.id);
          if (exists) {
            updated = updated.map((i) => (
              i.id === item.id ? { ...i, quantity: (i.quantity || 1) + item.quantity } : i
            ));
          } else {
            updated = [...updated, { ...item, selectedColor: null }];
          }
        }
        return updated;
      });
    }

    /** מסיר פריט מהעגלה. */
    function removeFromCart(index) {
      setCart((prev) => prev.filter((_, i) => i !== index));
    }

    /** משנה את כמות הפריט בעגלה, ומסיר אותו כשהיא מתאפסת. */
    function updateQuantity(index, delta) {
      setCart((prev) => prev
        .map((item, i) => {
          if (i !== index) return item;
          const next = (item.quantity || 1) + delta;
          return next <= 0 ? null : { ...item, quantity: next };
        })
        .filter(Boolean));
    }

    /** מוסיף או מסיר מוצר מהמועדפים. */
    function toggleCardWishlist(product) {
      try {
        const current = JSON.parse(localStorage.getItem('tamburia-wishlist')) || [];
        const exists = current.find((p) => p.id === product.id);
        const updated = exists
          ? current.filter((p) => p.id !== product.id)
          : [...current, {
            id: product.id, name: product.name, price: product.price,
            image_url: product.image_url, in_stock: product.in_stock,
          }];
        localStorage.setItem('tamburia-wishlist', JSON.stringify(updated));
        setWishlistIds(updated.map((p) => p.id));
      } catch { /* localStorage חסום — המועדפים פשוט לא נשמרים */ }
    }

    /** שולח את ההזמנה לשרת. הסכומים מחושבים מחדש בשרת. */
    async function handlePlaceOrder() {
      if (!customerName || !customerPhone) return;
      if (deliveryMethod === 'delivery' && !deliveryAddress) return;

      setSubmittingOrder(true);
      const order = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : null,
        notes: orderNotes,
        items: cart.map((i) => ({
          id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1,
          selectedColor: i.selectedColor || null, selectedSize: i.selectedSize || null,
        })),
        subtotal, delivery_fee: deliveryFee, total,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const saved = await res.json();

      setSubmittingOrder(false);
      setOrderSuccess(saved);
      setCart([]);
      setDeliveryMethod(null);
      setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
      setDeliveryAddress(''); setOrderNotes('');
    }

    return {
      cart, setCart, cartCount, subtotal, deliveryFee, total,
      addToCart, addBundleToCart, removeFromCart, updateQuantity,
      wishlistIds, toggleCardWishlist,
      deliveryMethod, setDeliveryMethod,
      customerName, setCustomerName,
      customerPhone, setCustomerPhone,
      customerEmail, setCustomerEmail,
      deliveryAddress, setDeliveryAddress,
      orderNotes, setOrderNotes,
      submittingOrder, handlePlaceOrder,
      orderSuccess, clearOrderSuccess: () => setOrderSuccess(null),
      menuOpen, setMenuOpen,
    };
  }, [
    cart, cartCount, subtotal, deliveryFee, total, wishlistIds,
    deliveryMethod, customerName, customerPhone, customerEmail,
    deliveryAddress, orderNotes, submittingOrder, orderSuccess, menuOpen,
  ]);

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

        <Route path="/admin" element={<Navigate to="/admin/stats" replace />} />
        <Route path="/admin/:tab" element={<AdminRoute />} />
      </Routes>
    </StoreContext.Provider>
  );
}

export default App;
