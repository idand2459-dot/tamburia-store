import { useState, useEffect } from 'react';
import './App.css';
import Admin from './Admin';
import CategoryPage from './CategoryPage';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
  fetch('/api/products')
    .then(res => res.json())
    .then(data => {
      const filtered = data.filter(p => p.category === selectedCategory.id);
      setProducts(filtered);
    });
     }, [selectedCategory]);

  function addToCart(product) {
    setCart([...cart, product]);
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  if (showAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />;
  }
  if (!selectedCategory) {
  return (
    <div className="App">
      <header>
        <h1>🎨 טמבוריה סטור</h1>
        <p>חנות צבעים וכלי בית</p>
        <button className="admin-btn" onClick={() => setShowAdmin(true)}>ניהול</button>
      </header>
      <div className="hero">
  <h2>כל מה שצריך לבית — במקום אחד</h2>
  <p>מוצרי צביעה, אינסטלציה, כלי עבודה ועוד</p>
</div>
      <CategoryPage onSelectCategory={setSelectedCategory} />
    </div>
  );
}

  return (
    <div className="App">
     <header>
  <h1>🎨 טמבוריה סטור</h1>
  <p>חנות צבעים וכלי בית</p>
  <div className="cart-badge">🛒 {cart.length} פריטים | ₪{total}</div>
  <div className="header-buttons">
    <button className="back-btn" onClick={() => setSelectedCategory(null)}>← קטגוריות</button>
    <button className="admin-btn" onClick={() => setShowAdmin(true)}>ניהול</button>
       </div>
     </header>

      <main>
        <h2>המוצרים שלנו</h2>
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
               {product.image_url && <img src={product.image_url} alt={product.name} />}
               <h3>{product.name}</h3>
              <p className="price">₪{product.price}</p>
              <p className="stock">במלאי: {product.stock}</p>
              <button onClick={() => addToCart(product)}>הוסף לעגלה</button>
            </div>
          ))}
        </div>
      </main>

      {cart.length > 0 && (
        <div className="cart-panel">
          <h3>🛒 העגלה שלי</h3>
          <ul>
            {cart.map((item, index) => (
              <li key={index}>{item.name} — ₪{item.price}</li>
            ))}
          </ul>
          <div className="cart-total">סה"כ: ₪{total}</div>
          <button className="clear-btn" onClick={() => setCart([])}>רוקן עגלה</button>
        </div>
      )}
    </div>
  );
}

export default App;