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
import { errorMessageFrom, NETWORK_ERROR } from '../utils/apiErrors';
import { computeOrderStats, ordersToCsv } from '../utils/orderReports';
import { withLine } from '../utils/pickList';

// How often the order list is polled while the tab is visible.
const POLL_MS = 30000;

/**
 * מנהל את ההזמנות, את זיהוי החדשות ואת חישובי הסטטיסטיקות.
 *
 * onNewOrder נקרא בכל שליפה שמגלה הזמנה שלא נראתה קודם — ליד הקונפטי.
 * ההוק אינו יודע מה עושים בהתראה, ולכן הצליל אינו כאן אלא
 * ב-useNewOrderChime שהמסך מרכיב.
 *
 * New orders are found by polling GET /api/orders. The list is a flat array of every order (no
 * limit), and `id` is the table's SERIAL primary key, which is never reused, so an order is new
 * when its id is not in the set of ids already seen. That does not depend on the list order, on
 * deletions, or on the order count. The first successful load only fills the set (no sound, no
 * confetti). Every load, whether from the timer, the tab becoming visible again, or a manual
 * refresh, goes through `loadOrders`, which orders the requests and discards a stale answer.
 */
export function useAdminOrders(adminApi, { onNewOrder } = {}) {
  const [orders, setOrders] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  // null until the first successful load; then the ids of every order seen so far.
  const knownIdsRef = useRef(null);
  // The number of the latest list request started; an older answer is dropped.
  const requestSeqRef = useRef(0);
  // How many list requests are running now; the timer never starts another one on top.
  const activeRequestsRef = useRef(0);
  // Set by a 401 answer: polling stays off for this hook instance (the admin screen is
  // unmounted by the 401 handler and mounted again after the next login).
  const unauthorizedRef = useRef(false);
  const aliveRef = useRef(true);

  // דרך ref, כדי שפונקציה חדשה בכל רינדור לא תאפס את שעון הסקר.
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  /** מודיע על הזמנה חדשה: קונפטי, ומה שהמסך ביקש להוסיף. */
  const announceNewOrder = useCallback(() => {
    setShowConfetti(true);
    onNewOrderRef.current?.();
  }, []);

  /**
   * Loads the order list and returns what happened: 'ok', 'stale' (a newer request started, so
   * this answer was dropped), 'unauthorized' (401) or 'failed'.
   *
   * `poll: true` is the timer and the visibility refresh. A poll never replaces the list with
   * anything but an array from an OK answer: a 5xx or a network error keeps the list and waits
   * for the next tick. The manual path (status change, delete) keeps the earlier behavior: it
   * does not look at the status, only at whether the body is an array (pinned in
   * useAdminOrders.test.js).
   */
  const loadOrders = useCallback(async ({ poll = false } = {}) => {
    const seq = ++requestSeqRef.current;
    activeRequestsRef.current += 1;
    let arr;
    // True only for an OK answer whose body is a list: the only kind of answer that may set the
    // baseline or add to the ids seen. (The manual path still shows any list body, OK or not.)
    let isTrusted = false;
    try {
      const res = await adminApi.getOrders();
      if (res.status === 401) {
        unauthorizedRef.current = true;
        // The manual path keeps its earlier behavior for a 401 (the list empties, see above).
        if (poll) return 'unauthorized';
      }
      if (poll && !res.ok) return 'failed';
      const data = await res.json();
      const isList = Array.isArray(data);
      if (poll && !isList) return 'failed';
      arr = isList ? data : [];
      isTrusted = isList && res.ok;
    } catch {
      // A network error never breaks the screen; the next tick tries again.
      return 'failed';
    } finally {
      activeRequestsRef.current -= 1;
    }

    if (!aliveRef.current || seq !== requestSeqRef.current) return 'stale';

    // An answer that is not an OK list (the manual path still shows its body) says nothing
    // reliable about which orders exist, so it neither sets the baseline nor announces anything.
    if (isTrusted) {
      const ids = arr.map((order) => order?.id).filter((id) => id !== undefined && id !== null);
      if (knownIdsRef.current === null) {
        knownIdsRef.current = new Set(ids);
      } else {
        const known = knownIdsRef.current;
        const hasNew = ids.some((id) => !known.has(id));
        ids.forEach((id) => known.add(id));
        if (hasNew) announceNewOrder();
      }
    }
    setOrders(arr);
    return 'ok';
  }, [adminApi, announceNewOrder]);

  /** טוען את ההזמנות מחדש (עדכון סטטוס, מחיקה). */
  const fetchOrders = useCallback(() => loadOrders(), [loadOrders]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Poll every POLL_MS while the tab is visible. A timeout chain, not an interval: the next
  // tick is scheduled only after the previous one finished, so polls never overlap each other,
  // and a tick is skipped while a manual request is still running.
  useEffect(() => {
    let timer = null;

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clear();
      if (!aliveRef.current || unauthorizedRef.current || document.hidden) return;
      timer = setTimeout(tick, POLL_MS);
    };

    async function tick() {
      timer = null;
      if (activeRequestsRef.current === 0 && !unauthorizedRef.current && !document.hidden) {
        await loadOrders({ poll: true });
      }
      schedule();
    }

    // Hidden: stop the timer. Visible again: refresh now, then continue every POLL_MS.
    const onVisibilityChange = () => {
      if (document.hidden) {
        clear();
        return;
      }
      if (unauthorizedRef.current) return;
      clear();
      tick();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clear();
    };
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
