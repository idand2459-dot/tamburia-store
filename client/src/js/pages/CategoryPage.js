/**
 * עמוד קטגוריה: רשת המוצרים ובחירת תת-קטגוריה.
 */
import categories from '../features/catalog/categories';
import CATEGORY_ICONS from '../utils/categoryIcons';

/** מציג את מוצרי הקטגוריה ואת תתי-הקטגוריות שלה. */
function CategoryPage({ onSelectCategory }) {
  return (
    <div className="category-page">
      <h2>מה אתם מחפשים?</h2>
      <div className="categories-grid">
        {categories.map(category => {
          const Icon = CATEGORY_ICONS[category.id];
          return (
            <div
              key={category.id}
              className="category-card"
              style={{ backgroundColor: category.color }}
              onClick={() => onSelectCategory(category)}
            >
              <span className="category-icon">{Icon && <Icon size={40} aria-hidden="true" />}</span>
              <span className="category-name">{category.name}</span>
              {category.subcategories?.length > 0 && (
                <span className="category-sub-hint">
                  {category.subcategories.slice(0, 3).map(s => s.name).join(' · ')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CategoryPage;