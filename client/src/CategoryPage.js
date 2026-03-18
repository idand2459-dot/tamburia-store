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
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryPage;