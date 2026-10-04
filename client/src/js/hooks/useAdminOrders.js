/**
 * נתוני ההזמנות של מסך הניהול: הרשימה, הסקר התקופתי, הסטטוסים,
 * רשימת הליקוט, המחיקה, ייצוא האקסל וחישובי לשונית הסטטיסטיקות.
 *
 * מקבל את עוטף ה-fetch (api) כארגומנט, כמו שני ההוקים האחרים.
 *
 * getStats מקבל את המוצרים כארגומנט ואינו מחזיק אותם: חישוב
 * הקטגוריות הנמכרות והמוצרים שאזלו זקוק לשתי הרשימות, וקבלת המוצרים
 * מבחוץ שומרת את ההוק עצמו בלתי תלוי ב-useAdminProducts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { CATEGORIES, STATUS_CONFIG, formatDate } from '../pages/admin/adminConstants';
import { useWebSocket } from './useWebSocket';
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';
import { sumPrices } from '../utils/pricing';
import { withLine } from '../utils/pickList';

// הסקר הוא מסלול חלופי בלבד מאז שיש WebSocket: הודעה על הזמנה חדשה
// מגיעה תוך פחות משנייה, והסקר נשאר רק למקרה שהחיבור למטה.
const POLL_MS = 120000;

/**
 * מנהל את ההזמנות, את זיהוי החדשות ואת חישובי הסטטיסטיקות.
 *
 * onNewOrder נקרא בשני המקומות שבהם מתגלית הזמנה חדשה — הודעת
 * ה-WebSocket והסקר החלופי — ליד הקונפטי. ההוק אינו יודע מה עושים
 * בהתראה, ולכן הצליל אינו כאן אלא ב-useNewOrderChime שהמסך מרכיב.
 */
export function useAdminOrders(api, { onNewOrder } = {}) {
  const [orders, setOrders] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const prevOrdersCount = useRef(null);

  // דרך ref, כדי שפונקציה חדשה בכל רינדור לא תרשום מחדש את מאזין
  // ה-WebSocket ולא תאפס את שעון הסקר.
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  /** מודיע על הזמנה חדשה: קונפטי, ומה שהמסך ביקש להוסיף. */
  const announceNewOrder = useCallback(() => {
    setShowConfetti(true);
    onNewOrderRef.current?.();
  }, []);

  /**
   * שולף את ההזמנות. שלושת הקוראים צריכים אותו שליפה אבל התייחסות
   * שונה לספירה שנראתה לאחרונה, ולכן הם נבדלים בדגלים ולא בעותק
   * נוסף של אותו fetch:
   * - detectNew — הסקר: גידול במספר ההזמנות מפעיל קונפטי.
   * - markSeen — אחרי הודעת WebSocket: הספירה מסומנת כמעודכנת, כדי
   *   שהסקר לא יפעיל קונפטי שוב על אותה הזמנה.
   * בלי שניהם (עדכון סטטוס, מחיקה) הספירה לא נוגעת, כמו קודם.
   */
  const loadOrders = useCallback(async ({ detectNew = false, markSeen = false } = {}) => {
    let arr;
    try {
      const res = await api('/api/orders');
      const data = await res.json();
      arr = Array.isArray(data) ? data : [];
    } catch {
      // תקלה ברשת אינה מפילה את הסקר — הוא ינסה שוב בפעימה הבאה.
      return;
    }

    if (detectNew && prevOrdersCount.current !== null && arr.length > prevOrdersCount.current) {
      announceNewOrder();
    }
    if (prevOrdersCount.current === null || detectNew || markSeen) {
      prevOrdersCount.current = arr.length;
    }
    setOrders(arr);
  }, [api, announceNewOrder]);

  /** טוען את ההזמנות מחדש, בלי לגעת בספירה שנראתה לאחרונה. */
  const fetchOrders = useCallback(() => loadOrders(), [loadOrders]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // הזמנה חדשה מגיעה מהשרת בזמן אמת. ההוק שמביא אותה הוא תעבורה
  // גנרית; המשמעות — קונפטי ורענון — נמצאת כאן, בשכבה שיודעת מה
  // order:created אומר.
  useWebSocket({
    'order:created': () => {
      announceNewOrder();
      loadOrders({ markSeen: true });
    },
  });

  // סקר תקופתי כמסלול חלופי, למקרה שה-WebSocket אינו מחובר.
  useEffect(() => {
    const interval = setInterval(() => loadOrders({ detectNew: true }), POLL_MS);
    return () => clearInterval(interval);
  }, [loadOrders]);

  /** מכבה את הקונפטי בסיום האנימציה. */
  const dismissConfetti = useCallback(() => setShowConfetti(false), []);

  /** משנה את סטטוס ההזמנה. */
  const handleStatusChange = useCallback(async (orderId, status) => {
    try {
      const res = await api(`/api/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });

      if (!res.ok) {
        setOrdersError(await errorMessageFrom(res, `שינוי הסטטוס של הזמנה #${orderId} נכשל.`));
        return;
      }
      setOrdersError(''); fetchOrders();
    } catch {
      setOrdersError(NETWORK_ERROR);
    }
  }, [api, fetchOrders]);

  /** קובע במסך את הסימון של שורה אחת בהזמנה, בלי לגעת בשאר. */
  const setLinePickedLocally = useCallback((orderId, line, picked) => {
    setOrders(prev => prev.map(o => (
      o.id === orderId ? { ...o, picked_items: withLine(o.picked_items, line, picked) } : o
    )));
  }, []);

  /**
   * מסמן שורה ברשימת הליקוט כמוכנה, או מבטל את הסימון.
   *
   * אופטימי: המסך מתעדכן מיד, כי מי שעומד ליד המדף לוחץ שורה אחרי
   * שורה ולא מחכה לשרת. כישלון מחזיר את השורה הזו בלבד למצבה הקודם,
   * ולא את כל ההזמנה — שורה אחרת שסומנה בינתיים נשארת מסומנת.
   *
   * בהצלחה לא מעתיקים את picked_items מהתשובה: שתי לחיצות מהירות
   * יוצאות במקביל, והתשובה לראשונה עוד לא יודעת על השנייה.
   *
   * מחזיר הודעת שגיאה, או null. ההודעה מוצגת ליד הרשימה שנלחצה ולא
   * בפס שבראש הלשונית, שכבר גללו ממנו.
   */
  const togglePicked = useCallback(async (orderId, line, picked) => {
    setLinePickedLocally(orderId, line, picked);
    try {
      const res = await api(`/api/orders/${orderId}/items/${line}/picked`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picked }),
      });
      if (res.ok) return null;
      setLinePickedLocally(orderId, line, !picked);
      return await errorMessageFrom(res, 'הסימון לא נשמר. נסה שוב.');
    } catch {
      setLinePickedLocally(orderId, line, !picked);
      return NETWORK_ERROR;
    }
  }, [api, setLinePickedLocally]);

  /** מוחק הזמנה לאחר אישור המשתמש. */
  const handleDeleteOrder = useCallback(async (id) => {
    if (!window.confirm('למחוק את ההזמנה?')) return;

    try {
      const res = await api('/api/orders/' + id, { method: 'DELETE' });
      if (!res.ok) {
        setOrdersError(await errorMessageFrom(res, `מחיקת הזמנה #${id} נכשלה.`));
        return;
      }
      setOrdersError(''); fetchOrders();
    } catch {
      setOrdersError(NETWORK_ERROR);
    }
  }, [api, fetchOrders]);

  /**
   * מחשב את נתוני לשונית הסטטיסטיקות.
   *
   * since הוא נקודת ההתחלה של הסיכומים (useStatsBaseline): הזמנות
   * שקדמו לה יוצאות מהחישוב. הסינון נעשה פעם אחת בראש, ולכן כל מה
   * שמתחתיו — החלונות של היום, השבוע והחודש, הגרף והקטגוריות — מכבד
   * אותו בלי להזכיר אותו. outOfStock אינו מסונן: הוא נגזר מהמוצרים
   * ולא מההזמנות, ולמוצר שאזל אין תאריך שאפשר לספור ממנו.
   */
  const getStats = useCallback((products, since = null) => {
    const from = since ? new Date(since) : null;
    const counted = from ? orders.filter(o => new Date(o.created_at) >= from) : orders;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayOrders = counted.filter(o => new Date(o.created_at) >= todayStart);
    const weekOrders = counted.filter(o => new Date(o.created_at) >= weekStart);
    const monthOrders = counted.filter(o => new Date(o.created_at) >= monthStart);

    const revenueToday = sumPrices(todayOrders.map(o => o.total));
    const revenueWeek = sumPrices(weekOrders.map(o => o.total));
    const revenueMonth = sumPrices(monthOrders.map(o => o.total));
    const revenueTotal = sumPrices(counted.map(o => o.total));

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const dailyOrders = last7Days.map(day => {
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
      const count = counted.filter(o => {
        const d = new Date(o.created_at);
        return d >= day && d < nextDay;
      }).length;
      return { day: day.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' }), count };
    });

    const catCount = {};
    counted.forEach(o => {
      (Array.isArray(o.items) ? o.items : []).forEach(item => {
        const p = products.find(p => p.id === item.id);
        if (p?.category) catCount[p.category] = (catCount[p.category] || 0) + item.quantity;
      });
    });
    const topCategories = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ ...CATEGORIES.find(c => c.id === id), count }));

    const outOfStock = products.filter(p => p.in_stock === false);

    // totalOrders ולא orders.length בלשונית: אחרי איפוס המספר הגדול
    // והסיכום שלידו חייבים לספר את אותו סיפור.
    return { todayOrders, weekOrders, monthOrders, revenueToday, revenueWeek, revenueMonth, revenueTotal, dailyOrders, topCategories, outOfStock, totalOrders: counted.length };
  }, [orders]);

  /** מייצא את ההזמנות לקובץ CSV. */
  const exportOrdersToExcel = useCallback(() => {
    const rows = orders.map(o => ({
      'מספר הזמנה': `#${o.id}`,
      'תאריך': formatDate(o.created_at),
      'שם לקוח': o.customer_name,
      'טלפון': o.customer_phone,
      'אימייל': o.customer_email || '',
      'אופן קבלה': o.delivery_method === 'pickup' ? 'איסוף עצמי' : 'משלוח',
      'כתובת': o.delivery_address || '',
      'פריטים': o.items.map(i => `${i.name} x${i.quantity}`).join(' | '),
      'סכום מוצרים': o.subtotal,
      'משלוח': o.delivery_fee,
      'סה"כ': o.total,
      'סטטוס': STATUS_CONFIG[o.status]?.label || o.status,
      'הערות': o.notes || '',
    }));

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ];
    const csv = '﻿' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamburia-orders-${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [orders]);

  return {
    orders, fetchOrders, ordersError,
    handleStatusChange, togglePicked, handleDeleteOrder, exportOrdersToExcel, getStats,
    showConfetti, dismissConfetti,
  };
}
