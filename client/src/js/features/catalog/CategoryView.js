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
import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PackageSearch, X, Phone } from 'lucide-react';
import categories from './categories';
import CategoryBanner from './CategoryBanner';
import CategoryFilters from './CategoryFilters';
import CategoryToolbar from './CategoryToolbar';
import NotFoundPage from '../../pages/NotFoundPage';
import ProductList from '../../components/ProductList';
import { PHONES } from '../../utils/storeInfo';
import { useStore } from '../../context/storeContext';
import { getProducts, isAbortError } from '../../services/productService';

const SORT_OPTIONS = [
  { value: 'default', label: 'ברירת מחדל' },
  { value: 'price-asc', label: 'מחיר ↑' },
  { value: 'price-desc', label: 'מחיר ↓' },
  { value: 'name', label: 'א-ב' },
  { value: 'instock', label: 'במלאי קודם' },
];

/** מציג את מוצרי הקטגוריה, עם חיפוש, מיון וסינון תת-קטגוריה. */
function CategoryView() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart, wishlistIds, toggleCardWishlist } = useStore();

  const category = categories.find((c) => c.id === slug);
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

  if (!category) return <NotFoundPage />;

  /** מחליף תת-קטגוריה, ומחליף את רשומת ההיסטוריה כדי לא להציף אותה. */
  function selectSubcategory(id) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('sub', id);
    else next.delete('sub');
    setSearchParams(next, { replace: true });
  }

  const filtered = products
    .filter((p) => !selectedSubcategory || p.subcategory === selectedSubcategory)
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const hasFilters = Boolean(searchQuery || selectedSubcategory);

  /** מנקה את החיפוש ואת הסינון, מהמצב הריק. */
  function clearFilters() {
    setSearchQuery('');
    selectSubcategory(null);
  }

  const sorted = (() => {
    switch (sortBy) {
      case 'price-asc':  return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-desc': return [...filtered].sort((a, b) => b.price - a.price);
      case 'name':       return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'he'));
      case 'instock':    return [...filtered].sort((a, b) => (b.in_stock !== false ? 1 : 0) - (a.in_stock !== false ? 1 : 0));
      default:           return filtered;
    }
  })();

  return (
    <>
      <CategoryBanner category={category} productCount={loading ? null : products.length} />

      <main className="category-page">
        <div className="category-layout">
          {category.subcategories?.length > 0 && (
            <CategoryFilters
              subcategories={category.subcategories}
              counts={subcategoryCounts}
              total={products.length}
              selected={selectedSubcategory}
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
      </main>
    </>
  );
}

export default CategoryView;
