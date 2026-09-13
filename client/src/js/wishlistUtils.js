/**
 * קריאה וכתיבה של רשימת המועדפים באחסון המקומי.
 */
/** מחזיר את רשימת המועדפים מהאחסון המקומי. */
export function getWishlist() {
  try { return JSON.parse(localStorage.getItem('tamburia-wishlist')) || []; }
  catch { return []; }
}

/** מוסיף או מסיר מוצר מהמועדפים ומחזיר את הרשימה המעודכנת. */
export function toggleWishlist(product) {
  const list = getWishlist();
  const exists = list.find(p => p.id === product.id);
  const updated = exists
    ? list.filter(p => p.id !== product.id)
    : [...list, { id: product.id, name: product.name, price: product.price, image_url: product.image_url, in_stock: product.in_stock, category: product.category }];
  localStorage.setItem('tamburia-wishlist', JSON.stringify(updated));
  return !exists;
}

/** בודק אם המוצר נמצא במועדפים. */
export function isInWishlist(productId) {
  return getWishlist().some(p => p.id === productId);
}