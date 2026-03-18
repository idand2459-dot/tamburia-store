import { useState, useEffect } from 'react';

const CATEGORIES = [
  { id: 'painting', label: 'מוצרי צביעה', icon: '🎨' },
  { id: 'kitchen', label: 'מוצרי מטבח', icon: '🍳' },
  { id: 'bathroom', label: 'מוצרי אמבטיה', icon: '🚿' },
  { id: 'tools', label: 'כלי עבודה', icon: '🔧' },
  { id: 'cleaning', label: 'ניקיון', icon: '🧹' },
  { id: 'garden', label: 'גינה', icon: '🌿' },
  { id: 'plumbing', label: 'אינסטלציה', icon: '🔩' },
  { id: 'adhesives', label: 'דבקים', icon: '🗜️' },
  { id: 'locks', label: 'צילינדרים ומנעולים', icon: '🔐' },
  { id: 'faucets', label: 'ברזים', icon: '🚰' },
];

const STATUS_CONFIG = {
  new:        { label: 'חדשה',   color: '#2563eb', bg: '#eff6ff' },
  processing: { label: 'בטיפול', color: '#d97706', bg: '#fffbeb' },
  shipped:    { label: 'נשלחה',  color: '#7c3aed', bg: '#f5f3ff' },
  completed:  { label: 'הושלמה', color: '#16a34a', bg: '#f0fdf4' },
};

function Admin({ onBack }) {
  const [activeTab, setActiveTab] = useState('stats');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('all');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [inStock, setInStock] = useState(true);
  const [colors, setColors] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [csvPreview, setCsvPreview] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => { fetchProducts(); fetchOrders(); }, []);

  function fetchProducts() { fetch('/api/products').then(r => r.json()).then(setProducts); }
  function fetchOrders() { fetch('/api/orders').then(r => r.json()).then(setOrders); }

  function resetForm() {
    setName(''); setPrice(''); setInStock(true); setColors('');
    setCategory(''); setSku(''); setDescription('');
    setImages([]); setExistingImages([]);
    setEditingProduct(null);
  }

  async function uploadImages(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    const res = await fetch('/api/upload-multiple', { method: 'POST', body: formData });
    return (await res.json()).imageUrls || [];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setUploadingImages(true);
    let allImageUrls = images.length > 0 ? await uploadImages(images) : [];
    await fetch('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price: parseInt(price), in_stock: inStock, image_url: allImageUrls[0] || '', images: allImageUrls.slice(1), colors: colors.split(',').map(c => c.trim()).filter(Boolean), category, sku, description })
    });
    setUploadingImages(false); resetForm(); fetchProducts(); setActiveTab('products');
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setUploadingImages(true);
    let newUrls = images.length > 0 ? await uploadImages(images) : [];
    const allUrls = [...existingImages, ...newUrls];
    await fetch('/api/products/' + editingProduct.id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price: parseInt(price), in_stock: inStock, image_url: allUrls[0] || '', images: allUrls.slice(1), colors: colors.split(',').map(c => c.trim()).filter(Boolean), category, sku, description })
    });
    setUploadingImages(false); resetForm(); fetchProducts(); setActiveTab('products');
  }

  function handleEdit(product) {
    setEditingProduct(product); setName(product.name); setPrice(product.price);
    setInStock(product.in_stock !== false);
    setColors(product.colors ? product.colors.join(', ') : '');
    setCategory(product.category || ''); setSku(product.sku || ''); setDescription(product.description || '');
    const existing = [];
    if (product.image_url) existing.push(product.image_url);
    if (product.images && Array.isArray(product.images)) existing.push(...product.images);
    setExistingImages(existing); setImages([]);
    setActiveTab('add');
  }

  function removeExistingImage(index) { setExistingImages(existingImages.filter((_, i) => i !== index)); }

  async function handleDelete(id) {
    if (!window.confirm('למחוק את המוצר?')) return;
    await fetch('/api/products/' + id, { method: 'DELETE' });
    fetchProducts();
  }

  async function toggleStock(product) {
    await fetch('/api/products/' + product.id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: product.name, price: product.price, in_stock: !product.in_stock, image_url: product.image_url || '', images: product.images || [], colors: product.colors || [], category: product.category, sku: product.sku || '', description: product.description || '' })
    });
    fetchProducts();
  }

  async function handleStatusChange(orderId, status) {
    await fetch(`/api/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchOrders();
  }

  async function handleDeleteOrder(id) {
    if (!window.confirm('למחוק את ההזמנה?')) return;
    await fetch('/api/orders/' + id, { method: 'DELETE' });
    fetchOrders();
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ===== סטטיסטיקות =====
  function getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart);
    const weekOrders = orders.filter(o => new Date(o.created_at) >= weekStart);
    const monthOrders = orders.filter(o => new Date(o.created_at) >= monthStart);

    const revenueToday = todayOrders.reduce((s, o) => s + o.total, 0);
    const revenueWeek = weekOrders.reduce((s, o) => s + o.total, 0);
    const revenueMonth = monthOrders.reduce((s, o) => s + o.total, 0);
    const revenueTotal = orders.reduce((s, o) => s + o.total, 0);

    // הזמנות לפי יום — 7 ימים אחרונים
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const dailyOrders = last7Days.map(day => {
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
      const count = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= day && d < nextDay;
      }).length;
      return { day: day.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' }), count };
    });

    // קטגוריות פופולריות
    const catCount = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const p = products.find(p => p.id === item.id);
        if (p?.category) catCount[p.category] = (catCount[p.category] || 0) + item.quantity;
      });
    });
    const topCategories = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ ...CATEGORIES.find(c => c.id === id), count }));

    // מוצרים אזל
    const outOfStock = products.filter(p => p.in_stock === false);

    return { todayOrders, weekOrders, monthOrders, revenueToday, revenueWeek, revenueMonth, revenueTotal, dailyOrders, topCategories, outOfStock };
  }

  const CSV_IDS = CATEGORIES.map(c => c.id);

  function downloadTemplate() {
    const csv = ['name,price,in_stock,sku,category,colors,description', 'מברשת צבע 3 אינץ\',25,true,TT-001,painting,"לבן,שחור",מברשת איכותית'].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tamburia-template.csv'; a.click();
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n'); if (lines.length < 2) return { rows: [], errors: ['קובץ ריק'] };
    const errors = [], rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      const cols = []; let cur = '', inQ = false;
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '"') inQ = !inQ;
        else if (line[c] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += line[c];
      }
      cols.push(cur.trim());
      const [n, p, is, sk, cat, col, desc] = cols;
      if (!n) { errors.push(`שורה ${i+1}: חסר שם`); continue; }
      if (!p || isNaN(parseInt(p))) { errors.push(`שורה ${i+1}: מחיר לא תקין`); continue; }
      if (!cat || !CSV_IDS.includes(cat)) { errors.push(`שורה ${i+1}: קטגוריה לא תקינה "${cat}"`); continue; }
      rows.push({ name: n, price: parseInt(p), in_stock: is !== 'false', sku: sk||'', category: cat, colors: col ? col.split(',').map(c=>c.trim()).filter(Boolean) : [], description: desc||'' });
    }
    return { rows, errors };
  }

  function handleCsvFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setCsvPreview(null); setCsvErrors([]); setImportResult(null);
    const reader = new FileReader();
    reader.onload = evt => { const { rows, errors } = parseCSV(evt.target.result); setCsvPreview(rows); setCsvErrors(errors); };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  }

  async function handleImport() {
    if (!csvPreview?.length) return;
    setImporting(true); let success = 0, failed = 0;
    for (const row of csvPreview) {
      try {
        const r = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...row, image_url: '', images: [] }) });
        if (r.ok) success++; else failed++;
      } catch { failed++; }
    }
    setImporting(false); setImportResult({ success, failed }); setCsvPreview(null); fetchProducts();
  }

  const filteredProducts = products.filter(p => {
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });
  const filteredOrders = orders.filter(o => orderFilter === 'all' || o.status === orderFilter);
  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  const totalImagesSelected = existingImages.length + images.length;

  const stats = getStats();
  const maxDailyCount = Math.max(...stats.dailyOrders.map(d => d.count), 1);

  return (
    <div className="admin">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>← חזור לחנות</button>
        <h1>ניהול טכניק טמבור</h1>
        <span className="admin-count">{products.length} מוצרים</span>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 סטטיסטיקות</button>
        <button className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          📋 הזמנות {newOrdersCount > 0 && <span className="orders-new-badge">{newOrdersCount}</span>}
        </button>
        <button className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => { setActiveTab('products'); resetForm(); }}>📦 מוצרים</button>
        <button className={`admin-tab ${activeTab === 'add' ? 'active' : ''}`} onClick={() => { setActiveTab('add'); if (!editingProduct) resetForm(); }}>
          {editingProduct ? '✏️ עריכה' : '➕ הוסף מוצר'}
        </button>
        <button className={`admin-tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => { setActiveTab('import'); setCsvPreview(null); setCsvErrors([]); setImportResult(null); }}>📥 ייבוא CSV</button>
      </div>

      {/* ===== STATS TAB ===== */}
      {activeTab === 'stats' && (
        <div className="stats-page">
          {/* כרטיסי מכירות */}
          <div className="stats-grid">
            <div className="stats-card">
              <div className="stats-card-icon">📅</div>
              <div className="stats-card-value">₪{stats.revenueToday}</div>
              <div className="stats-card-label">הכנסות היום</div>
              <div className="stats-card-sub">{stats.todayOrders.length} הזמנות</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-icon">📆</div>
              <div className="stats-card-value">₪{stats.revenueWeek}</div>
              <div className="stats-card-label">הכנסות השבוע</div>
              <div className="stats-card-sub">{stats.weekOrders.length} הזמנות</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-icon">🗓️</div>
              <div className="stats-card-value">₪{stats.revenueMonth}</div>
              <div className="stats-card-label">הכנסות החודש</div>
              <div className="stats-card-sub">{stats.monthOrders.length} הזמנות</div>
            </div>
            <div className="stats-card accent">
              <div className="stats-card-icon">💰</div>
              <div className="stats-card-value">₪{stats.revenueTotal}</div>
              <div className="stats-card-label">סה"כ הכנסות</div>
              <div className="stats-card-sub">{orders.length} הזמנות סה"כ</div>
            </div>
          </div>

          <div className="stats-bottom">
            {/* גרף הזמנות 7 ימים */}
            <div className="stats-section">
              <h3>הזמנות — 7 ימים אחרונים</h3>
              <div className="bar-chart">
                {stats.dailyOrders.map((d, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-count">{d.count > 0 ? d.count : ''}</div>
                    <div className="bar-wrap">
                      <div
                        className="bar-fill"
                        style={{ height: `${(d.count / maxDailyCount) * 100}%` }}
                      />
                    </div>
                    <div className="bar-label">{d.day}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="stats-side">
              {/* קטגוריות פופולריות */}
              {stats.topCategories.length > 0 && (
                <div className="stats-section">
                  <h3>קטגוריות נמכרות</h3>
                  <div className="top-categories">
                    {stats.topCategories.map((cat, i) => (
                      <div key={i} className="top-cat-row">
                        <span className="top-cat-rank">#{i + 1}</span>
                        <span className="top-cat-icon">{cat?.icon}</span>
                        <span className="top-cat-name">{cat?.label}</span>
                        <span className="top-cat-count">{cat.count} יח'</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* מוצרים שאזלו */}
              <div className="stats-section">
                <h3>
                  מוצרים שאזלו
                  {stats.outOfStock.length > 0 && (
                    <span className="out-of-stock-count">{stats.outOfStock.length}</span>
                  )}
                </h3>
                {stats.outOfStock.length === 0 ? (
                  <p className="stats-empty">✅ כל המוצרים במלאי</p>
                ) : (
                  <div className="out-of-stock-list">
                    {stats.outOfStock.slice(0, 8).map(p => (
                      <div key={p.id} className="out-of-stock-item">
                        <span>{p.name}</span>
                        <button className="restock-btn" onClick={() => toggleStock(p)}>החזר למלאי</button>
                      </div>
                    ))}
                    {stats.outOfStock.length > 8 && (
                      <p className="stats-more">...ועוד {stats.outOfStock.length - 8}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS */}
      {activeTab === 'orders' && (
        <div>
          <div className="orders-stats">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="orders-stat-card" style={{ borderTop: `3px solid ${cfg.color}` }}>
                <div className="stat-number" style={{ color: cfg.color }}>{orders.filter(o => o.status === key).length}</div>
                <div className="stat-label">{cfg.label}</div>
              </div>
            ))}
          </div>
          <div className="orders-filter">
            <button className={`admin-cat-btn ${orderFilter === 'all' ? 'active' : ''}`} onClick={() => setOrderFilter('all')}>הכל <span className="admin-cat-count">{orders.length}</span></button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} className={`admin-cat-btn ${orderFilter === key ? 'active' : ''}`} onClick={() => setOrderFilter(key)}>
                {cfg.label} <span className="admin-cat-count">{orders.filter(o => o.status === key).length}</span>
              </button>
            ))}
          </div>
          {filteredOrders.length === 0 ? <div className="admin-empty">אין הזמנות עדיין</div> : (
            <div className="orders-list">
              {filteredOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                      <div className="order-card-right">
                        <span className="order-id">#{order.id}</span>
                        <div><div className="order-customer-name">{order.customer_name}</div><div className="order-meta">{order.customer_phone} • {formatDate(order.created_at)}</div></div>
                      </div>
                      <div className="order-card-left">
                        <span className="order-total-badge">₪{order.total}</span>
                        <span className="order-delivery-badge">{order.delivery_method === 'pickup' ? '🏪 איסוף' : '🚚 משלוח'}</span>
                        <span className="order-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                        <span className="order-expand-btn">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="order-card-body">
                        <div className="order-details-grid">
                          <div className="order-detail-item"><span className="order-detail-label">שם</span><span>{order.customer_name}</span></div>
                          <div className="order-detail-item"><span className="order-detail-label">טלפון</span><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></div>
                          {order.customer_email && <div className="order-detail-item"><span className="order-detail-label">אימייל</span><span>{order.customer_email}</span></div>}
                          {order.delivery_address && <div className="order-detail-item"><span className="order-detail-label">כתובת</span><span>{order.delivery_address}</span></div>}
                          {order.notes && <div className="order-detail-item full"><span className="order-detail-label">הערות</span><span>{order.notes}</span></div>}
                        </div>
                        <div className="order-items">
                          <strong>פריטים:</strong>
                          <table className="order-items-table">
                            <thead><tr><th>מוצר</th><th>צבע</th><th>כמות</th><th>מחיר</th></tr></thead>
                            <tbody>{order.items.map((item, i) => <tr key={i}><td>{item.name}</td><td>{item.selectedColor||'—'}</td><td>{item.quantity}</td><td>₪{item.price * item.quantity}</td></tr>)}</tbody>
                          </table>
                          <div className="order-totals">
                            <span>מוצרים: ₪{order.subtotal}</span>
                            <span>משלוח: {order.delivery_fee > 0 ? `₪${order.delivery_fee}` : 'חינם'}</span>
                            <strong>סה"כ: ₪{order.total}</strong>
                          </div>
                        </div>
                        <div className="order-actions">
                          <div className="order-status-select">
                            <label>שנה סטטוס:</label>
                            <div className="status-buttons">
                              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <button key={key} className={`status-btn ${order.status === key ? 'active' : ''}`}
                                  style={order.status === key ? { background: cfg.color, color: 'white' } : {}}
                                  onClick={() => handleStatusChange(order.id, key)}>{cfg.label}</button>
                              ))}
                            </div>
                          </div>
                          <button className="delete-btn" onClick={() => handleDeleteOrder(order.id)}>מחק הזמנה</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS */}
      {activeTab === 'products' && (
        <div>
          <div className="admin-search-bar">
            <input placeholder="🔍 חפש לפי שם או מק״ט..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="admin-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
          </div>
          <div className="admin-category-filter">
            <button className={`admin-cat-btn ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>🏪 הכל <span className="admin-cat-count">{products.length}</span></button>
            {CATEGORIES.map(cat => (
              <button key={cat.id} className={`admin-cat-btn ${filterCategory === cat.id ? 'active' : ''}`} onClick={() => setFilterCategory(cat.id)}>
                {cat.icon} {cat.label} <span className="admin-cat-count">{products.filter(p => p.category === cat.id).length}</span>
              </button>
            ))}
          </div>
          <div className="admin-results-info">{(searchQuery || filterCategory !== 'all') ? `מציג ${filteredProducts.length} מוצרים` : ''}</div>
          {filteredProducts.length === 0 ? <div className="admin-empty">אין מוצרים</div> : (
            <div className="admin-products-grid">
              {filteredProducts.map(product => (
                <div key={product.id} className="admin-product-card">
                  {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="admin-product-no-img">אין תמונה</div>}
                  <div className="admin-product-body">
                    <div className="admin-product-title">{product.name}</div>
                    {product.sku && <div className="admin-product-sku">מק"ט: {product.sku}</div>}
                    <div className="admin-product-meta">
                      <span className="admin-price">₪{product.price}</span>
                      <button className={`stock-toggle-btn ${product.in_stock !== false ? 'in' : 'out'}`} onClick={() => toggleStock(product)} title="לחץ לשינוי מלאי">
                        {product.in_stock !== false ? '✓ במלאי' : '✗ אזל'}
                      </button>
                    </div>
                    {product.category && <div className="admin-category-tag">{CATEGORIES.find(c => c.id === product.category)?.icon} {CATEGORIES.find(c => c.id === product.category)?.label}</div>}
                  </div>
                  <div className="admin-product-actions">
                    <button className="edit-btn" onClick={() => handleEdit(product)}>ערוך</button>
                    <button className="delete-btn" onClick={() => handleDelete(product.id)}>מחק</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD/EDIT */}
      {activeTab === 'add' && (
        <form onSubmit={editingProduct ? handleUpdate : handleSubmit} className="admin-form">
          <h2>{editingProduct ? `עריכת: ${editingProduct.name}` : 'מוצר חדש'}</h2>
          <div className="admin-form-grid">
            <div className="admin-form-group full"><label>שם המוצר *</label><input placeholder="שם המוצר" value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="admin-form-group"><label>מחיר (₪) *</label><input placeholder="0" type="number" value={price} onChange={e => setPrice(e.target.value)} required /></div>
            <div className="admin-form-group">
              <label>מלאי</label>
              <div className="instock-toggle-wrap">
                <button type="button" className={`instock-toggle ${inStock ? 'in' : 'out'}`} onClick={() => setInStock(!inStock)}>
                  <span className="instock-toggle-knob" />
                </button>
                <span className={`instock-toggle-label ${inStock ? 'in' : 'out'}`}>{inStock ? '✓ יש במלאי' : '✗ אזל מהמלאי'}</span>
              </div>
            </div>
            <div className="admin-form-group"><label>מק"ט</label><input placeholder="TT-1042" value={sku} onChange={e => setSku(e.target.value)} /></div>
            <div className="admin-form-group"><label>קטגוריה *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required>
                <option value="">בחר קטגוריה</option>
                {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
              </select>
            </div>
            <div className="admin-form-group full"><label>צבעים</label><input placeholder="לבן, שחור, אפור" value={colors} onChange={e => setColors(e.target.value)} /></div>
            <div className="admin-form-group full"><label>תיאור</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
            <div className="admin-form-group full">
              <label>תמונות (עד 5) {totalImagesSelected > 0 && <span className="images-count-badge">{totalImagesSelected}/5</span>}</label>
              {existingImages.length > 0 && (
                <div className="existing-images">
                  {existingImages.map((url, i) => (
                    <div key={i} className="existing-image-item">
                      <img src={url} alt={`תמונה ${i+1}`} />
                      {i === 0 && <span className="main-image-badge">ראשית</span>}
                      <button type="button" className="remove-image-btn" onClick={() => removeExistingImage(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {totalImagesSelected < 5 && <input type="file" accept="image/*" multiple onChange={e => setImages(Array.from(e.target.files).slice(0, 5 - totalImagesSelected))} />}
              <p className="admin-images-hint">התמונה הראשונה תוצג כתמונה הראשית</p>
            </div>
          </div>
          <div className="admin-form-buttons">
            <button type="submit" className="admin-submit-btn" disabled={uploadingImages}>{uploadingImages ? '⏳ מעלה...' : editingProduct ? '💾 שמור' : '➕ הוסף'}</button>
            {editingProduct && <button type="button" className="admin-cancel-btn" onClick={() => { resetForm(); setActiveTab('products'); }}>ביטול</button>}
          </div>
        </form>
      )}

      {/* IMPORT */}
      {activeTab === 'import' && (
        <div className="import-section">
          <div className="import-instructions">
            <h2>ייבוא מוצרים מ-CSV</h2>
            <p>עמודות: name, price, in_stock (true/false), sku, category, colors, description</p>
            <div className="import-categories-list">
              <strong>קטגוריות:</strong>
              <div className="import-cat-tags">
                {CATEGORIES.map(cat => <span key={cat.id} className="import-cat-tag">{cat.icon} <code>{cat.id}</code> = {cat.label}</span>)}
              </div>
            </div>
            <button className="download-template-btn" onClick={downloadTemplate}>📄 הורד תבנית CSV</button>
          </div>
          <div className="import-upload-area" onClick={() => document.getElementById('csv-input').click()}>
            <span className="import-upload-icon">📥</span><p>לחץ לבחירת קובץ CSV</p>
            <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvFile} />
          </div>
          {csvErrors.length > 0 && <div className="import-errors"><h4>⚠️ שגיאות ({csvErrors.length})</h4><ul>{csvErrors.map((e,i) => <li key={i}>{e}</li>)}</ul></div>}
          {csvPreview?.length > 0 && (
            <div className="import-preview">
              <h4>{csvPreview.length} מוצרים מוכנים</h4>
              <div className="import-preview-table-wrap">
                <table className="import-preview-table">
                  <thead><tr><th>שם</th><th>מחיר</th><th>מלאי</th><th>מק"ט</th><th>קטגוריה</th></tr></thead>
                  <tbody>{csvPreview.slice(0,10).map((r,i) => <tr key={i}><td>{r.name}</td><td>₪{r.price}</td><td>{r.in_stock ? '✓ יש' : '✗ אזל'}</td><td>{r.sku||'—'}</td><td>{CATEGORIES.find(c=>c.id===r.category)?.label}</td></tr>)}</tbody>
                </table>
                {csvPreview.length > 10 && <p className="import-preview-more">...ועוד {csvPreview.length - 10}</p>}
              </div>
              <button className="import-confirm-btn" onClick={handleImport} disabled={importing}>{importing ? '⏳ מייבא...' : `✅ ייבא ${csvPreview.length} מוצרים`}</button>
            </div>
          )}
          {importResult && (
            <div className="import-result">
              <span className="import-result-icon">🎉</span><h4>הושלם!</h4>
              <p>✅ {importResult.success} נוספו</p>
              {importResult.failed > 0 && <p>❌ {importResult.failed} נכשלו</p>}
              <button className="admin-submit-btn" onClick={() => { setActiveTab('products'); setImportResult(null); }}>צפה במוצרים</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Admin;