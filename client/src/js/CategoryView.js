/**
 * עמוד קטגוריה: /category/:slug
 *
 * ה-slug הוא מזהה הקטגוריה מ-categories.js. slug שאינו מוכר מוצג
 * כ-404 ולא כעמוד ריק. תת-הקטגוריה נשמרת ב-query (?sub=), כך שגם
 * סינון אפשר לשתף בקישור; החיפוש והמיון נשארו מצב מקומי, כי הם
 * משתנים בכל הקלדה והיו מציפים את היסטוריית הדפדפן.
 */
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import categories from './categories';
import CategoryBanner from './CategoryBanner';
import CategoryAmbience from './CategoryAmbience';
import NotFoundPage from './NotFoundPage';
import { ProductCardSkeleton } from './LoadingStates';
import { useStore } from './storeContext';

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

    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setProducts(list.filter((p) => p.category === category.id));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [category]);

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
      <CategoryAmbience categoryId={category.id} />
      <CategoryBanner category={category} onBack={() => navigate('/')} />

      {category.subcategories?.length > 0 && (
        <div className="subcategory-chips">
          <button
            className={`subcategory-chip ${!selectedSubcategory ? 'active' : ''}`}
            onClick={() => selectSubcategory(null)}>
            הכל
          </button>
          {category.subcategories.map((sub) => (
            <button
              key={sub.id}
              className={`subcategory-chip ${selectedSubcategory === sub.id ? 'active' : ''}`}
              onClick={() => selectSubcategory(selectedSubcategory === sub.id ? null : sub.id)}>
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <main style={{ '--cat-color': category.color }}>
        <div className="products-toolbar">
          <div className="search-bar">
            <input
              placeholder="🔍 חפש מוצר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sort-bar">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`sort-btn ${sortBy === opt.value ? 'active' : ''}`}
                onClick={() => setSortBy(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="products-count">{!loading && `${sorted.length} מוצרים`}</div>

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
                  <div className="product-img-placeholder" data-icon={category.icon}>
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
                  {product.in_stock !== false ? '✓ יש במלאי' : '✗ אזל מהמלאי'}
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
                    {wishlistIds.includes(product.id) ? '❤️' : '🤍'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </main>
    </>
  );
}

export default CategoryView;
