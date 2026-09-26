/**
 * רשימת המשאלות.
 *
 * מקור האמת הוא localStorage, וה-state מחזיק רק את המזהים — זה מה
 * שהמסכים צריכים כדי לסמן לב מלא או ריק. הרשומה המלאה נקראת מחדש
 * בכל החלפה, כדי שלא יישמר עותק כפול שעלול להיפרד מהמקור.
 */
import { useState, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'tamburia-wishlist';

/** מנהל את רשימת המשאלות ומחזיר את המזהים ואת פעולת ההחלפה. */
export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.map((p) => p.id) || []; }
    catch { return []; }
  });

  /** מוסיף או מסיר מוצר מהמועדפים. */
  const toggleCardWishlist = useCallback((product) => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const exists = current.find((p) => p.id === product.id);
      const updated = exists
        ? current.filter((p) => p.id !== product.id)
        : [...current, {
          id: product.id, name: product.name, price: product.price,
          image_url: product.image_url, in_stock: product.in_stock,
        }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setWishlistIds(updated.map((p) => p.id));
    } catch { /* localStorage חסום — המועדפים פשוט לא נשמרים */ }
  }, []);

  return useMemo(() => ({
    wishlistIds, toggleCardWishlist,
  }), [wishlistIds, toggleCardWishlist]);
}
