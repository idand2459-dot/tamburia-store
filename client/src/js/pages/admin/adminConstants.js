/**
 * הקבועים המשותפים ללשוניות הניהול.
 *
 * CATEGORIES ו-STATUS_CONFIG נדרשים ביותר מלשונית אחת (הסטטיסטיקות,
 * המוצרים, הטופס, הייבוא וההזמנות), ולכן הם יושבים כאן ולא משוכפלים
 * בכל קובץ. formatDate נמצא כאן מאותה סיבה — גם לשונית ההזמנות וגם
 * ייצוא האקסל שב-useAdminOrders מציגים תאריכים באותה צורה.
 */
import {
  Inbox, Settings, PackageCheck, Truck, CheckCircle,
  ClipboardList, Package, Plus, BarChart3, Download, Star,
} from 'lucide-react';

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

/* תווית ואייקון בלבד — הצבע הוא מחלקה ב-features/admin/_admin-orders.css,
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

/* לשוניות הניהול, בסדר החשיבות ולא בסדר האלפביתי: הזמנות ראשונה, כי
   זה מה שפותחים בשבילו. השלוש הראשונות ועוד "עוד" הן מה שנכנס לסרגל
   התחתון בטלפון, והשאר יושבות בגיליון שנפתח ממנו — ולכן הסדר כאן הוא
   גם החלוקה.

   AdminRoute גוזר מכאן את רשימת הנתיבים החוקיים, כדי שלשונית חדשה לא
   תצטרך להיזכר בשני קבצים. */
export const ADMIN_TABS = [
  { id: 'orders', label: 'הזמנות', Icon: ClipboardList },
  { id: 'products', label: 'מוצרים', Icon: Package },
  { id: 'add', label: 'הוסף מוצר', Icon: Plus },
  { id: 'stats', label: 'סטטיסטיקות', Icon: BarChart3 },
  { id: 'import', label: 'ייבוא', Icon: Download },
  { id: 'reviews', label: 'ביקורות', Icon: Star },
];

/* מה שנכנס לסרגל התחתון בטלפון: שלוש לשוניות וכפתור "עוד". */
export const PRIMARY_TAB_COUNT = 3;

export const ADMIN_TAB_IDS = ADMIN_TABS.map((t) => t.id);

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * ממיר תאריך ל"לפני 12 דקות".
 *
 * בכרטיס ההזמנה זה מה שרוצים לדעת — הזמנה מלפני שעתיים דחופה יותר
 * מאחת מלפני עשר דקות, וחישוב ההפרש בראש מתאריך מלא הוא עבודה מיותרת.
 * התאריך המלא נשאר, ב-title של השעה ובתצוגה הפתוחה.
 */
export function timeAgo(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Date.now() - then;
  if (diff < MINUTE) return 'עכשיו';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'אתמול';
  if (days < 30) return `לפני ${days} ימים`;
  return formatDate(value);
}

/** ממיר תאריך לתצוגה בעברית. */
export function formatDate(d) {
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
