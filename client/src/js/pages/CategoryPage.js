/**
 * עמוד קטגוריה: רשת המוצרים ובחירת תת-קטגוריה.
 */
import categories from '../features/catalog/categories';
import CATEGORY_ICONS from '../utils/categoryIcons';
import Reveal, { stagger } from '../components/Reveal';

/** מציג את מוצרי הקטגוריה ואת תתי-הקטגוריות שלה. */
function CategoryPage({ onSelectCategory }) {
  return (
    <div className="category-page">
      <Reveal as="h2" variant="up">מה אתם מחפשים?</Reveal>
      <div className="categories-grid">
        {categories.map((category, i) => {
          const Icon = CATEGORY_ICONS[category.id];
          return (
            /* הכרטיס עצמו הוא אלמנט החשיפה ולא div סביבו — wrapper היה הופך
               להיות פריט הרשת ושובר את המידות של הכרטיס. */
            <Reveal
              as="div"
              variant="tilt"
              delay={stagger(i)}
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
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

export default CategoryPage;