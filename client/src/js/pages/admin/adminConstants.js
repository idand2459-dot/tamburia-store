/**
 * הקבועים המשותפים ללשוניות הניהול.
 *
 * CATEGORIES ו-STATUS_CONFIG נדרשים ביותר מלשונית אחת (הסטטיסטיקות,
 * המוצרים, הטופס, הייבוא וההזמנות), ולכן הם יושבים כאן ולא משוכפלים
 * בכל קובץ. formatDate נמצא כאן מאותה סיבה — גם לשונית ההזמנות וגם
 * ייצוא האקסל שב-useAdminOrders מציגים תאריכים באותה צורה.
 */

export const CATEGORIES = [
  { id: 'painting', label: 'מוצרי צביעה', icon: '🎨' },
  { id: 'kitchen', label: 'מוצרי מטבח', icon: '🍳' },
  { id: 'bathroom', label: 'מוצרי אמבטיה', icon: '🚿' },
  { id: 'tools', label: 'כלי עבודה', icon: '🔧' },
  { id: 'cleaning', label: 'ניקיון', icon: '🧹' },
  { id: 'garden', label: 'גינה', icon: '🌿' },
  { id: 'plumbing', label: 'אינסטלציה', icon: '🔩' },
  { id: 'adhesives', label: 'דבקים', icon: '🗜️' },
  { id: 'locks', label: 'צילינדרים ומנעולים', icon: '🔐' },
  { id: 'faucets', label: 'ברזים', icon: '🚰' },
  { id: 'electrical', label: 'מוצרי חשמל', icon: '⚡' },
  { id: 'home', label: 'בית', icon: '🏠' },
];

export const STATUS_CONFIG = {
  new:        { label: 'חדשה',   color: '#2563eb', bg: '#eff6ff' },
  processing: { label: 'בטיפול', color: '#d97706', bg: '#fffbeb' },
  shipped:    { label: 'נשלחה',  color: '#7c3aed', bg: '#f5f3ff' },
  completed:  { label: 'הושלמה', color: '#16a34a', bg: '#f0fdf4' },
};

/** ממיר תאריך לתצוגה בעברית. */
export function formatDate(d) {
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
