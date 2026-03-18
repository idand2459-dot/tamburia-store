import { useState, useEffect } from 'react';

function Admin({ onBack }) {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [colors, setColors] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  function fetchProducts() {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    let imageUrl = '';

    if (image) {
      const formData = new FormData();
      formData.append('image', image);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.imageUrl;
    }

    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: parseInt(price),
        stock: parseInt(stock),
        image_url: imageUrl,
        colors: colors.split(',').map(c => c.trim()).filter(c => c !== ''),
        category
      })
    });

    setName('');
    setPrice('');
    setStock('');
    setColors('');
    setCategory('');
    setImage(null);
    fetchProducts();
  }

  async function handleDelete(id) {
    await fetch('/api/products/' + id, { method: 'DELETE' });
    fetchProducts();
  }

  return (
    <div className="admin">
      <button className="back-btn" onClick={onBack}>← חזור לחנות</button>
      <h1>ניהול מוצרים</h1>

      <form onSubmit={handleSubmit} className="admin-form">
        <h2>הוסף מוצר חדש</h2>
        <input placeholder="שם המוצר" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="מחיר" type="number" value={price} onChange={e => setPrice(e.target.value)} required />
        <input placeholder="כמות במלאי" type="number" value={stock} onChange={e => setStock(e.target.value)} required />
        <input placeholder="צבעים (מופרדים בפסיק: לבן, שחור, אפור)" value={colors} onChange={e => setColors(e.target.value)} />
        <select value={category} onChange={e => setCategory(e.target.value)} required>
          <option value="">בחר קטגוריה</option>
          <option value="painting">מוצרי צביעה</option>
          <option value="kitchen">מוצרי מטבח</option>
          <option value="bathroom">מוצרי אמבטיה</option>
          <option value="tools">כלי עבודה</option>
          <option value="cleaning">ניקיון</option>
          <option value="garden">גינה</option>
          <option value="plumbing">אינסטלציה</option>
          <option value="adhesives">דבקים</option>
          <option value="locks">צילינדרים ומנעולים</option>
          <option value="faucets">ברזים</option>
        </select>
        <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
        <button type="submit">הוסף מוצר</button>
      </form>

      <div className="admin-products">
        <h2>המוצרים הקיימים</h2>
        {products.map(product => (
          <div key={product.id} className="admin-product-row">
            {product.image_url && <img src={product.image_url} alt={product.name} />}
            <div>
              <strong>{product.name}</strong>
              <span>₪{product.price}</span>
              <span>מלאי: {product.stock}</span>
              {product.colors && <span>צבעים: {product.colors.join(', ')}</span>}
            </div>
            <button className="delete-btn" onClick={() => handleDelete(product.id)}>מחק</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Admin;