import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  function addToCart(product) {
    setCart([...cart, product]);
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="App">
      <header>
        <h1>🎨 טמבוריה סטור</h1>
        <p>חנות צבעים וכלי בית</p>
        <div className="cart-badge">🛒 {cart.length} פריטים | ₪{total}</div>
      </header>

      <main>
        <h2>המוצרים שלנו</h2>
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
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
