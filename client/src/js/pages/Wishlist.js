/**
 * חלון המועדפים ורשימת המוצרים שנשמרו.
 */
import { useState, useEffect } from 'react';
import { X, Heart, ImageOff, Check } from 'lucide-react';
import Drawer from '../components/Drawer';
import { getWishlist, toggleWishlist } from '../utils/wishlistUtils';

/** מציג את חלון המועדפים. */
function Wishlist({ onClose, onSelectProduct }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getWishlist());
  }, []);

  /** מסיר מוצר מהמועדפים. */
  function handleRemove(product) {
    toggleWishlist(product);
    setItems(getWishlist());
  }

  return (
    <Drawer title="רשימת המשאלות שלי" icon={Heart} onClose={onClose}>
      <div className="wishlist-body">
        {items.length === 0 ? (
          <div className="wishlist-empty">
            <span><Heart size={48} aria-hidden="true" /></span>
            <p>רשימת המשאלות ריקה</p>
            <small>לחץ על <Heart size={14} fill="currentColor" aria-hidden="true" /> על מוצר כדי להוסיף אותו</small>
          </div>
        ) : (
          <>
            <div className="wishlist-count">{items.length} מוצרים ברשימה</div>
            <div className="wishlist-list">
              {items.map(product => (
                <div key={product.id} className="wishlist-item">
                  {/* רק onSelectProduct: הסגירה היא כבר חלק מהניווט
                      לעמוד המוצר, וקריאה ל-onClose אחריו הייתה
                      מחזירה אחורה ומבטלת אותו. */}
                  <div className="wishlist-item-img" onClick={() => onSelectProduct(product)}>
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} />
                      : <span><ImageOff size={28} aria-hidden="true" /></span>
                    }
                  </div>
                  <div className="wishlist-item-info" onClick={() => onSelectProduct(product)}>
                    <span className="wishlist-item-name">{product.name}</span>
                    <span className="wishlist-item-price">₪{product.price}</span>
                    <span className={`wishlist-item-stock ${product.in_stock !== false ? 'in' : 'out'}`}>
                      {product.in_stock !== false ? <><Check size={14} aria-hidden="true" /> יש במלאי</> : <><X size={14} aria-hidden="true" /> אזל</>}
                    </span>
                  </div>
                  <button className="wishlist-remove-btn" onClick={() => handleRemove(product)} title="הסר מהרשימה" aria-label="הסר מהרשימה">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
    </div>
    </Drawer>
  );
}

export default Wishlist;