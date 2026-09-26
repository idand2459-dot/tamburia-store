/**
 * הקבועים המשותפים ללשוניות הניהול.
 *
 * CATEGORIES ו-STATUS_CONFIG נדרשים ביותר מלשונית אחת (הסטטיסטיקות,
 * המוצרים, הטופס, הייבוא וההזמנות), ולכן הם יושבים כאן ולא משוכפלים
 * בכל קובץ. formatDate נמצא כאן מאותה סיבה — גם לשונית ההזמנות וגם
 * ייצוא האקסל שב-useAdminOrders מציגים תאריכים באותה צורה.
 */

/* אין כאן שדה icon: אייקון הקטגוריה נשלף מ-CATEGORY_ICONS לפי ה-id
   (רכיב Lucide, לא מחרוזת), כדי שהאדמין והחנות יציגו את אותו אייקון. */
export const CATEGORIES = [
  { id: 'painting', label: 'מוצרי צביעה' },
  { id: 'kitchen', label: 'מוצרי מטבח' },
  { id: 'bathroom', label: 'מוצרי אמבטיה' },
  { id: 'tools', label: 'כלי עבודה' },
  { id: 'cleaning', label: 'ניקיון' },
  { id: 'garden', label: 'גינה' },
  { id: 'plumbing', label: 'אינסטלציה' },
  { id: 'adhesives', label: 'דבקים' },
  { id: 'locks', label: 'צילינדרים ומנעולים' },
  { id: 'faucets', label: 'ברזים' },
  { id: 'electrical', label: 'מוצרי חשמל' },
  { id: 'home', label: 'בית' },
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
