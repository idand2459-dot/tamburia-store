/**
 * לשונית המוצרים: חיפוש, סינון ורשימת המוצרים.
 *
 * החיפוש והסינון הם state מקומי של הלשונית. "ערוך" אינו טוען את
 * הטופס בעצמו אלא רק מסמן את המוצר הנערך ב-Admin ועובר ללשונית
 * הטופס, וזה מה שממלא את השדות.
 *
 * שבב אחד בשורה אינו קטגוריה: "ללא מחיר" מראה את המוצרים שהמחיר
 * שלהם במסד 0. באתר אי אפשר להזמין אותם, ולכן הרשימה הזו היא רשימת
 * משימות. הוא יושב באותה שורה ובאותו state כמו הקטגוריות, כדי
 * שהבחירה תישאר "מה אני רואה עכשיו" אחת ויחידה ולא שני צירי סינון
 * שצריך להחזיק בראש בטלפון.
 *
 * מוצר אחד הוא AdminProductCard, שמחזיק גם את עריכת המחיר במקום.
 */
import { useState } from 'react';
import { Search, X, Store, AlertTriangle, CircleDollarSign } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { hasPrice } from '../../utils/pricing';
import { CATEGORIES } from './adminConstants';
import AdminProductCard from './AdminProductCard';

/* מזהה השבב שאינו קטגוריה. עם מקף, כדי שלא יתנגש במזהה קטגוריה. */
const NO_PRICE_FILTER = 'no-price';

/** מציג את לשונית המוצרים. */
function ProductsTab({ products, onEdit, onDelete, onToggleStock, onUpdatePrice, productsError }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter(p => {
    const matchFilter = filter === 'all'
      || (filter === NO_PRICE_FILTER ? !hasPrice(p) : p.category === filter);
    const matchSearch = !query
      || p.name.toLowerCase().includes(query)
      || (p.sku && p.sku.toLowerCase().includes(query));
    return matchFilter && matchSearch;
  });

  const noPriceCount = products.filter(p => !hasPrice(p)).length;

  /* כמו שבב קטגוריה ריק, הוא אינו מוצג כשאין בו מה ללחוץ — וזה גם
     הסימן שלכל המוצרים יש מחיר. אבל כשהוא הסינון הפעיל הוא נשאר,
     אחרת תיקון המוצר האחרון היה משאיר רשימה ריקה בלי שבב לחזור דרכו. */
  const showNoPrice = noPriceCount > 0 || filter === NO_PRICE_FILTER;

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

      <div className="admin-cats" role="group" aria-label="סינון מוצרים">
        <button
          type="button"
          className={`admin-cat ${filter === 'all' ? 'is-active' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}>
          <Store size={18} aria-hidden="true" /> הכל
          <span className="admin-cat-count">{products.length}</span>
        </button>

        {/* מיד אחרי "הכל" ולפני הקטגוריות: זו רשימת עבודה, לא עוד דרך
            לעיין בקטלוג */}
        {showNoPrice && (
          <button
            type="button"
            className={`admin-cat admin-cat--alert ${filter === NO_PRICE_FILTER ? 'is-active' : ''}`}
            aria-pressed={filter === NO_PRICE_FILTER}
            onClick={() => setFilter(NO_PRICE_FILTER)}>
            <CircleDollarSign size={18} aria-hidden="true" /> ללא מחיר
            <span className="admin-cat-count">{noPriceCount}</span>
          </button>
        )}

        {usedCategories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              className={`admin-cat ${filter === cat.id ? 'is-active' : ''}`}
              aria-pressed={filter === cat.id}
              onClick={() => setFilter(cat.id)}>
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
          {query ? `לא נמצא מוצר בשם "${searchQuery.trim()}"`
            : filter === NO_PRICE_FILTER ? 'לכל המוצרים יש מחיר'
            : 'אין מוצרים בקטגוריה הזו'}
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
