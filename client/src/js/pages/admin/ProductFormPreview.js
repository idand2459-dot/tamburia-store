/**
 * "איך זה ייראה בחנות" — כרטיס המוצר האמיתי, מתוך שדות הטופס.
 *
 * הרכיב שמרונדר כאן הוא components/ProductCard, אותו אחד שעמוד
 * הקטגוריה מציג, ולא חיקוי שלו. חיקוי היה מתיישן ברגע שהכרטיס משתנה,
 * וכל הרעיון הוא שמה שנראה כאן הוא מה שהלקוח יראה — כולל הפלייסהולדר
 * של קטגוריה בלי תמונה, תג "אזל מהמלאי" ותצוגת "מ-₪" לגרסאות.
 *
 * הכרטיס מקבל את השדות בצורת מוצר, ולא מוצר אמיתי מהשרת: בזמן ההקלדה
 * עדיין אין רשומה. הכפתורים שלו מקבלים פונקציות ריקות, והפאנל כולו
 * מנוטרל ללחיצות ב-CSS (pointer-events) — כך גם הקישור על שם המוצר
 * אינו מנווט לעמוד של מוצר שאינו קיים.
 */
import ProductCard from '../../components/ProductCard';
import { parsePriceInput } from '../../utils/pricing';

/** בונה אובייקט בצורת מוצר מתוך שדות הטופס. */
function productFromFields(fields, imageUrl) {
  const variants = fields.variants
    .filter(v => v.label.trim() && v.price !== '')
    .map(v => ({ label: v.label.trim(), price: parsePriceInput(v.price) ?? 0 }));

  return {
    id: 0,
    name: fields.name.trim() || 'שם המוצר',
    price: parsePriceInput(fields.price) ?? 0,
    sku: fields.sku.trim(),
    in_stock: fields.inStock,
    image_url: imageUrl,
    variants,
  };
}

/** מציג את התצוגה המקדימה של כרטיס המוצר. */
function ProductFormPreview({ fields, imageUrl, categoryId }) {
  return (
    <aside className="admin-preview" aria-label="תצוגה מקדימה">
      <h3 className="admin-preview-title">איך זה ייראה בחנות</h3>

      {/* aria-hidden ביחד עם ה-pointer-events של הפאנל: זו תמונה של
          הכרטיס, ואין טעם שקורא מסך יעבור על כפתורים שאינם עושים דבר. */}
      <div className="admin-preview-stage" aria-hidden="true">
        <ProductCard
          product={productFromFields(fields, imageUrl)}
          categoryId={categoryId}
          onAddToCart={() => {}}
          inWishlist={false}
          onToggleWishlist={() => {}}
        />
      </div>

      <p className="admin-preview-hint">הכפתורים בתצוגה הזו אינם פעילים.</p>
    </aside>
  );
}

export default ProductFormPreview;
