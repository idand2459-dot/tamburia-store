/**
 * נתוני ההזמנות של מסך הניהול: הרשימה, הסקר התקופתי, הסטטוסים,
 * רשימת הליקוט, המחיקה, ייצוא האקסל וחישובי לשונית הסטטיסטיקות.
 *
 * Receives the admin API (adminApi, see services/adminService.js) as an argument.
 *
 * getStats מקבל את המוצרים כארגומנט ואינו מחזיק אותם: חישוב
 * הקטגוריות הנמכרות והמוצרים שאזלו זקוק לשתי הרשימות, וקבלת המוצרים
 * מבחוץ שומרת את ההוק עצמו בלתי תלוי ב-useAdminProducts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';
import { computeOrderStats, ordersToCsv } from '../utils/orderReports';
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
export function useAdminOrders(adminApi, { onNewOrder } = {}) {
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
      const res = await adminApi.getOrders();
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
  }, [adminApi, announceNewOrder]);

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
      const res = await adminApi.updateOrderStatus(orderId, status);

      if (!res.ok) {
        setOrdersError(await errorMessageFrom(res, `שינוי הסטטוס של הזמנה #${orderId} נכשל.`));
        return;
      }
      setOrdersError(''); fetchOrders();
    } catch {
      setOrdersError(NETWORK_ERROR);
    }
  }, [adminApi, fetchOrders]);

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
      const res = await adminApi.setOrderLinePicked(orderId, line, picked);
      if (res.ok) return null;
      setLinePickedLocally(orderId, line, !picked);
      return await errorMessageFrom(res, 'הסימון לא נשמר. נסה שוב.');
    } catch {
      setLinePickedLocally(orderId, line, !picked);
      return NETWORK_ERROR;
    }
  }, [adminApi, setLinePickedLocally]);

  /** מוחק הזמנה לאחר אישור המשתמש. */
  const handleDeleteOrder = useCallback(async (id) => {
    if (!window.confirm('למחוק את ההזמנה?')) return;

    try {
      const res = await adminApi.deleteOrder(id);
      if (!res.ok) {
        setOrdersError(await errorMessageFrom(res, `מחיקת הזמנה #${id} נכשלה.`));
        return;
      }
      setOrdersError(''); fetchOrders();
    } catch {
      setOrdersError(NETWORK_ERROR);
    }
  }, [adminApi, fetchOrders]);

  /** מחשב את נתוני לשונית הסטטיסטיקות (utils/orderReports.js). */
  const getStats = useCallback((products, since = null) => computeOrderStats(orders, products, since), [orders]);

  /** מייצא את ההזמנות לקובץ CSV. */
  const exportOrdersToExcel = useCallback(() => {
    const csv = ordersToCsv(orders);
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
