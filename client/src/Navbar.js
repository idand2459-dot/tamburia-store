import { useState, useEffect, useRef } from 'react';

function Navbar({ currentPage, onNavigate, onSelectProduct, cartCount, total, onOpenCart, menuOpen, setMenuOpen, onOpenOrderHistory, onOpenWishlist }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const searchInputRef = useRef(null);

  const navItems = [
    { key: 'home', label: 'ראשי', icon: '🏠' },
    { key: 'about', label: 'אודות', icon: '🏪' },
    { key: 'contact', label: 'צור קשר', icon: '📞' },
    { key: 'returns', label: 'מדיניות החזרים', icon: '↩️' },
  ];

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setAllProducts);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') closeSearch(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchResults(allProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8));
  }

  function closeSearch() { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }
  function handleSelectProduct(product) { closeSearch(); onSelectProduct(product); }
  function handleNav(key) { onNavigate(key); setMenuOpen(false); }

  const CATEGORY_LABELS = {
    painting: 'מוצרי צביעה', kitchen: 'מוצרי מטבח', bathroom: 'מוצרי אמבטיה',
    tools: 'כלי עבודה', cleaning: 'ניקיון', garden: 'גינה',
    plumbing: 'אינסטלציה', adhesives: 'דבקים', locks: 'פירזול צילינדרים ומנעולים', faucets: 'ברזים',
    electrical: 'מוצרי חשמל', home: 'בית'
  };

  return (
    <>
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}

      {/* Search Popup */}
      {searchOpen && (
        <>
          <div className="search-overlay" onClick={closeSearch} />
          <div className="search-popup">
            <div className="search-popup-input-wrap">
              <span className="search-popup-icon">🔍</span>
              <input ref={searchInputRef} className="search-popup-input" placeholder="חפש מוצר..."
                value={searchQuery} onChange={handleSearchChange} />
              <button className="search-popup-close" onClick={closeSearch}>✕</button>
            </div>
            {searchQuery && searchResults.length === 0 && (
              <div className="search-no-results">לא נמצאו מוצרים עבור "{searchQuery}"</div>
            )}
            {searchResults.length > 0 && (
              <ul className="search-results-list">
                {searchResults.map(product => (
                  <li key={product.id} className="search-result-item" onClick={() => handleSelectProduct(product)}>
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} className="search-result-img" />
                      : <div className="search-result-no-img">🖼️</div>
                    }
                    <div className="search-result-info">
                      <span className="search-result-name">{product.name}</span>
                      <span className="search-result-cat">{CATEGORY_LABELS[product.category] || product.category}</span>
                    </div>
                    <div className="search-result-right">
                      <span className="search-result-price">₪{product.price}</span>
                      <span className={`search-result-stock ${product.in_stock !== false ? 'in' : 'out'}`}>
                        {product.in_stock !== false ? 'במלאי' : 'אזל'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!searchQuery && <div className="search-hint">התחל להקליד כדי לחפש מוצר...</div>}
          </div>
        </>
      )}

      {/* Side Drawer */}
      <div className={`nav-drawer ${menuOpen ? 'open' : ''}`}>
        <div className="nav-drawer-header">
          <span className="nav-drawer-logo">🔧 טכניק טמבור</span>
          <button className="nav-close-btn" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="nav-drawer-links">
          {navItems.map(item => (
            <button key={item.key} className={`nav-drawer-item ${currentPage === item.key ? 'active' : ''}`} onClick={() => handleNav(item.key)}>
              <span className="nav-item-icon">{item.icon}</span>{item.label}
            </button>
          ))}
          <button className="nav-drawer-item" onClick={() => { onOpenOrderHistory(); setMenuOpen(false); }}>
            <span className="nav-item-icon">📋</span>ההזמנות שלי
          </button>
          <button className="nav-drawer-item" onClick={() => { onOpenWishlist(); setMenuOpen(false); }}>
            <span className="nav-item-icon">❤️</span>רשימת המשאלות שלי
          </button>
        </nav>
      </div>

      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-right">
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
          <button className="navbar-home-btn" onClick={() => handleNav('home')} title="דף הבית">
            🏠
          </button>
        </div>
        <div className="navbar-center">
          <button className="navbar-brand" onClick={() => handleNav('home')}>🔧 <span>טכניק טמבור</span></button>
        </div>
        <div className="navbar-left">
          <button className="navbar-search-btn" onClick={() => setSearchOpen(true)} title="חיפוש">🔍</button>
          <button className="navbar-link" onClick={onOpenOrderHistory} title="ההזמנות שלי">📋 ההזמנות שלי</button>
          <button className="navbar-wishlist-btn" onClick={onOpenWishlist} title="רשימת משאלות">🤍</button>
          <button className={`navbar-link ${currentPage === 'about' ? 'active' : ''}`} onClick={() => handleNav('about')}>אודות</button>
          <button className={`navbar-link ${currentPage === 'contact' ? 'active' : ''}`} onClick={() => handleNav('contact')}>צור קשר</button>
          <button className={`navbar-link ${currentPage === 'returns' ? 'active' : ''}`} onClick={() => handleNav('returns')}>החזרים</button>

          {/* כפתור עגלה — תמיד מוצג */}
          <button className="navbar-cart-btn" onClick={onOpenCart}>
            🛒
            {cartCount > 0 && (
              <span className="navbar-cart-badge">{cartCount}</span>
            )}
          </button>
        </div>
      </header>
    </>
  );
}

export default Navbar;