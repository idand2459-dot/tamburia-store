/**
 * הקבועים המשותפים ללשוניות הניהול.
 *
 * CATEGORIES ו-STATUS_CONFIG נדרשים ביותר מלשונית אחת (הסטטיסטיקות,
 * המוצרים, הטופס, הייבוא וההזמנות), ולכן הם יושבים כאן ולא משוכפלים
 * בכל קובץ. formatDate נמצא כאן מאותה סיבה — גם לשונית ההזמנות וגם
 * ייצוא האקסל שב-useAdminOrders מציגים תאריכים באותה צורה.
 */
import { Inbox, Settings, PackageCheck, Truck, CheckCircle } from 'lucide-react';

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

/* תווית ואייקון בלבד — הצבע הוא מחלקה ב-features/_admin-orders.css,
   כמו בכרטיס ההזמנה של הלקוח. הכחול והכתום שהיו כאן כהקסים לא קיימים
   בשום מקום אחר באתר, וסטטוס זהה נראה עכשיו אותו דבר בשני הצדדים. */
export const STATUS_CONFIG = {
  new:              { label: 'חדשה',          Icon: Inbox },
  processing:       { label: 'בטיפול',         Icon: Settings },
  ready_for_pickup: { label: 'מוכנה לאיסוף',   Icon: PackageCheck },
  shipped:          { label: 'נשלחה',          Icon: Truck },
  completed:        { label: 'הושלמה',         Icon: CheckCircle },
};

/* הסטטוסים שאינם מתאימים לכל אופן קבלה. תמונת מראה של
   STATUS_ONLY_FOR_METHOD ב-server/validators/order.validator.js: השרת
   דוחה זיווג פסול ב-400, וכאן הוא פשוט לא מוצע. */
const STATUS_ONLY_FOR_METHOD = {
  ready_for_pickup: 'pickup',
  shipped: 'delivery',
};

/** מחזיר את מפתחות הסטטוס החוקיים לאופן קבלה נתון, בסדר ההתקדמות. */
export function statusesForMethod(deliveryMethod) {
  return Object.keys(STATUS_CONFIG).filter((key) => {
    const required = STATUS_ONLY_FOR_METHOD[key];
    return !required || required === deliveryMethod;
  });
}

/** ממיר תאריך לתצוגה בעברית. */
export function formatDate(d) {
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
