import categories from './categories';

function CategoryPage({ onSelectCategory }) {
  return (
    <div className="category-page">
      <h2>מה אתם מחפשים?</h2>
      <div className="categories-grid">
        {categories.map(category => (
          <div
            key={category.id}
            className="category-card"
            style={{ backgroundColor: category.color }}
            onClick={() => onSelectCategory(category)}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
            {category.subcategories?.length > 0 && (
              <span className="category-sub-hint">
                {category.subcategories.slice(0, 3).map(s => s.name).join(' · ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryPage;