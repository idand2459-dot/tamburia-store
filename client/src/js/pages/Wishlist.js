/**
 * חלון המועדפים ורשימת המוצרים שנשמרו.
 *
 * כל שורה נפתחת לעמוד המוצר דרך Link אמיתי שה-::after שלו נמתח על
 * השורה — אותו דפוס של כרטיס המוצר. קודם זו הייתה שורה של divים עם
 * onClick: אי אפשר היה להגיע אליה ב-Tab, ולחיצה אמצעית או "פתח
 * בלשונית חדשה" לא עשו כלום. כפתור ההסרה יושב מעל אותה שכבה ולכן
 * אינו מנווט.
 *
 * onSelectProduct ירד מהפרופס: הוא היה קורא ל-navigate במסגרת, ועכשיו
 * הקישור עושה זאת בעצמו. הסגירה נשארת כמו שהייתה — היא חלק מהניווט,
 * כי /wishlist הוא כתובת ומעבר למוצר מוריד את החלון.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, Check, X } from 'lucide-react';
import Drawer from '../components/Drawer';
import CATEGORY_ICONS from '../utils/categoryIcons';
import { getWishlist, toggleWishlist } from '../utils/wishlistUtils';
import { orderablePrice, NO_PRICE_LABEL } from '../utils/pricing';

/** מציג את חלון המועדפים. */
function Wishlist({ onClose }) {
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
    <Drawer title="המועדפים שלי" icon={Heart} onClose={onClose}>
      {items.length === 0 ? (
        <div className="wishlist-empty">
          <span className="wishlist-empty-icon" aria-hidden="true">
            <Heart size={28} strokeWidth={1.5} />
          </span>
          <p className="wishlist-empty-title">עוד לא שמרת מוצרים</p>
          <p className="wishlist-empty-text">
            לחיצה על הלב שעל כרטיס מוצר שומרת אותו כאן, גם אחרי סגירת הדף.
          </p>
          <button type="button" className="cart-cta cart-cta--outline" onClick={onClose}>
            להמשך קנייה
          </button>
        </div>
      ) : (
        <ul className="wishlist-rows">
          {items.map(product => {
            const Icon = CATEGORY_ICONS[product.category];
            const inStock = product.in_stock !== false;
            const price = orderablePrice(product);
            return (
              <li key={product.id} className="wishlist-row">
                <div className="wishlist-row-well">
                  {product.image_url
                    ? <img className="wishlist-row-img" src={product.image_url} alt={product.name} />
                    : (
                      <span className="wishlist-row-fallback" aria-hidden="true">
                        {Icon && <Icon size={22} strokeWidth={1.5} />}
                      </span>
                    )}
                </div>

                <div className="wishlist-row-main">
                  <span className="wishlist-row-name">
                    <Link className="wishlist-row-link" to={`/product/${product.id}`}>{product.name}</Link>
                  </span>
                  <span className={`wishlist-row-price ${price === null ? 'is-no-price' : ''}`}>
                    {price === null ? NO_PRICE_LABEL : `₪${price}`}
                  </span>
                  <span className={`wishlist-row-stock ${inStock ? 'is-in' : 'is-out'}`}>
                    {inStock
                      ? <><Check size={13} aria-hidden="true" /> במלאי</>
                      : <><X size={13} aria-hidden="true" /> אזל</>}
                  </span>
                </div>

                <button
                  type="button"
                  className="wishlist-row-remove"
                  onClick={() => handleRemove(product)}
                  aria-label={`הסר מהמועדפים: ${product.name}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

export default Wishlist;
