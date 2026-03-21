import { useState, useEffect } from 'react';
import { getWishlist, toggleWishlist } from './wishlistUtils';

function Wishlist({ onClose, onSelectProduct }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getWishlist());
  }, []);

  function handleRemove(product) {
    toggleWishlist(product);
    setItems(getWishlist());
  }

  return (
    <>
      <div className="wishlist-overlay" onClick={onClose} />
      <div className="wishlist-modal">
        <div className="wishlist-header">
          <button className="cart-close-btn" onClick={onClose}>✕</button>
          <h3>❤️ רשימת המשאלות שלי</h3>
        </div>

        <div className="wishlist-body">
          {items.length === 0 ? (
            <div className="wishlist-empty">
              <span>🤍</span>
              <p>רשימת המשאלות ריקה</p>
              <small>לחץ על ❤️ על מוצר כדי להוסיף אותו</small>
            </div>
          ) : (
            <>
              <div className="wishlist-count">{items.length} מוצרים ברשימה</div>
              <div className="wishlist-list">
                {items.map(product => (
                  <div key={product.id} className="wishlist-item">
                    <div className="wishlist-item-img" onClick={() => { onSelectProduct(product); onClose(); }}>
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} />
                        : <span>🖼️</span>
                      }
                    </div>
                    <div className="wishlist-item-info" onClick={() => { onSelectProduct(product); onClose(); }}>
                      <span className="wishlist-item-name">{product.name}</span>
                      <span className="wishlist-item-price">₪{product.price}</span>
                      <span className={`wishlist-item-stock ${product.in_stock !== false ? 'in' : 'out'}`}>
                        {product.in_stock !== false ? '✓ יש במלאי' : '✗ אזל'}
                      </span>
                    </div>
                    <button className="wishlist-remove-btn" onClick={() => handleRemove(product)} title="הסר מהרשימה">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Wishlist;