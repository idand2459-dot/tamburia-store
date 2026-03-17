import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  return (
    <div className="App">
      <header>
        <h1>🎨 טמבוריה סטור</h1>
        <p>חנות צבעים וכלי בית</p>
      </header>

      <main>
        <h2>המוצרים שלנו</h2>
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <h3>{product.name}</h3>
              <p className="price">₪{product.price}</p>
              <p className="stock">במלאי: {product.stock}</p>
              <button>הוסף לעגלה</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
