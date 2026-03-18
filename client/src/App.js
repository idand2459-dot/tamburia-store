import { useState, useEffect } from 'react';
import './App.css';
import Admin from './Admin';
import AdminLogin from './AdminLogin';
import CategoryPage from './CategoryPage';
import Navbar from './Navbar';
import WhatsAppButton from './WhatsAppButton';
import { ProductCardSkeleton, Spinner } from './LoadingStates';
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
    fetch('/api/products').then(r => r.json())
      .then(data => { setProducts(data.filter(p => p.category === selectedCategory.id)); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, [selectedCategory]);

  function addToCart(product) {
    const existing = cart.find(i => i.id === product.id && i.selectedColor === product.selectedColor);
    if (existing) {
      setCart(cart.map(i => i.id === product.id && i.selectedColor === product.selectedColor
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
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity || 1, selectedColor: i.selectedColor || null })),
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
    const filtered = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
  };

  const SORT_OPTIONS = [
    { value: 'default', label: 'ברירת מחדל' },
    { value: 'price-asc', label: 'מחיר ↑' },
    { value: 'price-desc', label: 'מחיר ↓' },
    { value: 'name', label: 'א-ב' },
    { value: 'instock', label: 'במלאי קודם' },
  ];

  const CartModal = () => (
    <>
      <div className="cart-overlay" onClick={closeCart} />
      <div className="cart-modal">
        <div className="cart-modal-header">
          <button className="cart-close-btn" onClick={closeCart}>✕</button>
          <h3>{cartStep === 'cart' ? '🛒 העגלה שלי' : cartStep === 'details' ? '📋 פרטי הזמנה' : '✅ ההזמנה התקבלה!'}</h3>
        </div>
        {cartStep === 'cart' && (
          <>
            {cart.length === 0 ? (
              <div className="cart-empty"><span>🛒</span><p>העגלה ריקה</p></div>
            ) : (
              <>
                <ul className="cart-items-list">
                  {cart.map((item, index) => (
                    <li key={index} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.name}{item.selectedColor ? ` — ${item.selectedColor}` : ''}</span>
                        <span className="cart-item-price">₪{item.price * (item.quantity || 1)}</span>
                      </div>
                      <div className="cart-item-qty">
                        <button onClick={() => updateQuantity(index, -1)}>−</button>
                        <span>{item.quantity || 1}</span>
                        <button onClick={() => updateQuantity(index, 1)}>+</button>
                      </div>
                      <button className="cart-item-remove" onClick={() => removeFromCart(index)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className="delivery-section">
                  <h4>אופן קבלת ההזמנה</h4>
                  <div className="delivery-options">
                    <div className={`delivery-option ${deliveryMethod === 'pickup' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('pickup')}>
                      <div className="delivery-option-top"><span className="delivery-icon">🏪</span><div><strong>איסוף עצמי</strong><span className="delivery-free">חינם</span></div></div>
                      <p className="delivery-desc">בר כוכבא 52, פתח תקווה</p>
                      <p className="delivery-desc">באותו יום בשעות הפעילות</p>
                    </div>
                    <div className={`delivery-option ${deliveryMethod === 'delivery' ? 'selected' : ''}`} onClick={() => setDeliveryMethod('delivery')}>
                      <div className="delivery-option-top"><span className="delivery-icon">🚚</span><div><strong>שליח עד הבית</strong><span className="delivery-price">₪20</span></div></div>
                      <p className="delivery-desc">עד 2 ימי עסקים</p>
                    </div>
                  </div>
                </div>
                <div className="cart-summary">
                  <div className="cart-summary-row"><span>סכום מוצרים</span><span>₪{subtotal}</span></div>
                  {deliveryMethod === 'delivery' && <div className="cart-summary-row"><span>משלוח</span><span>₪20</span></div>}
                  {deliveryMethod === 'pickup' && <div className="cart-summary-row green"><span>משלוח</span><span>חינם</span></div>}
                  <div className="cart-summary-total"><span>סה"כ לתשלום</span><span>₪{total}</span></div>
                </div>
                <div className="cart-actions">
                  <button className={`checkout-btn ${!deliveryMethod ? 'disabled' : ''}`} disabled={!deliveryMethod}
                    onClick={() => deliveryMethod && setCartStep('details')}>
                    {!deliveryMethod ? 'בחר אופן קבלה לפני המשך' : 'המשך למילוי פרטים →'}
                  </button>
                  <button className="clear-btn" onClick={() => { setCart([]); setDeliveryMethod(null); }}>רוקן עגלה</button>
                </div>
              </>
            )}
          </>
        )}
        {cartStep === 'details' && (
          <div className="order-form">
            <button className="order-back-btn" onClick={() => setCartStep('cart')}>← חזור לעגלה</button>
            <div className="order-summary-mini"><span>{cartCount} פריטים</span><span className="order-total-mini">סה"כ: ₪{total}</span></div>
            <div className="order-fields">
              <div className="order-field"><label>שם מלא *</label><input placeholder="ישראל ישראלי" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
              <div className="order-field"><label>טלפון *</label><input placeholder="050-0000000" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
              <div className="order-field"><label>אימייל</label><input placeholder="example@email.com" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
              {deliveryMethod === 'delivery' && <div className="order-field"><label>כתובת למשלוח *</label><input placeholder="רחוב, מספר, עיר" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} /></div>}
              <div className="order-field"><label>הערות להזמנה</label><textarea placeholder="הערות מיוחדות..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} /></div>
            </div>
            <button className={`checkout-btn ${(!customerName || !customerPhone || (deliveryMethod === 'delivery' && !deliveryAddress) || submittingOrder) ? 'disabled' : ''}`}
              disabled={!customerName || !customerPhone || (deliveryMethod === 'delivery' && !deliveryAddress) || submittingOrder}
              onClick={handlePlaceOrder}>
              {submittingOrder ? <span className="checkout-btn-loading"><Spinner size="small" color="white" /> שולח הזמנה...</span> : '✅ שלח הזמנה'}
            </button>
          </div>
        )}
        {cartStep === 'success' && orderSuccess && (
          <div className="order-success">
            <span className="success-icon">🎉</span>
            <h3>ההזמנה התקבלה!</h3>
            <p>מספר הזמנה: <strong>#{orderSuccess.id}</strong></p>
            <p>ניצור איתך קשר בהקדם לאישור.</p>
            <div className="success-details">
              <div><span>שם:</span> {orderSuccess.customer_name}</div>
              <div><span>טלפון:</span> {orderSuccess.customer_phone}</div>
              <div><span>אופן קבלה:</span> {orderSuccess.delivery_method === 'pickup' ? '🏪 איסוף עצמי' : '🚚 משלוח'}</div>
              <div><span>סה"כ:</span> ₪{orderSuccess.total}</div>
            </div>
            <button className="checkout-btn" onClick={closeCart}>סגור</button>
          </div>
        )}
      </div>
    </>
  );

  if (currentPage === 'about') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><About /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal />}<WhatsAppButton /></div>;
  if (currentPage === 'contact') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><Contact /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal />}<WhatsAppButton /></div>;
  if (currentPage === 'returns') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><Returns /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal />}<WhatsAppButton /></div>;
  if (currentPage === '404') return <div className="App"><Navbar {...navbarProps} /><MarqueeBanner /><NotFound onNavigate={handleNavigate} /><Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />{showCart && <CartModal />}<WhatsAppButton /></div>;

  if (!selectedCategory) return (
    <div className="App">
      <Navbar {...navbarProps} />
      <MarqueeBanner />
      <div className="hero"><h2>כל מה שצריך לבית — במקום אחד</h2><p>מוצרי צביעה, אינסטלציה, כלי עבודה ועוד</p></div>
      <CategoryPage onSelectCategory={setSelectedCategory} />
      <WhyUs />
      <FeaturesBanner />
      <ReviewsCarousel />
      <Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />
      {showCart && <CartModal />}
      <WhatsAppButton />
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
      {showCart && <CartModal />}
      <WhatsAppButton />
    </div>
  );

  const sortedProducts = getSortedProducts(products);

  return (
    <div className="App">
      <Navbar {...navbarProps} />
      <MarqueeBanner />
      <div className="products-header">
        <button className="back-btn" onClick={() => setSelectedCategory(null)}>← קטגוריות</button>
      </div>
      <main>
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
                {product.image_url && <img src={product.image_url} alt={product.name} />}
                <h3>{product.name}</h3>
                {product.sku && <p className="product-sku">מק"ט: {product.sku}</p>}
                <p className="price">₪{product.price}</p>
                <p className={`stock ${product.in_stock !== false ? '' : 'out-of-stock-label'}`}>
                  {product.in_stock !== false ? '✓ יש במלאי' : '✗ אזל מהמלאי'}
                </p>
                <button onClick={e => { e.stopPropagation(); if (product.in_stock !== false) addToCart(product); }}
                  disabled={product.in_stock === false} className={product.in_stock === false ? 'btn-disabled' : ''}>
                  {product.in_stock !== false ? 'הוסף לעגלה' : 'אזל מהמלאי'}
                </button>
              </div>
            ))}
        </div>
      </main>
      <Footer onNavigate={handleNavigate} onSelectCategory={setSelectedCategory} />
      {showCart && <CartModal />}
      <WhatsAppButton />
    </div>
  );
}

export default App;