/**
 * לשונית הסטטיסטיקות: כרטיסי הכנסות, גרף שבועי, קטגוריות ומלאי אזל.
 *
 * מקבל את getStats ואת המוצרים, ומחשב את הנתונים כאן ולא ב-Admin,
 * כדי שהחישוב יקרה רק כשהלשונית באמת מוצגת.
 *
 * האיפוס אינו מוחק דבר: הוא קובע מאיזה תאריך סופרים (useStatsBaseline),
 * וההזמנות שקדמו לו פשוט יוצאות מהחישוב. לכן יש גם "בטל איפוס", ולכן
 * השורה למעלה אומרת תמיד ממתי סופרים — מספר שאין לו טווח אינו אומר
 * דבר. לשונית ההזמנות, חיפוש הלקוח לפי טלפון והייצוא לאקסל אינם
 * מושפעים.
 */
import { CalendarDays, Calendar, CalendarRange, Coins, AlertTriangle, CheckCircle, RotateCcw, Undo2 } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { useStatsBaseline } from '../../hooks/useStatsBaseline';
import { formatDate } from './adminConstants';

/** מציג את לשונית הסטטיסטיקות. */
function StatsTab({ products, getStats, onToggleStock, productsError }) {
  const { since, resetStats, clearBaseline } = useStatsBaseline();

  const stats = getStats(products, since);
  const maxDailyCount = Math.max(...stats.dailyOrders.map(d => d.count), 1);

  /** מאשר ואז קובע נקודת התחלה חדשה. */
  function handleReset() {
    if (!window.confirm('לאפס את הסיכומים ולהתחיל לספור מעכשיו?\n\nההזמנות עצמן לא נמחקות, ואפשר לבטל את האיפוס.')) return;
    resetStats();
  }

  return (
    <div className="stats-page">
      <div className="stats-reset">
        {since ? (
          <>
            <span className="stats-reset-since">סופרים מ-{formatDate(since)}</span>
            <button type="button" className="stats-reset-undo" onClick={clearBaseline}>
              <Undo2 size={18} aria-hidden="true" /> בטל איפוס
            </button>
          </>
        ) : (
          <>
            <span className="stats-reset-since">סופרים מההזמנה הראשונה</span>
            <button type="button" className="stats-reset-btn" onClick={handleReset}>
              <RotateCcw size={18} aria-hidden="true" /> אפס סיכומים
            </button>
          </>
        )}
      </div>

      {/* כרטיסי מכירות */}
      <div className="stats-grid">
        <div className="stats-card">
          <div className="stats-card-icon"><CalendarDays size={28} aria-hidden="true" /></div>
          <div className="stats-card-value">₪{stats.revenueToday}</div>
          <div className="stats-card-label">הכנסות היום</div>
          <div className="stats-card-sub">{stats.todayOrders.length} הזמנות</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-icon"><Calendar size={28} aria-hidden="true" /></div>
          <div className="stats-card-value">₪{stats.revenueWeek}</div>
          <div className="stats-card-label">הכנסות השבוע</div>
          <div className="stats-card-sub">{stats.weekOrders.length} הזמנות</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-icon"><CalendarRange size={28} aria-hidden="true" /></div>
          <div className="stats-card-value">₪{stats.revenueMonth}</div>
          <div className="stats-card-label">הכנסות החודש</div>
          <div className="stats-card-sub">{stats.monthOrders.length} הזמנות</div>
        </div>
        <div className="stats-card accent">
          <div className="stats-card-icon"><Coins size={28} aria-hidden="true" /></div>
          <div className="stats-card-value">₪{stats.revenueTotal}</div>
          <div className="stats-card-label">סה"כ הכנסות</div>
          <div className="stats-card-sub">{stats.totalOrders} הזמנות סה"כ</div>
        </div>
      </div>

      <div className="stats-bottom">
        {/* גרף הזמנות 7 ימים */}
        <div className="stats-section">
          <h3>הזמנות — 7 ימים אחרונים</h3>
          <div className="bar-chart">
            {stats.dailyOrders.map((d, i) => (
              <div key={i} className="bar-col">
                <div className="bar-count">{d.count > 0 ? d.count : ''}</div>
                <div className="bar-wrap">
                  <div
                    className="bar-fill"
                    style={{ height: `${(d.count / maxDailyCount) * 100}%` }}
                  />
                </div>
                <div className="bar-label">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-side">
          {/* קטגוריות פופולריות */}
          {stats.topCategories.length > 0 && (
            <div className="stats-section">
              <h3>קטגוריות נמכרות</h3>
              <div className="top-categories">
                {stats.topCategories.map((cat, i) => {
                  const Icon = CATEGORY_ICONS[cat?.id];
                  return (
                    <div key={i} className="top-cat-row">
                      <span className="top-cat-rank">#{i + 1}</span>
                      <span className="top-cat-icon">{Icon && <Icon size={20} aria-hidden="true" />}</span>
                      <span className="top-cat-name">{cat?.label}</span>
                      <span className="top-cat-count">{cat.count} יח'</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* מוצרים שאזלו */}
          <div className="stats-section">
            <h3>
              מוצרים שאזלו
              {stats.outOfStock.length > 0 && (
                <span className="out-of-stock-count">{stats.outOfStock.length}</span>
              )}
            </h3>
            {productsError && <div className="admin-error"><AlertTriangle size={18} aria-hidden="true" /> {productsError}</div>}
            {stats.outOfStock.length === 0 ? (
              <p className="stats-empty"><CheckCircle size={18} aria-hidden="true" /> כל המוצרים במלאי</p>
            ) : (
              <div className="out-of-stock-list">
                {stats.outOfStock.slice(0, 8).map(p => (
                  <div key={p.id} className="out-of-stock-item">
                    <span>{p.name}</span>
                    <button className="restock-btn" onClick={() => onToggleStock(p)}>החזר למלאי</button>
                  </div>
                ))}
                {stats.outOfStock.length > 8 && (
                  <p className="stats-more">...ועוד {stats.outOfStock.length - 8}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsTab;
