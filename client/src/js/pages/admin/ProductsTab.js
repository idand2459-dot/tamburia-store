/**
 * לשונית המוצרים: חיפוש, סינון לפי קטגוריה וגריד הכרטיסים.
 *
 * החיפוש והסינון הם state מקומי של הלשונית. "ערוך" אינו טוען את
 * הטופס בעצמו אלא רק מסמן את המוצר הנערך ב-Admin ועובר ללשונית
 * הטופס, וזה מה שממלא את השדות.
 */
import { useState } from 'react';
import { CATEGORIES } from './adminConstants';

/** מציג את לשונית המוצרים. */
function ProductsTab({ products, onEdit, onDelete, onToggleStock, productsError }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p => {
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="admin-search-bar">
        <input placeholder="🔍 חפש לפי שם או מק״ט..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {searchQuery && <button className="admin-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
      </div>
      <div className="admin-category-filter">
        <button className={`admin-cat-btn ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>🏪 הכל <span className="admin-cat-count">{products.length}</span></button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} className={`admin-cat-btn ${filterCategory === cat.id ? 'active' : ''}`} onClick={() => setFilterCategory(cat.id)}>
            {cat.icon} {cat.label} <span className="admin-cat-count">{products.filter(p => p.category === cat.id).length}</span>
          </button>
        ))}
      </div>
      <div className="admin-results-info">{(searchQuery || filterCategory !== 'all') ? `מציג ${filteredProducts.length} מוצרים` : ''}</div>
      {productsError && <div className="admin-error">⚠️ {productsError}</div>}
      {filteredProducts.length === 0 ? <div className="admin-empty">אין מוצרים</div> : (
        <div className="admin-products-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="admin-product-card">
              {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="admin-product-no-img">אין תמונה</div>}
              <div className="admin-product-body">
                <div className="admin-product-title">{product.name}</div>
                {product.sku && <div className="admin-product-sku">מק"ט: {product.sku}</div>}
                <div className="admin-product-meta">
                  <span className="admin-price">₪{product.price}</span>
                  <button className={`stock-toggle-btn ${product.in_stock !== false ? 'in' : 'out'}`} onClick={() => onToggleStock(product)} title="לחץ לשינוי מלאי">
                    {product.in_stock !== false ? '✓ במלאי' : '✗ אזל'}
                  </button>
                </div>
                {product.category && <div className="admin-category-tag">{CATEGORIES.find(c => c.id === product.category)?.icon} {CATEGORIES.find(c => c.id === product.category)?.label}</div>}
              </div>
              <div className="admin-product-actions">
                <button className="edit-btn" onClick={() => onEdit(product)}>ערוך</button>
                <button className="delete-btn" onClick={() => onDelete(product.id)}>מחק</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsTab;
