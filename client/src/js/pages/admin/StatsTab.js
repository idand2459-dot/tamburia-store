/**
 * לשונית הסטטיסטיקות: כרטיסי הכנסות, גרף שבועי, קטגוריות ומלאי אזל.
 *
 * מקבל את getStats ואת המוצרים, ומחשב את הנתונים כאן ולא ב-Admin,
 * כדי שהחישוב יקרה רק כשהלשונית באמת מוצגת.
 */
import { CalendarDays, Calendar, CalendarRange, Coins, AlertTriangle, CheckCircle } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';

/** מציג את לשונית הסטטיסטיקות. */
function StatsTab({ orders, products, getStats, onToggleStock, productsError }) {
  const stats = getStats(products);
  const maxDailyCount = Math.max(...stats.dailyOrders.map(d => d.count), 1);

  return (
    <div className="stats-page">
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
          <div className="stats-card-sub">{orders.length} הזמנות סה"כ</div>
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
