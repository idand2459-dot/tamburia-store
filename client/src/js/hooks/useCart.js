/**
 * מצב העגלה: הפריטים, אופן קבלת ההזמנה והסכומים הנגזרים מהם.
 *
 * העגלה נשמרת ב-localStorage בכל שינוי, כדי שתשרוד רענון וסגירת
 * טאב. כל פעולות העדכון משתמשות בצורה הפונקציונלית של setCart, ולכן
 * הן אינן תלויות בעגלה הנוכחית ואפשר לקרוא להן בבטחה מכל מקום.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'tamburia-cart';
const DELIVERY_FEE = 20;

/** מנהל את העגלה ומחזיר את המצב ואת פעולות העדכון. */
export function useCart() {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const [deliveryMethod, setDeliveryMethod] = useState(null);

  const subtotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const deliveryFee = deliveryMethod === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  const cartCount = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);

  /** מוסיף מוצר לעגלה, או מגדיל את כמותו אם כבר קיים. */
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const same = (i) => i.id === product.id
        && i.selectedColor === product.selectedColor
        && i.selectedSize === product.selectedSize;

      if (prev.some(same)) {
        return prev.map((i) => (same(i) ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  /** מוסיף בבת אחת את כל מה שמחשבון הצבע או הפרויקט חישב. */
  const addBundleToCart = useCallback((items) => {
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
  }, []);

  /** מסיר פריט מהעגלה. */
  const removeFromCart = useCallback((index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** משנה את כמות הפריט בעגלה, ומסיר אותו כשהיא מתאפסת. */
  const updateQuantity = useCallback((index, delta) => {
    setCart((prev) => prev
      .map((item, i) => {
        if (i !== index) return item;
        const next = (item.quantity || 1) + delta;
        return next <= 0 ? null : { ...item, quantity: next };
      })
      .filter(Boolean));
  }, []);

  return useMemo(() => ({
    cart, setCart, cartCount, subtotal, deliveryFee, total,
    addToCart, addBundleToCart, removeFromCart, updateQuantity,
    deliveryMethod, setDeliveryMethod,
  }), [
    cart, cartCount, subtotal, deliveryFee, total,
    addToCart, addBundleToCart, removeFromCart, updateQuantity,
    deliveryMethod,
  ]);
}
