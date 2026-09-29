/**
 * לשונית המוצרים: חיפוש, סינון ורשימת המוצרים.
 *
 * החיפוש והסינון הם state מקומי של הלשונית. "ערוך" אינו טוען את
 * הטופס בעצמו אלא רק מסמן את המוצר הנערך ב-Admin ועובר ללשונית
 * הטופס, וזה מה שממלא את השדות.
 *
 * שני שבבים בשורה אינם קטגוריה, ושניהם רשימות משימות ולא עוד דרך
 * לעיין בקטלוג: "ללא מחיר" מראה מוצרים שהמחיר שלהם במסד 0 ולכן אי
 * אפשר להזמין אותם, ו"מוסתרים" מראה את מה שהוצא מהחנות. הם יושבים
 * באותה שורה ובאותו state כמו הקטגוריות, כדי שהבחירה תישאר "מה אני
 * רואה עכשיו" אחת ויחידה ולא שלושה צירי סינון שצריך להחזיק בראש
 * בטלפון.
 *
 * כל מה שאינו השבב הזה מראה מוצרים גלויים בלבד — גם "הכל" וגם כל
 * קטגוריה. מוצר מוסתר אינו בחנות, ואין סיבה שהוא יצוץ בין המוצרים
 * שעובדים עליהם; מי שמחפש אותו יודע לאן ללחוץ. החיפוש לפי שם ומק"ט
 * הוא היוצא מן הכלל: הוא מחפש בקטלוג כולו, כי מי שמקליד שם מדויק
 * מחפש מוצר ולא מסנן רשימה.
 *
 * מוצר אחד הוא AdminProductCard, שמחזיק גם את עריכת המחיר במקום.
 */
import { useState } from 'react';
import { Search, X, Store, AlertTriangle, CircleDollarSign, EyeOff } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { hasPrice } from '../../utils/pricing';
import { CATEGORIES } from './adminConstants';
import AdminProductCard from './AdminProductCard';

/* מזהי השבבים שאינם קטגוריה. עם מקף, כדי שלא יתנגשו במזהה קטגוריה. */
const NO_PRICE_FILTER = 'no-price';
const HIDDEN_FILTER = 'hidden';

/** האם המוצר גלוי בחנות. ברירת המחדל היא כן, כמו במסד. */
const isVisible = (product) => product.active !== false;

/** מציג את לשונית המוצרים. */
function ProductsTab({
  products, onEdit, onDelete, onToggleStock, onToggleActive, onUpdatePrice, productsError,
}) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter(p => {
    const matchFilter = filter === HIDDEN_FILTER
      ? !isVisible(p)
      : isVisible(p) && (
        filter === 'all'
        || (filter === NO_PRICE_FILTER ? !hasPrice(p) : p.category === filter)
      );

    // חיפוש מפורש עוקף את הסינון ומגיע גם למוסתרים: מי שמקליד מק"ט
    // מחפש מוצר מסוים, ולא היה מוצא אותו אחרי שהסתיר אותו.
    if (query) {
      return p.name.toLowerCase().includes(query)
        || (p.sku && p.sku.toLowerCase().includes(query));
    }
    return matchFilter;
  });

  const visibleProducts = products.filter(isVisible);
  const hiddenCount = products.length - visibleProducts.length;
  const noPriceCount = visibleProducts.filter(p => !hasPrice(p)).length;

  /* כמו שבב קטגוריה ריק, הוא אינו מוצג כשאין בו מה ללחוץ — וזה גם
     הסימן שלכל המוצרים יש מחיר. אבל כשהוא הסינון הפעיל הוא נשאר,
     אחרת תיקון המוצר האחרון היה משאיר רשימה ריקה בלי שבב לחזור דרכו. */
  const showNoPrice = noPriceCount > 0 || filter === NO_PRICE_FILTER;

  /* אותו כלל בדיוק לשבב המוסתרים: הוא מופיע רק כשיש מה להסתכל עליו,
     ונשאר כשהוא הסינון הפעיל — אחרת החזרת המוצר האחרון לחנות הייתה
     משאירה רשימה ריקה בלי שבב לחזור דרכו. */
  const showHidden = hiddenCount > 0 || filter === HIDDEN_FILTER;

  /* רק הקטגוריות שיש בהן מוצרים. שבב עם 0 הוא שבב שאין בו מה ללחוץ,
     ובטלפון הוא מאריך את הרצועה שצריך לגלול. הספירה היא של הגלויים
     בלבד, כמו הרשימה שהשבב פותח. */
  const usedCategories = CATEGORIES
    .map(cat => ({ ...cat, count: visibleProducts.filter(p => p.category === cat.id).length }))
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
          <span className="admin-cat-count">{visibleProducts.length}</span>
        </button>

        {/* לפני "ללא מחיר": מוצר מוסתר אינו נמכר בכלל, ולכן זו השאלה
            הראשונה על הקטלוג ולא השנייה */}
        {showHidden && (
          <button
            type="button"
            className={`admin-cat admin-cat--muted ${filter === HIDDEN_FILTER ? 'is-active' : ''}`}
            aria-pressed={filter === HIDDEN_FILTER}
            onClick={() => setFilter(HIDDEN_FILTER)}>
            <EyeOff size={18} aria-hidden="true" /> מוסתרים
            <span className="admin-cat-count">{hiddenCount}</span>
          </button>
        )}

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
            : filter === HIDDEN_FILTER ? 'כל המוצרים מוצגים בחנות'
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
              onToggleActive={onToggleActive}
              onUpdatePrice={onUpdatePrice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsTab;
