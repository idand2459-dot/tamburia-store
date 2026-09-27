/**
 * שלוש ההבטחות שמתחת לכפתור ההוספה: משלוח, איסוף והחזרה.
 *
 * הטקסטים כתובים כאן ולא ב-utils/storeInfo.js, כי אף אחד מהם אינו
 * נתון שקיים שם: הקובץ ההוא מחזיק כתובת, טלפונים ושעות, והשלושה האלה
 * הם ניסוח של מדיניות — בדיוק כמו בעמוד השאלות הנפוצות ובטופס
 * ההזמנה, שכותבים אותם באותה צורה. האייקונים מגיעים מאותה שפה
 * שהאתר משתמש בה לשלושת הרעיונות האלה בכל מקום אחר.
 */
import { Link } from 'react-router-dom';
import { Truck, Store, RotateCcw } from 'lucide-react';

/** מציג את שורת ההבטחות של עמוד המוצר. */
function ProductTrustRow() {
  return (
    <ul className="product-trust">
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          <Truck size={17} />
        </span>
        משלוח לפתח תקווה, גני תקווה וקריית אונו — ₪20
      </li>
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          <Store size={17} />
        </span>
        איסוף עצמי באותו יום
      </li>
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          <RotateCcw size={17} />
        </span>
        <Link to="/returns">החזרה עד 14 יום</Link>
      </li>
    </ul>
  );
}

export default ProductTrustRow;
