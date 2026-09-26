/**
 * סרגל הניווט העליון, כולל חיפוש מוצרים.
 *
 * מושך את מצב העגלה והתפריט מ-StoreContext ואת הניווט מהראוטר, ולא
 * מקבל אותם בפרופס: הערכים האלה זמינים בכל מקום ממילא, והעברתם דרך
 * StoreLayout רק החזירה את אותו prop-drilling שההקשר בא לבטל.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Store, Phone, Undo2, ClipboardList, Heart,
  Search, X, ImageOff, Wrench, ShoppingCart,
} from 'lucide-react';
import { useStore } from '../context/storeContext';
import { useScrolled } from '../hooks/useScrolled';

const NAV_ITEMS = [
  { key: 'home', path: '/', label: 'ראשי', Icon: Home },
  { key: 'about', path: '/about', label: 'אודות', Icon: Store },
  { key: 'contact', path: '/contact', label: 'צור קשר', Icon: Phone },
  { key: 'returns', path: '/returns', label: 'מדיניות החזרים', Icon: Undo2 },
];

/** מחזיר את המפתח שיש לסמן כפעיל, לפי הכתובת הנוכחית. */
function currentPageOf(pathname) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/about')) return 'about';
  if (pathname.startsWith('/contact')) return 'contact';
  if (pathname.startsWith('/returns')) return 'returns';
  return '';
}

/** מציג את סרגל הניווט והחיפוש. */
function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, wishlistIds, menuOpen, setMenuOpen } = useStore();
  const scrolled = useScrolled(8);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const cancelSearchRef = useRef(null);

  const currentPage = currentPageOf(location.pathname);
  const wishlistCount = wishlistIds?.length || 0;

  // מבטל חיפוש שממתין או שכבר יצא לדרך כשהתיבה נסגרת או שהרכיב יורד,
  // כדי שתשובה מאוחרת לא תמלא תוצאות לתיבה שכבר אינה פתוחה.
  useEffect(() => () => {
    clearTimeout(searchTimerRef.current);
    cancelSearchRef.current?.();
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    /** סוגר את החיפוש בלחיצה על Escape. */
    function handleKey(e) { if (e.key === 'Escape') closeSearch(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /**
   * מריץ חיפוש בשרת ומעדכן את התוצאות.
   *
   * דגל cancelled לכל בקשה, באותו דפוס של ה-useEffect-ים בפרויקט:
   * הקלדה מהירה מייצרת כמה בקשות, והן לא בהכרח חוזרות לפי הסדר.
   * בלי הדגל תשובה איטית של מילה קודמת הייתה דורסת תוצאה עדכנית
   * שכבר הוצגה.
   *
   * עם limit התשובה היא { products, pagination } ולא מערך שטוח.
   */
  function runSearch(q) {
    cancelSearchRef.current?.();

    let cancelled = false;
    cancelSearchRef.current = () => { cancelled = true; };

    fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSearchResults(Array.isArray(data) ? data : (data.products || []));
      })
      .catch(() => {});
  }

  /** מעדכן את מונח החיפוש ומתזמן חיפוש בשרת. */
  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);

    clearTimeout(searchTimerRef.current);
    if (!q.trim()) {
      cancelSearchRef.current?.();
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => runSearch(q), 300);
  }

  /** סוגר את תיבת החיפוש ומנקה אותה. */
  function closeSearch() { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }
  /** פותח את המוצר שנבחר מתוצאות החיפוש. */
  function handleSelectProduct(product) { closeSearch(); navigate(`/product/${product.id}`); }
  /** עובר לעמוד המבוקש וסוגר את התפריט. */
  function handleNav(path) { navigate(path); setMenuOpen(false); }
  /** פותח את איתור ההזמנות וסוגר את התפריט. */
  function openOrderHistory() { navigate('/orders/lookup'); setMenuOpen(false); }
  /** פותח את רשימת המשאלות וסוגר את התפריט. */
  function openWishlist() { navigate('/wishlist'); setMenuOpen(false); }

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
              <span className="search-popup-icon"><Search size={18} aria-hidden="true" /></span>
              <input ref={searchInputRef} className="search-popup-input" placeholder="חפש מוצר..."
                value={searchQuery} onChange={handleSearchChange} />
              <button className="search-popup-close" onClick={closeSearch} aria-label="סגור חיפוש"><X size={18} aria-hidden="true" /></button>
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
                      : <div className="search-result-no-img"><ImageOff size={24} aria-hidden="true" /></div>
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
          <span className="nav-drawer-logo"><Wrench size={20} aria-hidden="true" /> טכניק טמבור</span>
          <button className="nav-close-btn" onClick={() => setMenuOpen(false)} aria-label="סגור תפריט"><X size={20} aria-hidden="true" /></button>
        </div>
        <nav className="nav-drawer-links">
          {NAV_ITEMS.map(({ key, path, label, Icon }) => (
            <button key={key} className={`nav-drawer-item ${currentPage === key ? 'active' : ''}`} onClick={() => handleNav(path)}>
              <span className="nav-item-icon"><Icon size={18} aria-hidden="true" /></span>{label}
            </button>
          ))}
          <button className="nav-drawer-item" onClick={openOrderHistory}>
            <span className="nav-item-icon"><ClipboardList size={18} aria-hidden="true" /></span>ההזמנות שלי
          </button>
          <button className="nav-drawer-item" onClick={openWishlist}>
            <span className="nav-item-icon"><Heart size={18} fill="currentColor" aria-hidden="true" /></span>רשימת המשאלות שלי
          </button>
        </nav>
      </div>

      {/* Top Navbar */}
      <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-right">
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="פתח תפריט">
            <span /><span /><span />
          </button>
          {/* navbar-home-btn הוא רק מודיפייר: הוא מסתיר את הכפתור מתחת
              ל-480px, כי המיתוג עצמו כבר מוביל לדף הבית. */}
          <button className="navbar-icon-btn navbar-home-btn" onClick={() => handleNav('/')} title="דף הבית" aria-label="דף הבית">
            <Home size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="navbar-center">
          <button className="navbar-brand" onClick={() => handleNav('/')} aria-label="טכניק טמבור — לדף הבית"><Wrench size={20} aria-hidden="true" /> <span>טכניק טמבור</span></button>
        </div>
        <div className="navbar-left">
          <button className="navbar-icon-btn" onClick={() => setSearchOpen(true)} title="חיפוש" aria-label="חיפוש"><Search size={20} aria-hidden="true" /></button>
          <button className="navbar-link" onClick={openOrderHistory} title="ההזמנות שלי"><ClipboardList size={18} aria-hidden="true" /> ההזמנות שלי</button>
          <button className="navbar-icon-btn" onClick={openWishlist} title="רשימת משאלות" aria-label={`רשימת משאלות${wishlistCount > 0 ? ` — ${wishlistCount} מוצרים` : ''}`}>
            <Heart size={20} aria-hidden="true" />
            {wishlistCount > 0 && (
              <span className="navbar-wishlist-count">{wishlistCount}</span>
            )}
          </button>
          <button className={`navbar-link ${currentPage === 'about' ? 'active' : ''}`} onClick={() => handleNav('/about')}>אודות</button>
          <button className={`navbar-link ${currentPage === 'contact' ? 'active' : ''}`} onClick={() => handleNav('/contact')}>צור קשר</button>
          <button className={`navbar-link ${currentPage === 'returns' ? 'active' : ''}`} onClick={() => handleNav('/returns')}>החזרים</button>

          {/* כפתור עגלה — תמיד מוצג */}
          <button className="navbar-cart-btn" onClick={() => navigate('/cart')} aria-label="עגלת קניות">
            <ShoppingCart size={20} aria-hidden="true" />
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