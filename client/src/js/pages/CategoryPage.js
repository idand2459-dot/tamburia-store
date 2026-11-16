/**
 * עמוד קטגוריה: /category/:slug
 *
 * ה-slug הוא מזהה הקטגוריה מ-categories.js. slug שאינו מוכר מוצג
 * כ-404 ולא כעמוד ריק. תת-הקטגוריה נשמרת ב-query (?sub=), כך שגם
 * סינון אפשר לשתף בקישור; החיפוש והמיון נשארו מצב מקומי, כי הם
 * משתנים בכל הקלדה והיו מציפים את היסטוריית הדפדפן.
 *
 * מבנה העמוד: באנר תצלום למעלה, ומתחתיו אזור קנייה בהיר — סרגל סינון
 * בצד ההתחלה (צ'יפים בטלפון), שורת כלים ורשת המוצרים.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useSearchParams } from 'react-router-dom';
import { PackageSearch, X, Phone, Search, ArrowUpDown } from 'lucide-react';
import categories from '../features/catalog/categories';
import CategoryBanner from '../features/catalog/CategoryBanner';
import NotFoundPage from './NotFoundPage';
import ProductList from '../components/ProductList';
import { PHONES } from '../utils/storeInfo';
import { sortByPrice } from '../utils/pricing';
import { addItem } from '../store/cart/cartActions';
import { toggleWishlist } from '../store/wishlist/wishlistActions';
import { selectWishlistIds } from '../store/wishlist/wishlistSelectors';
import { getProducts, isAbortError } from '../services/productService';
import { usePageTitle } from '../hooks/usePageTitle';

const SORT_OPTIONS = [
  { value: 'default', label: 'ברירת מחדל' },
  { value: 'price-asc', label: 'מחיר ↑' },
  { value: 'price-desc', label: 'מחיר ↓' },
  { value: 'name', label: 'א-ב' },
  { value: 'instock', label: 'במלאי קודם' },
];

/** מציג את מוצרי הקטגוריה, עם חיפוש, מיון וסינון תת-קטגוריה. */
function CategoryPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const wishlistIds = useSelector(selectWishlistIds);
  const addToCart = useCallback((product, quantity) => dispatch(addItem(product, quantity)), [dispatch]);
  const toggleCardWishlist = useCallback((product) => dispatch(toggleWishlist(product)), [dispatch]);

  const category = categories.find((c) => c.id === slug);
  // קטגוריה שלא קיימת מוצגת כ-404, ושם הכותרת צריכה להגיד את זה:
  // האפקט של ההורה רץ אחרי זה של NotFoundPage, וידרוס אותו.
  usePageTitle(category ? category.name : 'העמוד לא נמצא');
  const selectedSubcategory = searchParams.get('sub');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    if (!category) return;
    const controller = new AbortController();

    setLoading(true);
    setSearchQuery('');
    setSortBy('default');

    // הסינון לפי קטגוריה נעשה בשרת ולא כאן. בלי limit במכוון — העמוד
    // הזה מציג את כל מוצרי הקטגוריה ולא תצוגה מקוצרת שלהם.
    // החיפוש והמיון שלמטה נשארים בצד הלקוח: הם פועלים על הקבוצה
    // הקטנה שכבר נשלפה, וזה שימוש לגיטימי בסינון מקומי.
    getProducts({ category: category.id, signal: controller.signal })
      .then(({ products: list }) => {
        setProducts(list);
        setLoading(false);
      })
      // ביטול אינו כישלון: המעבר לקטגוריה אחרת כבר הדליק טעינה
      // מחדש, וכיבוי שלה כאן היה מציג רשת ריקה עד שהבקשה החדשה תחזור.
      .catch((err) => { if (!isAbortError(err)) setLoading(false); });

    return () => controller.abort();
  }, [category]);

  // מספר המוצרים בכל תת-קטגוריה, מתוך מה שנשלף. מחושב פעם אחת לכל
  // שליפה ולא בכל הקלדה בחיפוש.
  const subcategoryCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.subcategory) counts[p.subcategory] = (counts[p.subcategory] || 0) + 1;
    });
    return counts;
  }, [products]);

  /* ?sub= שמצביע על תת-קטגוריה בלי מוצרים — שאינה מוצגת בסרגל, ואולי
     כבר לא קיימת — חוזר בשקט ל"הכל" (replace, לא עוד כניסה ב"חזור").
     רק אחרי הטעינה: לפניה כל תת-קטגוריה נראית ריקה. */
  const subIsEmpty = Boolean(selectedSubcategory) && !loading && !subcategoryCounts[selectedSubcategory];
  useEffect(() => {
    if (!subIsEmpty) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('sub');
      return next;
    }, { replace: true });
  }, [subIsEmpty, setSearchParams]);

  if (!category) return <NotFoundPage />;

  /** מחליף תת-קטגוריה, ומחליף את רשומת ההיסטוריה כדי לא להציף אותה. */
  function selectSubcategory(id) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('sub', id);
    else next.delete('sub');
    setSearchParams(next, { replace: true });
  }

  const activeSubcategory = subIsEmpty ? null : selectedSubcategory;

  const filtered = products
    .filter((p) => !activeSubcategory || p.subcategory === activeSubcategory)
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const hasFilters = Boolean(searchQuery || activeSubcategory);

  /** מנקה את החיפוש ואת הסינון, מהמצב הריק. */
  function clearFilters() {
    setSearchQuery('');
    selectSubcategory(null);
  }

  const sorted = (() => {
    switch (sortBy) {
      case 'price-asc':  return sortByPrice(filtered, 'asc');
      case 'price-desc': return sortByPrice(filtered, 'desc');
      case 'name':       return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'he'));
      case 'instock':    return [...filtered].sort((a, b) => (b.in_stock !== false ? 1 : 0) - (a.in_stock !== false ? 1 : 0));
      default:           return filtered;
    }
  })();

  return (
    <>
      <CategoryBanner category={category} productCount={loading ? null : products.length} />

      <div className="category-page">
        <div className="category-layout">
          {category.subcategories?.length > 0 && (
            <CategoryFilters
              subcategories={category.subcategories}
              counts={subcategoryCounts}
              total={products.length}
              selected={activeSubcategory}
              onSelect={selectSubcategory}
            />
          )}

          <div className="category-main">
            <CategoryToolbar
              count={sorted.length}
              loading={loading}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              sortBy={sortBy}
              onSort={setSortBy}
              sortOptions={SORT_OPTIONS}
            />

            {/* כותרת לקורא המסך: כרטיסי המוצר הם h3, ובטלפון כותרת תתי-
                הקטגוריות מוסתרת — בלי זו הם היו יושבים ישר מתחת ל-h1. */}
            <h2 className="visually-hidden">מוצרים</h2>

            <ProductList
              products={sorted}
              loading={loading}
              categoryIdFor={() => category.id}
              onAddToCart={addToCart}
              wishlistIds={wishlistIds}
              onToggleWishlist={toggleCardWishlist}
              reveal
              emptyState={(
                <div className="product-grid-empty">
                  <span className="product-grid-empty-icon">
                    <PackageSearch size={30} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <h2>לא נמצאו מוצרים</h2>
                  <p>
                    {hasFilters
                      ? 'אף מוצר בקטגוריה הזו לא מתאים לחיפוש ולסינון הנוכחיים.'
                      : 'הקטגוריה הזו עדיין מתמלאת. בחנות יש הרבה יותר ממה שהאתר מספיק להציג.'}
                  </p>
                  <div className="product-grid-empty-actions">
                    {/* מוצג רק כשיש מה לנקות: בקטגוריה ריקה באמת הכפתור הזה
                        לא היה משנה כלום */}
                    {hasFilters && (
                      <button type="button" onClick={clearFilters}>
                        <X size={15} aria-hidden="true" /> נקה חיפוש וסינון
                      </button>
                    )}
                    <a href={`tel:${PHONES.store.tel}`}>
                      <Phone size={15} aria-hidden="true" /> להתייעצות: {PHONES.store.display}
                    </a>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * סינון תת-קטגוריה בעמוד הקטגוריה.
 *
 * רכיב אחד ושתי צורות: סרגל צד דביק במסך רחב, ושורת צ'יפים נגללת
 * בטלפון. ה-DOM זהה בשתיהן וה-CSS הוא שמחליף ביניהן (ראה
 * features/category/_category-filters.css) — רינדור כפול והסתרה של אחד מהם היה
 * מכניס כל תת-קטגוריה לעץ הנגישות פעמיים.
 *
 * המספרים מחושבים מהמוצרים שנשלפו, ולא בשליפה נפרדת: השליפה הזו כבר
 * הביאה את כל מוצרי הקטגוריה, וספירה שלהם כאן זולה משנים-עשר מסלולי
 * שרת נוספים.
 *
 * תת-קטגוריה בלי מוצרים אינה מוצגת: כפתור שמוביל לרשת ריקה הוא מבוי
 * סתום, ושורה של אפסים נראית כמו אתר שבור. "הכל" מוצג תמיד.
 */
function CategoryFilters({ subcategories, counts, total, selected, onSelect }) {
  /* "הכל" הוא פריט ברשימה ולא מקרה מיוחד: אותו כפתור, עם null כמזהה. */
  const items = [
    { id: null, name: 'הכל', count: total },
    ...subcategories
      .map((sub) => ({ id: sub.id, name: sub.name, count: counts[sub.id] || 0 }))
      .filter((item) => item.count > 0),
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

export default CategoryPage;
