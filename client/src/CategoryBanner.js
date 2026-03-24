const CATEGORY_CONFIG = {
  painting:   { name: 'מוצרי צביעה',           icon: '🎨', gradient: 'linear-gradient(135deg, #c1121f 0%, #e63946 50%, #ff6b6b 100%)', desc: 'צבעים, מברשות, רולרים וכל מה שצריך לצביעה מקצועית' },
  tools:      { name: 'כלי עבודה',              icon: '🔧', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d3561 50%, #457b9d 100%)', desc: 'פטישים, מברגים, מסורים וכלי עבודה מקצועיים' },
  plumbing:   { name: 'אינסטלציה',              icon: '🔩', gradient: 'linear-gradient(135deg, #0077b6 0%, #0096c7 50%, #48cae4 100%)', desc: 'צינורות, חיבורים וכל פתרונות האינסטלציה' },
  faucets:    { name: 'ברזים',                  icon: '🚰', gradient: 'linear-gradient(135deg, #023e8a 0%, #0077b6 50%, #48cae4 100%)', desc: 'ברזים, מחברים ואביזרי מים איכותיים' },
  locks:      { name: 'פירזול צילינדרים ומנעולים', icon: '🔐', gradient: 'linear-gradient(135deg, #212529 0%, #343a40 50%, #495057 100%)', desc: 'מנעולים, צילינדרים וכל פתרונות האבטחה' },
  adhesives:  { name: 'דבקים',                  icon: '🗜️', gradient: 'linear-gradient(135deg, #e76f51 0%, #f4a261 50%, #ffd166 100%)', desc: 'דבקים, סיליקון, טייץ וחומרי איטום' },
  cleaning:   { name: 'ניקיון',                 icon: '🧹', gradient: 'linear-gradient(135deg, #6a4c93 0%, #9b5de5 50%, #c77dff 100%)', desc: 'חומרי ניקוי, ספוגים ומוצרי ניקיון לבית' },
  garden:     { name: 'גינה',                   icon: '🌿', gradient: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 50%, #52b788 100%)', desc: 'זרנוקים, כלי גינון ומוצרים לגינה' },
  bathroom:   { name: 'מוצרי אמבטיה',           icon: '🚿', gradient: 'linear-gradient(135deg, #457b9d 0%, #1d3557 50%, #a8dadc 100%)', desc: 'מראות, וילונות ואביזרי אמבטיה' },
  kitchen:    { name: 'מוצרי מטבח',             icon: '🍳', gradient: 'linear-gradient(135deg, #2a9d8f 0%, #264653 50%, #e9c46a 100%)', desc: 'כיורים, ברזים ואביזרי מטבח' },
  electrical: { name: 'מוצרי חשמל',             icon: '⚡', gradient: 'linear-gradient(135deg, #f4c430 0%, #e9c46a 50%, #ffb703 100%)', desc: 'שקעים, מפסקים וציוד חשמל' },
  home:       { name: 'בית',                    icon: '🏠', gradient: 'linear-gradient(135deg, #8338ec 0%, #6a4c93 50%, #c77dff 100%)', desc: 'מוצרים לכל הבית במקום אחד' },
};

function CategoryBanner({ category, onBack }) {
  const cfg = CATEGORY_CONFIG[category?.id] || {
    name: category?.name || '',
    icon: category?.icon || '🛒',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    desc: ''
  };

  return (
    <div className="category-banner" style={{ background: cfg.gradient }}>
      <div className="category-banner-content">
        <button className="category-banner-back" onClick={onBack}>← כל הקטגוריות</button>
        <div className="category-banner-main">
          <span className="category-banner-icon">{cfg.icon}</span>
          <div>
            <h1 className="category-banner-title">{cfg.name}</h1>
            <p className="category-banner-desc">{cfg.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryBanner;