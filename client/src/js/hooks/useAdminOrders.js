/**
 * נתוני ההזמנות של מסך הניהול: הרשימה, הסקר התקופתי, הסטטוסים,
 * המחיקה, ייצוא האקסל וחישובי לשונית הסטטיסטיקות.
 *
 * מקבל את עוטף ה-fetch (api) כארגומנט, כמו שני ההוקים האחרים.
 *
 * getStats מקבל את המוצרים כארגומנט ואינו מחזיק אותם: חישוב
 * הקטגוריות הנמכרות והמוצרים שאזלו זקוק לשתי הרשימות, וקבלת המוצרים
 * מבחוץ שומרת את ההוק עצמו בלתי תלוי ב-useAdminProducts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { CATEGORIES, STATUS_CONFIG, formatDate } from '../pages/admin/adminConstants';

const POLL_MS = 30000;

/** מנהל את ההזמנות, את זיהוי החדשות ואת חישובי הסטטיסטיקות. */
export function useAdminOrders(api) {
  const [orders, setOrders] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevOrdersCount = useRef(null);

  /** טוען את ההזמנות ומזהה הזמנות חדשות מאז הטעינה הקודמת. */
  const fetchOrders = useCallback(() => {
    api('/api/orders').then(r => r.json()).then(data => {
      const arr = Array.isArray(data) ? data : [];
      if (prevOrdersCount.current === null) prevOrdersCount.current = arr.length;
      setOrders(arr);
    }).catch(() => {});
  }, [api]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // סקר תקופתי: הזמנה שנכנסה מאז הבדיקה הקודמת מפעילה קונפטי.
  // הספירה מתעדכנת רק כאן, ולא בטעינות שאחרי עדכון סטטוס או מחיקה,
  // כדי שפעולות של המנהל עצמו לא ייחשבו כהזמנה חדשה.
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await api('/api/orders');
      const fresh = await res.json();
      if (prevOrdersCount.current !== null && fresh.length > prevOrdersCount.current) {
        setShowConfetti(true);
      }
      prevOrdersCount.current = fresh.length;
      setOrders(fresh);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [api]);

  /** מכבה את הקונפטי בסיום האנימציה. */
  const dismissConfetti = useCallback(() => setShowConfetti(false), []);

  /** משנה את סטטוס ההזמנה. */
  const handleStatusChange = useCallback(async (orderId, status) => {
    await api(`/api/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchOrders();
  }, [api, fetchOrders]);

  /** מוחק הזמנה לאחר אישור המשתמש. */
  const handleDeleteOrder = useCallback(async (id) => {
    if (!window.confirm('למחוק את ההזמנה?')) return;
    await api('/api/orders/' + id, { method: 'DELETE' });
    fetchOrders();
  }, [api, fetchOrders]);

  /** מחשב את נתוני לשונית הסטטיסטיקות. */
  const getStats = useCallback((products) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart);
    const weekOrders = orders.filter(o => new Date(o.created_at) >= weekStart);
    const monthOrders = orders.filter(o => new Date(o.created_at) >= monthStart);

    const revenueToday = todayOrders.reduce((s, o) => s + o.total, 0);
    const revenueWeek = weekOrders.reduce((s, o) => s + o.total, 0);
    const revenueMonth = monthOrders.reduce((s, o) => s + o.total, 0);
    const revenueTotal = orders.reduce((s, o) => s + o.total, 0);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const dailyOrders = last7Days.map(day => {
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
      const count = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= day && d < nextDay;
      }).length;
      return { day: day.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' }), count };
    });

    const catCount = {};
    orders.forEach(o => {
      (Array.isArray(o.items) ? o.items : []).forEach(item => {
        const p = products.find(p => p.id === item.id);
        if (p?.category) catCount[p.category] = (catCount[p.category] || 0) + item.quantity;
      });
    });
    const topCategories = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ ...CATEGORIES.find(c => c.id === id), count }));

    const outOfStock = products.filter(p => p.in_stock === false);

    return { todayOrders, weekOrders, monthOrders, revenueToday, revenueWeek, revenueMonth, revenueTotal, dailyOrders, topCategories, outOfStock };
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
    orders, fetchOrders,
    handleStatusChange, handleDeleteOrder, exportOrdersToExcel, getStats,
    showConfetti, dismissConfetti,
  };
}
