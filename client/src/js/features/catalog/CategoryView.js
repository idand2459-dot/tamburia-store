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
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Check, X, Heart } from 'lucide-react';
import categories from './categories';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import CategoryBanner from './CategoryBanner';
import CategoryFilters from './CategoryFilters';
import CategoryToolbar from './CategoryToolbar';
import NotFoundPage from '../../pages/NotFoundPage';
import { ProductCardSkeleton } from '../../components/LoadingStates';
import { useStore } from '../../context/storeContext';

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
  const navigate = useNavigate();
  const { addToCart, wishlistIds, toggleCardWishlist } = useStore();

  const category = categories.find((c) => c.id === slug);
  const selectedSubcategory = searchParams.get('sub');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    if (!category) return;
    let cancelled = false;

    setLoading(true);
    setSearchQuery('');
    setSortBy('default');

    // הסינון לפי קטגוריה נעשה בשרת ולא כאן. בלי limit במכוון — העמוד
    // הזה מציג את כל מוצרי הקטגוריה ולא תצוגה מקוצרת שלהם.
    // החיפוש והמיון שלמטה נשארים בצד הלקוח: הם פועלים על הקבוצה
    // הקטנה שכבר נשלפה, וזה שימוש לגיטימי בסינון מקומי.
    fetch(`/api/products?category=${encodeURIComponent(category.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProducts(Array.isArray(data) ? data : (data.products || []));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
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

  const CategoryIcon = CATEGORY_ICONS[category.id];

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

            <div className="products-grid">
              {loading
                ? Array(6).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)
                : sorted.map((product) => (
                  <div
                    key={product.id}
                    className="product-card"
                    onClick={() => navigate(`/product/${product.id}`)}
                    style={{ cursor: 'pointer' }}>
                    <div className="product-img-wrap">
                      <div className="product-img-placeholder">
                        {CategoryIcon && <CategoryIcon className="product-img-icon" size={22} aria-hidden="true" />}
                        <span className="product-img-initial">{product.name.charAt(0)}</span>
                      </div>
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <h3>{product.name}</h3>
                    {product.sku && <p className="product-sku">מק"ט: {product.sku}</p>}
                    <p className="price">
                      {Array.isArray(product.variants) && product.variants.length > 0
                        ? <>מ-₪{Math.min(...product.variants.map((v) => v.price))} <span className="price-variants-hint">· {product.variants.length} גרסאות</span></>
                        : <>₪{product.price}</>}
                    </p>
                    <p className={`stock ${product.in_stock !== false ? '' : 'out-of-stock-label'}`}>
                      {product.in_stock !== false ? <><Check size={14} aria-hidden="true" /> יש במלאי</> : <><X size={14} aria-hidden="true" /> אזל מהמלאי</>}
                    </p>
                    <div className="card-bottom-actions">
                      <button
                        className={`card-add-btn ${product.in_stock === false ? 'btn-disabled' : ''}`}
                        onClick={(e) => { e.stopPropagation(); if (product.in_stock !== false) addToCart(product); }}
                        disabled={product.in_stock === false}>
                        {product.in_stock !== false ? 'הוסף לעגלה' : 'אזל מהמלאי'}
                      </button>
                      <button
                        className={`card-wishlist-btn ${wishlistIds.includes(product.id) ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleCardWishlist(product); }}
                        title={wishlistIds.includes(product.id) ? 'הסר' : 'הוסף למשאלות'}>
                        <Heart size={18} fill={wishlistIds.includes(product.id) ? 'currentColor' : 'none'} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default CategoryView;
