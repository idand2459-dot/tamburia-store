/**
 * סינון תת-קטגוריה בעמוד הקטגוריה.
 *
 * רכיב אחד ושתי צורות: סרגל צד דביק במסך רחב, ושורת צ'יפים נגללת
 * בטלפון. ה-DOM זהה בשתיהן וה-CSS הוא שמחליף ביניהן (ראה
 * features/_category-filters.css) — רינדור כפול והסתרה של אחד מהם היה
 * מכניס כל תת-קטגוריה לעץ הנגישות פעמיים.
 *
 * המספרים מחושבים מהמוצרים שנשלפו, ולא בשליפה נפרדת: השליפה הזו כבר
 * הביאה את כל מוצרי הקטגוריה, וספירה שלהם כאן זולה משנים-עשר מסלולי
 * שרת נוספים.
 */

/** מציג את רשימת תתי-הקטגוריות עם מספר המוצרים בכל אחת. */
function CategoryFilters({ subcategories, counts, total, selected, onSelect }) {
  /* "הכל" הוא פריט ברשימה ולא מקרה מיוחד: אותו כפתור, עם null כמזהה. */
  const items = [
    { id: null, name: 'הכל', count: total },
    ...subcategories.map((sub) => ({ id: sub.id, name: sub.name, count: counts[sub.id] || 0 })),
  ];

  return (
    <nav className="category-filters" aria-label="תתי-קטגוריות">
      <h2 className="category-filters-title">תתי-קטגוריות</h2>
      <ul className="category-filters-list">
        {items.map((item) => {
          const active = selected === item.id;
          return (
            <li key={item.id || 'all'}>
              <button
                type="button"
                className={[
                  'category-filter',
                  active ? 'is-active' : '',
                  item.count === 0 ? 'category-filter--empty' : '',
                ].filter(Boolean).join(' ')}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(active ? null : item.id)}
              >
                <span>{item.name}</span>
                <span className="category-filter-count">{item.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default CategoryFilters;
