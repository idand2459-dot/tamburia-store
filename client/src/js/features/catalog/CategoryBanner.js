/**
 * באנר הכותרת של עמוד הקטגוריה: תצלום אווירה, ומעליו הכותרת.
 *
 * לכל קטגוריה יכולה להיות תמונה משלה, והן מגיעות בהדרגה. הבאנר מגלה
 * לבד מה קיים — ראה BANNERS למטה — ולקטגוריה שאין לה תמונה עדיין הוא
 * מציג גרסה חלופית באותו גובה, כדי שהוספת תמונה לא תזיז את העמוד.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';

/**
 * תיאור הקטגוריה, שורה אחת מתחת לכותרת.
 *
 * זה עותק של העיצוב ולא נתון על הקטגוריה, ולכן הוא כאן ולא ב-
 * categories.js — בדיוק כמו המפה שב-utils/categoryIcons.js. מזהה שאין לו
 * כאן שורה פשוט לא יקבל תיאור.
 */
const CATEGORY_DESCRIPTIONS = {
  painting:   'צבעים, מברשות, רולרים וכל מה שצריך לצביעה מקצועית',
  kitchen:    'כיורים, ברזים ואביזרי מטבח',
  bathroom:   'מראות, וילונות ואביזרי אמבטיה',
  tools:      'פטישים, מברגים, מסורים וכלי עבודה מקצועיים',
  cleaning:   'חומרי ניקוי, ספוגים ומוצרי ניקיון לבית',
  garden:     'זרנוקים, כלי גינון ומוצרים לגינה',
  plumbing:   'צינורות, חיבורים וכל פתרונות האינסטלציה',
  adhesives:  'דבקים, סיליקון, טייץ וחומרי איטום',
  locks:      'מנעולים, צילינדרים וכל פתרונות האבטחה',
  faucets:    'ברזים, מחברים ואביזרי מים איכותיים',
  electrical: 'שקעים, מפסקים וציוד חשמל',
  home:       'מוצרים לכל הבית במקום אחד',
};

/**
 * מפת התמונות הקיימות: { painting: [{ width, url }, …], … }, מהצר לרחב.
 *
 * require.context הוא מה שהופך את הוספת התמונה לחסרת-קוד: הוא נפתר
 * בזמן הבנייה על תוכן התיקייה, ולכן קובץ חדש שם מופיע בבנייה הבאה בלי
 * לגעת כאן. התיקייה עצמה חייבת להתקיים — ב-webpack נתיב שאינו קיים הוא
 * שגיאת בנייה — ולכן יש בה .gitkeep. ריקה היא חוקית לגמרי, והמפה פשוט
 * תצא ריקה.
 *
 * שם הקובץ שנספר הוא cat-<id>-<width>.webp, מה ש-npm run images:categories
 * מייצר, וה-width שבשם הוא הרוחב האמיתי של הקובץ — הסקריפט מבטיח את זה.
 * לכן ה-srcSet למטה נגזר מהשם ואין כאן רשימת רוחבים קשיחה: רוחב שיתווסף
 * לסקריפט יופיע כאן לבד. קובץ שלא עונה לתבנית נדלג עליו ולא מפיל כלום.
 */
const BANNERS = (() => {
  const map = {};
  const ctx = require.context('../../../assets/images/categories', false, /\.webp$/);

  ctx.keys().forEach((key) => {
    const match = key.match(/cat-(.+)-(\d+)\.webp$/);
    if (!match) return;
    const [, id, width] = match;
    if (!map[id]) map[id] = [];
    map[id].push({ width: Number(width), url: ctx(key) });
  });

  Object.values(map).forEach((sources) => sources.sort((a, b) => a.width - b.width));

  return map;
})();

/** מציג את באנר הקטגוריה. */
function CategoryBanner({ category, productCount }) {
  const photo = BANNERS[category.id];
  const Icon = CATEGORY_ICONS[category.id] || ShoppingCart;
  const description = CATEGORY_DESCRIPTIONS[category.id];

  // אנימציית הכניסה מתחילה בטעינת התמונה ולא ביצירת האלמנט, כמו בכרזת
  // עמוד הבית: בחיבור איטי היא אחרת מסתיימת לפני שיש מה להראות.
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // תמונה מה-cache מסיימת להיטען לפני שה-onLoad מחובר, ואז האירוע לא
  // יירה לעולם. complete מכסה גם את המקרה הזה.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, [category.id]);

  return (
    <div className={`category-banner ${photo ? 'category-banner--photo' : 'category-banner--plain'}`}>
      {photo ? (
        /* דקורטיבי: את מה שהתמונה מראה אומרת הכותרת שמעליה, ולכן alt ריק.
           fetchPriority high — זו התמונה הראשונה שנראית בעמוד הזה. */
        <img
          ref={imgRef}
          className={`category-banner-photo ${loaded ? 'is-loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          src={photo[photo.length - 1].url}
          srcSet={photo.map((source) => `${source.url} ${source.width}w`).join(', ')}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <span className="category-banner-watermark" aria-hidden="true">
          <Icon size={220} strokeWidth={1} />
        </span>
      )}

      <div className="category-banner-inner">
        <nav className="category-banner-crumbs" aria-label="מסלול ניווט">
          <Link to="/">ראשי</Link>
          <span aria-hidden="true">←</span>
          <span aria-current="page">{category.name}</span>
        </nav>

        <span className="category-banner-icon">
          <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>

        <h1 className="category-banner-title">{category.name}</h1>
        {description && <p className="category-banner-desc">{description}</p>}

        {/* בזמן הטעינה אין מספר, ומספר שגוי לרגע גרוע ממספר שמופיע רגע אחרי */}
        {typeof productCount === 'number' && (
          <span className="category-banner-count">
            {productCount === 1 ? 'מוצר אחד' : `${productCount} מוצרים`}
          </span>
        )}
      </div>
    </div>
  );
}

export default CategoryBanner;
