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
import { useModalFocus } from '../hooks/useModalFocus';
import { priceLabel } from '../utils/pricing';
import { getProducts, isAbortError } from '../services/productService';

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
  const searchPopupRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);
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

  // התפריט וחלון החיפוש הם חלונות מודאליים כמו המגירות: המיקוד נכנס
  // אליהם וחוזר לכפתור שפתח, Escape סוגר ו-Tab לא יוצא מהם. התפריט
  // נשאר ב-DOM גם סגור (בשביל אנימציית הכניסה), ולכן active.
  useModalFocus(drawerRef, {
    active: menuOpen, onClose: () => setMenuOpen(false), initialFocus: drawerCloseRef,
  });
  useModalFocus(searchPopupRef, {
    active: searchOpen, onClose: closeSearch, initialFocus: searchInputRef,
  });

  /**
   * מריץ חיפוש בשרת ומעדכן את התוצאות.
   *
   * AbortController לכל בקשה: הקלדה מהירה מייצרת כמה בקשות, והן לא
   * בהכרח חוזרות לפי הסדר. בלי הביטול תשובה איטית של מילה קודמת
   * הייתה דורסת תוצאה עדכנית שכבר הוצגה. הביטול גם עוצר את הבקשה
   * עצמה, וזה מה שהדגל שהיה כאן קודם לא יכול היה לעשות.
   *
   * צורת התשובה כבר אינה עניינו של הסרגל — השירות מנרמל אותה.
   */
  function runSearch(q) {
    cancelSearchRef.current?.();

    const controller = new AbortController();
    cancelSearchRef.current = () => controller.abort();

    getProducts({ search: q, limit: 8, signal: controller.signal })
      .then(({ products }) => setSearchResults(products))
      // חיפוש שנכשל מרוקן את התוצאות, כמו קודם. ביטול לא: שם כבר
      // יצאה בקשה חדשה, וריקון היה מהבהב עד שהיא תחזור.
      .catch((err) => { if (!isAbortError(err)) setSearchResults([]); });
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
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {/* Search Popup */}
      {searchOpen && (
        <>
          <div className="search-overlay" onClick={closeSearch} aria-hidden="true" />
          <div className="search-popup" ref={searchPopupRef} role="dialog" aria-modal="true" aria-label="חיפוש מוצרים">
            <div className="search-popup-input-wrap">
              <span className="search-popup-icon"><Search size={18} aria-hidden="true" /></span>
              <input ref={searchInputRef} className="search-popup-input" placeholder="חפש מוצר..."
                type="search" aria-label="חיפוש מוצר"
                value={searchQuery} onChange={handleSearchChange} />
              <button className="search-popup-close" onClick={closeSearch} aria-label="סגור חיפוש"><X size={18} aria-hidden="true" /></button>
            </div>
            {/* מה שקורא המסך שומע כשהתוצאות מתחלפות — הרשימה עצמה
                מתעדכנת בשקט, וכך לא מוקראת מחדש בכל הקשה */}
            <p className="visually-hidden" role="status">
              {searchQuery && (searchResults.length === 0
                ? 'לא נמצאו מוצרים'
                : `נמצאו ${searchResults.length} מוצרים`)}
            </p>
            {searchQuery && searchResults.length === 0 && (
              <div className="search-no-results">לא נמצאו מוצרים עבור "{searchQuery}"</div>
            )}
            {searchResults.length > 0 && (
              <ul className="search-results-list">
                {searchResults.map(product => (
                  <li key={product.id}>
                    {/* כפתור ולא li עם onClick: li לא מקבל מיקוד, ולכן
                        התוצאות היו בלתי נגישות ממקלדת. alt ריק כי השם
                        כתוב ממש לידה, והקורא היה אומר אותו פעמיים. */}
                    <button type="button" className="search-result-item" onClick={() => handleSelectProduct(product)}>
                    {product.image_url
                      ? <img src={product.image_url} alt="" className="search-result-img" />
                      : <div className="search-result-no-img"><ImageOff size={24} aria-hidden="true" /></div>
                    }
                    <div className="search-result-info">
                      <span className="search-result-name">{product.name}</span>
                      <span className="search-result-cat">{CATEGORY_LABELS[product.category] || product.category}</span>
                    </div>
                    <div className="search-result-right">
                      {/* אותו כלל שבכרטיס ובמועדפים: מוצר בלי מחיר אינו
                          מוצג "₪0" גם כאן */}
                      <span className="search-result-price">{priceLabel(product)}</span>
                      <span className={`search-result-stock ${product.in_stock !== false ? 'in' : 'out'}`}>
                        {product.in_stock !== false ? 'במלאי' : 'אזל'}
                      </span>
                    </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searchQuery && <div className="search-hint">התחל להקליד כדי לחפש מוצר...</div>}
          </div>
        </>
      )}

      {/* Side Drawer */}
      {/* inert כשסגור: התפריט ממתין מחוץ למסך, ובלי זה כפתור הסגירה
          שלו היה תחנת ה-Tab הראשונה בכל עמוד — בלתי נראית. */}
      <div
        id="nav-drawer"
        ref={drawerRef}
        className={`nav-drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט"
        tabIndex={-1}
        inert={!menuOpen || undefined}
      >
        <div className="nav-drawer-header">
          <span className="nav-drawer-logo"><Wrench size={20} aria-hidden="true" /> טכניק טמבור</span>
          <button ref={drawerCloseRef} className="nav-close-btn" onClick={() => setMenuOpen(false)} aria-label="סגור תפריט"><X size={20} aria-hidden="true" /></button>
        </div>
        <nav className="nav-drawer-links" aria-label="ניווט ראשי">
          {NAV_ITEMS.map(({ key, path, label, Icon }) => (
            <button key={key} className={`nav-drawer-item ${currentPage === key ? 'active' : ''}`} onClick={() => handleNav(path)}
              aria-current={currentPage === key ? 'page' : undefined}>
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
      {/* inert מאחורי התפריט ומאחורי חלון החיפוש, כמו שאר העמוד */}
      <header className={`navbar ${scrolled ? 'scrolled' : ''}`} inert={menuOpen || searchOpen || undefined}>
        <div className="navbar-right">
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="פתח תפריט"
            aria-expanded={menuOpen} aria-controls="nav-drawer">
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
          {/* --orders ו---page נבדלים במחלקה כי הם נעלמים ברוחב אחר:
              שלושת קישורי העמודים יורדים מתחת ל-1200px, וההזמנות שלי
              מחזיק עד 768px. שניהם נמצאים גם במגירה. */}
          <button className="navbar-link navbar-link--orders" onClick={openOrderHistory} title="ההזמנות שלי"><ClipboardList size={18} aria-hidden="true" /> ההזמנות שלי</button>
          <button className="navbar-icon-btn" onClick={openWishlist} title="רשימת משאלות" aria-label={`רשימת משאלות${wishlistCount > 0 ? ` — ${wishlistCount} מוצרים` : ''}`}>
            <Heart size={20} aria-hidden="true" />
            {wishlistCount > 0 && (
              <span className="navbar-wishlist-count" aria-hidden="true">{wishlistCount}</span>
            )}
          </button>
          <button className={`navbar-link navbar-link--page ${currentPage === 'about' ? 'active' : ''}`} onClick={() => handleNav('/about')} aria-current={currentPage === 'about' ? 'page' : undefined}>אודות</button>
          <button className={`navbar-link navbar-link--page ${currentPage === 'contact' ? 'active' : ''}`} onClick={() => handleNav('/contact')} aria-current={currentPage === 'contact' ? 'page' : undefined}>צור קשר</button>
          <button className={`navbar-link navbar-link--page ${currentPage === 'returns' ? 'active' : ''}`} onClick={() => handleNav('/returns')} aria-current={currentPage === 'returns' ? 'page' : undefined}>החזרים</button>

          {/* כפתור עגלה — תמיד מוצג */}
          <button className="navbar-cart-btn" onClick={() => navigate('/cart')}
            aria-label={`עגלת קניות${cartCount > 0 ? ` — ${cartCount} פריטים` : ''}`}>
            <ShoppingCart size={20} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="navbar-cart-badge" aria-hidden="true">{cartCount}</span>
            )}
          </button>
        </div>
      </header>
    </>
  );
}

export default Navbar;