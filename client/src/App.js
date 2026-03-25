import { useState, useEffect } from 'react';
import './App.css';
import Admin from './Admin';
import AdminLogin from './AdminLogin';
import CategoryPage from './CategoryPage';
import Navbar from './Navbar';
import WhatsAppButton from './WhatsAppButton';
import { ProductCardSkeleton } from './LoadingStates';
import NotFound from './NotFound';
import About from './About';
import Contact from './Contact';
import Returns from './Returns';
import ProductPage from './ProductPage';
import MarqueeBanner from './MarqueeBanner';
import Footer from './Footer';
import ReviewsCarousel from './ReviewsCarousel';
import FeaturesBanner from './FeaturesBanner';
import WhyUs from './WhyUs';
import CartModal from './CartModal';
import CategoryBanner from './CategoryBanner';
import categories from './categories';
import ScrollToTop from './ScrollToTop';
import FAQ from './FAQ';
import PaintCalculator from './PaintCalculator';
import ProjectCalculator from './ProjectCalculator';
import PaintCalcBtn from './PaintCalcBtn';
import OrderHistory from './OrderHistory';
import Wishlist from './Wishlist';
import CategoryAmbience from './CategoryAmbience';

function App() {
  const [products, setProducts] = useState([]);

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tamburia-cart')) || []; }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('tamburia-cart', JSON.stringify(cart));
  }, [cart]);

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState('home');
  const [showCart, setShowCart] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartStep, setCartStep] = useState('cart');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const [wishlistIds, setWishlistIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tamburia-wishlist'))?.map(p => p.id) || []; }
    catch { return []; }
  });

  function toggleCardWishlist(product) {
    try {
      const current = JSON.parse(localStorage.getItem('tamburia-wishlist')) || [];
      const exists = current.find(p => p.id === product.id);
      const updated = exists ? current.filter(p => p.id !== product.id) : [...current, { id: product.id, name: product.name, price: product.price, image_url: product.image_url, in_stock: product.in_stock }];
      localStorage.setItem('tamburia-wishlist', JSON.stringify(updated));
      setWishlistIds(updated.map(p => p.id));
    } catch {}
  }

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    if (window.location.pathname === '/admin') setShowAdmin(true);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    setLoadingProducts(true);
    setSortBy('default');
    setSelectedSubcategory(null);
    fetch('/api/products').then(r => r.json())
      .then(data => { setProducts((Array.isArray(data) ? data : []).filter(p => p.category === selectedCategory.id)); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, [selectedCategory]);

  function addToCart(product) {
    const existing = cart.find(i => i.id === product.id && i.selectedColor === product.selectedColor && i.selectedSize === product.selectedSize);
    if (existing) {
      setCart(cart.map(i => i.id === product.id && i.selectedColor === product.selectedColor && i.selectedSize === product.selectedSize
        ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setShowCart(true); setCartStep('cart');
  }

  function removeFromCart(index) { setCart(cart.filter((_, i) => i !== index)); }

  function updateQuantity(index, delta) {
    setCart(cart.map((item, i) => {
      if (i !== index) return item;
      const newQty = (item.quantity || 1) + delta;
      return newQty <= 0 ? null : { ...item, quantity: newQty };
    }).filter(Boolean));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const deliveryFee = deliveryMethod === 'delivery' ? 20 : 0;
  const total = subtotal + deliveryFee;
  const cartCount = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);

  function handleNavigate(page) {
    const validPages = ['home', 'about', 'contact', 'returns'];
    setCurrentPage(validPages.includes(page) ? page : '404');
    setSelectedCategory(null);
    setSelectedProduct(null);
  }

  function handleSelectProductFromSearch(product) {
    setSelectedProduct(product); setCurrentPage('home');
  }

  function openCart() { setShowCart(true); setCartStep('cart'); }
  function closeCart() { setShowCart(false); setCartStep('cart'); }

  async function handlePlaceOrder() {
    if (!customerName || !customerPhone) return;
    if (deliveryMethod === 'delivery' && !deliveryAddress) return;
    setSubmittingOrder(true);
    const order = {
      customer_name: customerName, customer_phone: customerPhone,
      customer_email: customerEmail, delivery_method: deliveryMethod,
      delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : null,
      notes: orderNotes,
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1, selectedColor: i.selectedColor || null, selectedSize: i.selectedSize || null })),
      subtotal, delivery_fee: deliveryFee, total
    };
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    const saved = await res.json();
    setSubmittingOrder(false);
    setOrderSuccess(saved); setCartStep('success');
    setCart([]); setDeliveryMethod(null);
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setDeliveryAddress(''); setOrderNotes('');
  }

  function getSortedProducts(list) {
    const filtered = list
      .filter(p => !selectedSubcategory || p.subcategory === selectedSubcategory)
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    switch (sortBy) {
      case 'price-asc':  return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-desc': return [...filtered].sort((a, b) => b.price - a.price);
      case 'name':       return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'he'));
      case 'instock':    return [...filtered].sort((a, b) => (b.in_stock !== false ? 1 : 0) - (a.in_stock !== false ? 1 : 0));
      default:           return filtered;
    }
  }

  if (showAdmin) {
    if (!adminLoggedIn) return <AdminLogin onLogin={() => setAdminLoggedIn(true)} />;
    return <Admin onBack={() => { setShowAdmin(false); setAdminLoggedIn(false); window.history.pushState({}, '', '/'); }} />;
  }

  const navbarProps = {
    currentPage, onNavigate: handleNavigate,
    onSelectProduct: handleSelectProductFromSearch,
    cartCount, total, onOpenCart: openCart,
    menuOpen, setMenuOpen,
    onOpenOrderHistory: () => setShowOrderHistory(true),
    onOpenWishlist: () => setShowWishlist(true),
  };

  const cartModalProps = {
    cart, setCart, cartStep, setCartStep, closeCart,
    deliveryMethod, setDeliveryMethod,
    subtotal, deliveryFee, total, cartCount,
    updateQuantity, removeFromCart,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    deliveryAddress, setDeliveryAddress,
    orderNotes, setOrderNotes,
    submittingOrder, handlePlaceOrder,
    orderSuccess
  };

  const SORT_OPTIONS = [
    { value: 'default', label: 'ברירת מחדל' },
    { value: 'price-asc', label: 'מחיר ↑' },
    { value: 'price-desc', label: 'מחיר ↓' },
    { value: 'name', label: 'א-ב' },
    { value: 'instock', label: 'במלאי קודם' },
  ];

  if (currentPage === 'about') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><About /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal {...cartModalProps} />}<WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}</div>;
  if (currentPage === 'contact') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><Contact /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal {...cartModalProps} />}<WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}</div>;
  if (currentPage === 'returns') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><Returns /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal {...cartModalProps} />}<WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}</div>;
  if (currentPage === '404') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><NotFound onNavigate={handleNavigate} /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal {...cartModalProps} />}<WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}</div>;

  if (!selectedCategory) return (
    <div className="App">
      <Navbar {...navbarProps} />
      <MarqueeBanner />
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-badge">✦ מאז 1991 · פתח תקווה</div>
          <h1 className="hero-title">כל מה שצריך לבית<br/><span className="hero-accent">במקום אחד</span></h1>
          <p className="hero-sub">מוצרי צביעה · אינסטלציה · כלי עבודה · ממנעולים ועד גינה</p>
          <div className="hero-stats">
            <div className="hero-stat"><b>400+</b><span>מוצרים</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>12</b><span>קטגוריות</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>30+</b><span>שנות ניסיון</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><b>★ 4.9</b><span>לקוחות מרוצים</span></div>
          </div>
        </div>
      </div>
      <CategoryPage onSelectCategory={setSelectedCategory} />
      <WhyUs />
      <PaintCalculator addBundleToCart={items => {
        setCart(prev => {
          let updated = [...prev];
          for (const item of items) {
            const exists = updated.find(i => i.id === item.id);
            if (exists) {
              updated = updated.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + item.quantity } : i);
            } else {
              updated = [...updated, { ...item, selectedColor: null }];
            }
          }
          return updated;
        });
        setShowCart(true);
        setCartStep('cart');
      }} />
      <ProjectCalculator addBundleToCart={items => {
        setCart(prev => {
          let updated = [...prev];
          for (const item of items) {
            const exists = updated.find(i => i.id === item.id);
            if (exists) {
              updated = updated.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + item.quantity } : i);
            } else {
              updated = [...updated, { ...item, selectedColor: null }];
            }
          }
          return updated;
        });
        setShowCart(true);
        setCartStep('cart');
      }} />
      <FeaturesBanner />
      <ReviewsCarousel />
      <FAQ />
      <Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />
      {showCart && <CartModal {...cartModalProps} />}
      <WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}<PaintCalcBtn menuOpen={menuOpen} />
    </div>
  );

  if (selectedProduct) return (
    <div className="App">
      <Navbar {...navbarProps} />
      <MarqueeBanner />
      <ProductPage
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        onAddToCart={(p) => { addToCart(p); }}
        onSelectProduct={setSelectedProduct}
      />
      <Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />
      {showCart && <CartModal {...cartModalProps} />}
      <WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}
    </div>
  );

  const sortedProducts = getSortedProducts(products);

  return (
    <div className={`App cat-bg cat-bg-${selectedCategory?.id}`}>
      <Navbar {...navbarProps} />
      <MarqueeBanner />
      <CategoryAmbience categoryId={selectedCategory?.id} />
      <CategoryBanner category={selectedCategory} onBack={() => setSelectedCategory(null)} />
      {(() => {
        const catDef = categories.find(c => c.id === selectedCategory?.id);
        if (!catDef?.subcategories?.length) return null;
        return (
          <div className="subcategory-chips">
            <button
              className={`subcategory-chip ${!selectedSubcategory ? 'active' : ''}`}
              onClick={() => setSelectedSubcategory(null)}>
              הכל
            </button>
            {catDef.subcategories.map(sub => (
              <button
                key={sub.id}
                className={`subcategory-chip ${selectedSubcategory === sub.id ? 'active' : ''}`}
                onClick={() => setSelectedSubcategory(selectedSubcategory === sub.id ? null : sub.id)}>
                {sub.name}
              </button>
            ))}
          </div>
        );
      })()}
      <main style={{ '--cat-color': selectedCategory?.color }}>
        <div className="products-toolbar">
          <div className="search-bar">
            <input placeholder="🔍 חפש מוצר..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sort-bar">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.value} className={`sort-btn ${sortBy === opt.value ? 'active' : ''}`} onClick={() => setSortBy(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="products-count">{!loadingProducts && `${sortedProducts.length} מוצרים`}</div>
        <div className="products-grid">
          {loadingProducts
            ? Array(6).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)
            : sortedProducts.map(product => (
              <div key={product.id} className="product-card" onClick={() => setSelectedProduct(product)} style={{ cursor: 'pointer' }}>
                <div className="product-img-wrap">
                  <div className="product-img-placeholder" data-icon={selectedCategory?.icon}>
                    <span className="product-img-initial">{product.name.charAt(0)}</span>
                  </div>
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} onError={e => { e.currentTarget.style.display = 'none'; }} />
                  )}
                </div>
                <h3>{product.name}</h3>
                {product.sku && <p className="product-sku">מק"ט: {product.sku}</p>}
                <p className="price">
                  {Array.isArray(product.variants) && product.variants.length > 0
                    ? <>מ-₪{Math.min(...product.variants.map(v => v.price))} <span className="price-variants-hint">· {product.variants.length} גרסאות</span></>
                    : <>₪{product.price}</>
                  }
                </p>
                <p className={`stock ${product.in_stock !== false ? '' : 'out-of-stock-label'}`}>
                  {product.in_stock !== false ? '✓ יש במלאי' : '✗ אזל מהמלאי'}
                </p>
                <div className="card-bottom-actions">
                  <button
                    className={`card-add-btn ${product.in_stock === false ? 'btn-disabled' : ''}`}
                    onClick={e => { e.stopPropagation(); if (product.in_stock !== false) addToCart(product); }}
                    disabled={product.in_stock === false}>
                    {product.in_stock !== false ? 'הוסף לעגלה' : 'אזל מהמלאי'}
                  </button>
                  <button
                    className={`card-wishlist-btn ${wishlistIds.includes(product.id) ? 'active' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleCardWishlist(product); }}
                    title={wishlistIds.includes(product.id) ? 'הסר' : 'הוסף למשאלות'}>
                    {wishlistIds.includes(product.id) ? '❤️' : '🤍'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </main>
      <Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />
      {showCart && <CartModal {...cartModalProps} />}
      <WhatsAppButton /><ScrollToTop />{showOrderHistory && <OrderHistory onClose={() => setShowOrderHistory(false)} />}{showWishlist && <Wishlist onClose={() => setShowWishlist(false)} onSelectProduct={handleSelectProductFromSearch} />}
    </div>
  );
}

export default App;