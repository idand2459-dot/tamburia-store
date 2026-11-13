/**
 * Order reports: the numbers of the statistics tab and the text of the orders CSV export.
 *
 * Plain functions of their inputs (the statistics read the clock, as they always did), moved
 * unchanged out of hooks/useAdminOrders.js (P3). The hook keeps the state and the download.
 */
import { CATEGORIES, STATUS_CONFIG, formatDate } from '../pages/admin/adminConstants';
import { sumPrices } from './pricing';

/**
 * מחשב את נתוני לשונית הסטטיסטיקות.
 *
 * since הוא נקודת ההתחלה של הסיכומים (useStatsBaseline): הזמנות
 * שקדמו לה יוצאות מהחישוב. הסינון נעשה פעם אחת בראש, ולכן כל מה
 * שמתחתיו — החלונות של היום, השבוע והחודש, הגרף והקטגוריות — מכבד
 * אותו בלי להזכיר אותו. outOfStock אינו מסונן: הוא נגזר מהמוצרים
 * ולא מההזמנות, ולמוצר שאזל אין תאריך שאפשר לספור ממנו.
 */
export function computeOrderStats(orders, products, since = null) {
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
}

/** בונה את טקסט ה-CSV של ייצוא ההזמנות (עם BOM, כדי שאקסל יקרא עברית). */
export function ordersToCsv(orders) {
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
  return '﻿' + csvLines.join('\n');
}
