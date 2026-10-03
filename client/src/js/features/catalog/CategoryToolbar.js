/**
 * שורת הכלים שמעל רשת המוצרים: כמה נמצאו, חיפוש ומיון.
 *
 * החיפוש והמיון נשארים מצב מקומי של CategoryPage ולא נכנסים לכתובת —
 * הם משתנים בכל הקלדה והיו מציפים את היסטוריית הדפדפן. הרכיב הזה רק
 * מציג אותם.
 *
 * חמשת אפשרויות המיון היו חמישה כפתורים ועכשיו הן select אחד: שורה
 * שלמה של העמוד ירדה למאה וחמישים פיקסלים.
 */
import { Search, ArrowUpDown } from 'lucide-react';

/** מציג את מספר התוצאות, שדה החיפוש ובורר המיון. */
function CategoryToolbar({ count, loading, searchQuery, onSearch, sortBy, onSort, sortOptions }) {
  return (
    <div className="category-toolbar">
      {/* בזמן הטעינה הפריט נשאר ריק ושומר על הגובה, כדי שהשורה לא תזוז
          כשהמספר מגיע */}
      {/* role="status": המספר משתנה בזמן חיפוש וסינון, וזו הדרך של קורא
          המסך לדעת על כך בלי שהמיקוד יעזוב את שדה החיפוש (WCAG 4.1.3) */}
      <p className="category-toolbar-count" role="status">
        {!loading && (count === 1 ? 'מוצר אחד' : `${count} מוצרים`)}
      </p>

      <div className="category-toolbar-controls">
        <div className="category-search">
          <Search className="category-search-icon" size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="חיפוש בקטגוריה"
            placeholder="חפש מוצר..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <div className="category-sort">
          <ArrowUpDown className="category-sort-icon" size={16} aria-hidden="true" />
          <select aria-label="מיון" value={sortBy} onChange={(e) => onSort(e.target.value)}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default CategoryToolbar;
