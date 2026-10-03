/**
 * מקטע הקטגוריות בדף הבית: רשת כרטיסי הקטגוריות.
 *
 * לא עמוד הקטגוריה (זה pages/CategoryPage) — זה המקטע שמופיע בדף הבית
 * מתחת ל-Hero, ולכן המחלקות נקראות category-section.
 */
import categories from '../catalog/categories';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import Reveal, { stagger } from '../../components/Reveal';
import { ArrowLeft } from 'lucide-react';

/** מציג את כל הקטגוריות ככרטיסים לבנים על מקטע בהיר. */
function CategoryGrid({ onSelectCategory }) {
  return (
    <section className="category-section">
      <div className="category-section-inner">
        <Reveal as="div" variant="up" className="category-header">
          <span className="section-pill section-pill--light">קטגוריות</span>
          <h2 className="category-title">מה אתם <span>מחפשים?</span></h2>
          <p className="category-subtitle">
            {categories.length} קטגוריות · מאות מוצרים לבית ולעבודה
          </p>
        </Reveal>

        <div className="categories-grid">
          {categories.map((category, i) => {
            const Icon = CATEGORY_ICONS[category.id];
            const open = () => onSelectCategory(category);
            /* div עם role="link" לא מקבל הפעלה מהמקלדת בחינם, ולכן Enter
               ו-Space מטופלים כאן במפורש. */
            const onKeyDown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            };
            return (
              /* הכרטיס עצמו הוא אלמנט החשיפה ולא div סביבו — wrapper היה הופך
                 להיות פריט הרשת ושובר את המידות של הכרטיס. */
              <Reveal
                as="div"
                variant="tilt"
                delay={stagger(i)}
                key={category.id}
                className="category-card"
                role="link"
                tabIndex={0}
                onClick={open}
                onKeyDown={onKeyDown}
              >
                <span className="category-icon">
                  {Icon && <Icon size={28} strokeWidth={1.75} aria-hidden="true" />}
                </span>
                <span className="category-name">{category.name}</span>
                {category.subcategories?.length > 0 && (
                  <span className="category-sub-hint">
                    {category.subcategories.slice(0, 3).map(s => s.name).join(' · ')}
                  </span>
                )}
                <ArrowLeft className="category-arrow" size={18} aria-hidden="true" />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CategoryGrid;
