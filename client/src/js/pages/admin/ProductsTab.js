/**
 * לשונית המוצרים: חיפוש, סינון לפי קטגוריה ורשימת המוצרים.
 *
 * החיפוש והסינון הם state מקומי של הלשונית. "ערוך" אינו טוען את
 * הטופס בעצמו אלא רק מסמן את המוצר הנערך ב-Admin ועובר ללשונית
 * הטופס, וזה מה שממלא את השדות.
 *
 * מוצר אחד הוא AdminProductCard, שמחזיק גם את עריכת המחיר במקום.
 */
import { useState } from 'react';
import { Search, X, Store, AlertTriangle } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { CATEGORIES } from './adminConstants';
import AdminProductCard from './AdminProductCard';

/** מציג את לשונית המוצרים. */
function ProductsTab({ products, onEdit, onDelete, onToggleStock, onUpdatePrice, productsError }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter(p => {
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    const matchSearch = !query
      || p.name.toLowerCase().includes(query)
      || (p.sku && p.sku.toLowerCase().includes(query));
    return matchCat && matchSearch;
  });

  /* רק הקטגוריות שיש בהן מוצרים. שבב עם 0 הוא שבב שאין בו מה ללחוץ,
     ובטלפון הוא מאריך את הרצועה שצריך לגלול. */
  const usedCategories = CATEGORIES
    .map(cat => ({ ...cat, count: products.filter(p => p.category === cat.id).length }))
    .filter(cat => cat.count > 0);

  return (
    <div className="admin-products">
      <div className="admin-search">
        <Search className="admin-search-icon" size={20} aria-hidden="true" />
        <input
          className="admin-search-input"
          placeholder="חפש לפי שם או מק״ט"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="חיפוש מוצר"
        />
        {searchQuery && (
          <button type="button" className="admin-search-clear" onClick={() => setSearchQuery('')} aria-label="נקה חיפוש">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="admin-cats" role="group" aria-label="סינון לפי קטגוריה">
        <button
          type="button"
          className={`admin-cat ${filterCategory === 'all' ? 'is-active' : ''}`}
          aria-pressed={filterCategory === 'all'}
          onClick={() => setFilterCategory('all')}>
          <Store size={18} aria-hidden="true" /> הכל
          <span className="admin-cat-count">{products.length}</span>
        </button>

        {usedCategories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              className={`admin-cat ${filterCategory === cat.id ? 'is-active' : ''}`}
              aria-pressed={filterCategory === cat.id}
              onClick={() => setFilterCategory(cat.id)}>
              {Icon && <Icon size={18} aria-hidden="true" />} {cat.label}
              <span className="admin-cat-count">{cat.count}</span>
            </button>
          );
        })}
      </div>

      {productsError && (
        <div className="admin-error">
          <AlertTriangle size={18} aria-hidden="true" /> {productsError}
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="admin-empty">
          {query ? `לא נמצא מוצר בשם "${searchQuery.trim()}"` : 'אין מוצרים בקטגוריה הזו'}
        </div>
      ) : (
        <div className="admin-product-list">
          {filteredProducts.map(product => (
            <AdminProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleStock={onToggleStock}
              onUpdatePrice={onUpdatePrice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsTab;
