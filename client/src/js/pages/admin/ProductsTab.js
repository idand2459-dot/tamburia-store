/**
 * לשונית המוצרים: חיפוש, סינון ורשימת המוצרים.
 *
 * החיפוש והסינון יושבים בכתובת (?category=…&q=…) ולא ב-state מקומי,
 * כדי שרענון, "חזור" בדפדפן וחזרה מהטופס לא יאפסו אותם ל"הכל". בחירת
 * שבב היא כניסה חדשה בהיסטוריה; הקלדה בחיפוש מחליפה את הנוכחית, אחרת
 * כל אות הייתה עוד לחיצה על "חזור".
 *
 * כתובת שנשמרת היא גם כתובת שיכולה להתיישן. לכן לחיצה על שבב מנקה את
 * החיפוש (חיפוש שנשכח בכתובת עקף כל שבב, והרשימה נראתה תקועה), וערך
 * בכתובת שאין לו שבב — לא מוכר, או קטגוריה שהתרוקנה — חוזר בשקט ל"הכל".
 *
 * "ערוך" אינו טוען את הטופס בעצמו אלא רק מסמן את המוצר הנערך ב-Admin
 * ועובר ללשונית הטופס, וזה מה שממלא את השדות.
 *
 * שני שבבים בשורה אינם קטגוריה, ושניהם רשימות משימות ולא עוד דרך
 * לעיין בקטלוג: "ללא מחיר" מראה מוצרים שהמחיר שלהם במסד 0 ולכן אי
 * אפשר להזמין אותם, ו"מוסתרים" מראה את מה שהוצא מהחנות. הם יושבים
 * באותה שורה ובאותו state כמו הקטגוריות, כדי שהבחירה תישאר "מה אני
 * רואה עכשיו" אחת ויחידה ולא שלושה צירי סינון שצריך להחזיק בראש
 * בטלפון.
 *
 * כל מה שאינו השבב הזה מראה מוצרים גלויים בלבד — גם "הכל" וגם כל
 * קטגוריה. מוצר מוסתר אינו בחנות, ואין סיבה שהוא יצוץ בין המוצרים
 * שעובדים עליהם; מי שמחפש אותו יודע לאן ללחוץ. החיפוש לפי שם ומק"ט
 * הוא היוצא מן הכלל: הוא מחפש בקטלוג כולו, כי מי שמקליד שם מדויק
 * מחפש מוצר ולא מסנן רשימה.
 *
 * מוצר אחד הוא AdminProductCard, שמחזיק גם את עריכת המחיר במקום.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Store, AlertTriangle, CircleDollarSign, EyeOff, ListTree } from 'lucide-react';
import CATEGORY_ICONS from '../../utils/categoryIcons';
import { hasPrice } from '../../utils/pricing';
import { lacksSubcategory } from '../../utils/subcategories';
import { CATEGORIES } from './adminConstants';
import AdminProductCard from './AdminProductCard';

/* מזהי השבבים שאינם קטגוריה. עם מקף, כדי שלא יתנגשו במזהה קטגוריה. */
const NO_PRICE_FILTER = 'no-price';
const HIDDEN_FILTER = 'hidden';
const NO_SUB_FILTER = 'no-sub';

/** האם המוצר גלוי בחנות. ברירת המחדל היא כן, כמו במסד. */
const isVisible = (product) => product.active !== false;

/** מציג את לשונית המוצרים. */
function ProductsTab({
  products, productsLoaded = true, onEdit, onDelete, onToggleStock, onToggleActive, onUpdatePrice,
  onUpdateSubcategory, productsError, scrollToId, onScrolled,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const visibleProducts = products.filter(isVisible);

  /* רק הקטגוריות שיש בהן מוצרים. שבב עם 0 הוא שבב שאין בו מה ללחוץ,
     ובטלפון הוא מאריך את הרצועה שצריך לגלול. הספירה היא של הגלויים
     בלבד, כמו הרשימה שהשבב פותח. */
  const usedCategories = CATEGORIES
    .map(cat => ({ ...cat, count: visibleProducts.filter(p => p.category === cat.id).length }))
    .filter(cat => cat.count > 0);

  /* הסינון שבכתובת תקף רק אם יש לו שבב. ערך שאינו מוכר (קישור ישן,
     הקלדה ידנית) — או קטגוריה שהתרוקנה, ששבב שלה כבר לא מוצג — הוא
     "הכל": אחרת המסך מראה רשימה ריקה בלי שום שבב מסומן, ואין ממה להבין
     למה. "ללא מחיר" ו"מוסתרים" תקפים גם כשהם ריקים — לשבב שלהם יש הודעה
     משלו ("לכל המוצרים יש מחיר"), והוא נשאר מוצג כשהוא פעיל.

     עד שהרשימה הגיעה מהשרת כל קטגוריה נראית ריקה, ולכן קטגוריה מוכרת
     נבדקת רק אחרי הטעינה. */
  const filterIsValid = requestedFilter === 'all'
    || requestedFilter === HIDDEN_FILTER
    || requestedFilter === NO_PRICE_FILTER
    || requestedFilter === NO_SUB_FILTER
    || (productsLoaded
      ? usedCategories.some(cat => cat.id === requestedFilter)
      : CATEGORIES.some(cat => cat.id === requestedFilter));
  const filter = filterIsValid ? requestedFilter : 'all';

  /** מעדכן את הכתובת. ערך ריק מוחק פרמטר, כדי ש"הכל" יהיה כתובת נקייה. */
  function setParams(changes, replace) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace });
  }

  /* ערך לא תקף יוצא מהכתובת בשקט (replace — לא עוד כניסה ב"חזור"), כדי
     שרענון או קישור מהכתובת הזו לא יחזירו אותו. */
  useEffect(() => {
    if (!filterIsValid && productsLoaded) setParams({ category: '' }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams נבנה מחדש בכל רינדור
  }, [filterIsValid, productsLoaded]);

  /* לחיצה על שבב מנקה גם את החיפוש. חיפוש עוקף את הסינון (ראו למטה),
     ולכן שבב שנלחץ בזמן שיש חיפוש בכתובת היה מסמן את עצמו ומשנה את
     הכתובת — והרשימה הייתה נשארת תוצאות החיפוש. חיפוש שנשכח בכתובת
     (מגיע גם מרענון ומחזרה מהטופס) נראה כמו רשימה תקועה. */
  const setFilter = (value) => setParams({ category: value === 'all' ? '' : value, q: '' }, false);
  const setSearchQuery = (value) => setParams({ q: value }, true);

  /* חזרה מהטופס: גוללים למוצר שנערך. פריים אחד אחרי הציור, כשהרשימה כבר
     בדף. אם הוא כבר אינו בסינון (נגיד, קיבל מחיר ברשימת "ללא מחיר"),
     פשוט נשארים בראש. */
  useEffect(() => {
    if (scrollToId == null) return undefined;
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-product-id="${scrollToId}"]`)
        ?.scrollIntoView({ block: 'center' });
      onScrolled();
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToId, onScrolled]);

  const query = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter(p => {
    const matchFilter = filter === HIDDEN_FILTER
      ? !isVisible(p)
      : isVisible(p) && (
        filter === 'all'
        || (filter === NO_PRICE_FILTER && !hasPrice(p))
        || (filter === NO_SUB_FILTER && lacksSubcategory(p))
        || p.category === filter
      );

    // חיפוש מפורש עוקף את הסינון ומגיע גם למוסתרים: מי שמקליד מק"ט
    // מחפש מוצר מסוים, ולא היה מוצא אותו אחרי שהסתיר אותו.
    if (query) {
      return p.name.toLowerCase().includes(query)
        || (p.sku && p.sku.toLowerCase().includes(query));
    }
    return matchFilter;
  });

  const hiddenCount = products.length - visibleProducts.length;
  const noPriceCount = visibleProducts.filter(p => !hasPrice(p)).length;

  /* כמו שבב קטגוריה ריק, הוא אינו מוצג כשאין בו מה ללחוץ — וזה גם
     הסימן שלכל המוצרים יש מחיר. אבל כשהוא הסינון הפעיל הוא נשאר,
     אחרת תיקון המוצר האחרון היה משאיר רשימה ריקה בלי שבב לחזור דרכו. */
  const showNoPrice = noPriceCount > 0 || filter === NO_PRICE_FILTER;

  /* אותו כלל בדיוק לשבב המוסתרים: הוא מופיע רק כשיש מה להסתכל עליו,
     ונשאר כשהוא הסינון הפעיל — אחרת החזרת המוצר האחרון לחנות הייתה
     משאירה רשימה ריקה בלי שבב לחזור דרכו. */
  const showHidden = hiddenCount > 0 || filter === HIDDEN_FILTER;

  /* ושוב אותו כלל, לשבב "ללא תת-קטגוריה": מוצרים גלויים שבחנות יופיעו
     רק תחת "הכל" — בלי תת-קטגוריה, או עם ערך שאינו שייך לקטגוריה שלהם
     (שם חופשי מייבוא ישן). זו רשימת העבודה לשיבוץ המהיר בכרטיס. */
  const noSubCount = visibleProducts.filter(lacksSubcategory).length;
  const showNoSub = noSubCount > 0 || filter === NO_SUB_FILTER;

  /* בזמן חיפוש אף שבב אינו מסומן: החיפוש עובר על הקטלוג כולו, ושבב
     מסומן היה אומר שהרשימה מסוננת לפיו — וזו בדיוק הייתה ההטעיה. */
  const isActive = (id) => !query && filter === id;

  return (
    <div className="admin-products">
      <div className="admin-search">
        <Search className="admin-search-icon" size={20} aria-hidden="true" />
        <input
          className="admin-search-input"
          placeholder="חפש לפי שם או מק״ט"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="חיפוש מוצר"
        />
        {searchQuery && (
          <button type="button" className="admin-search-clear" onClick={() => setSearchQuery('')} aria-label="נקה חיפוש">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="admin-cats" role="group" aria-label="סינון מוצרים">
        <button
          type="button"
          className={`admin-cat ${isActive('all') ? 'is-active' : ''}`}
          aria-pressed={isActive('all')}
          onClick={() => setFilter('all')}>
          <Store size={18} aria-hidden="true" /> הכל
          <span className="admin-cat-count">{visibleProducts.length}</span>
        </button>

        {/* לפני "ללא מחיר": מוצר מוסתר אינו נמכר בכלל, ולכן זו השאלה
            הראשונה על הקטלוג ולא השנייה */}
        {showHidden && (
          <button
            type="button"
            className={`admin-cat admin-cat--muted ${isActive(HIDDEN_FILTER) ? 'is-active' : ''}`}
            aria-pressed={isActive(HIDDEN_FILTER)}
            onClick={() => setFilter(HIDDEN_FILTER)}>
            <EyeOff size={18} aria-hidden="true" /> מוסתרים
            <span className="admin-cat-count">{hiddenCount}</span>
          </button>
        )}

        {/* מיד אחרי "הכל" ולפני הקטגוריות: זו רשימת עבודה, לא עוד דרך
            לעיין בקטלוג */}
        {showNoPrice && (
          <button
            type="button"
            className={`admin-cat admin-cat--alert ${isActive(NO_PRICE_FILTER) ? 'is-active' : ''}`}
            aria-pressed={isActive(NO_PRICE_FILTER)}
            onClick={() => setFilter(NO_PRICE_FILTER)}>
            <CircleDollarSign size={18} aria-hidden="true" /> ללא מחיר
            <span className="admin-cat-count">{noPriceCount}</span>
          </button>
        )}

        {showNoSub && (
          <button
            type="button"
            className={`admin-cat admin-cat--alert ${isActive(NO_SUB_FILTER) ? 'is-active' : ''}`}
            aria-pressed={isActive(NO_SUB_FILTER)}
            onClick={() => setFilter(NO_SUB_FILTER)}>
            <ListTree size={18} aria-hidden="true" /> ללא תת-קטגוריה
            <span className="admin-cat-count">{noSubCount}</span>
          </button>
        )}

        {usedCategories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              className={`admin-cat ${isActive(cat.id) ? 'is-active' : ''}`}
              aria-pressed={isActive(cat.id)}
              onClick={() => setFilter(cat.id)}>
              {Icon && <Icon size={18} aria-hidden="true" />} {cat.label}
              <span className="admin-cat-count">{cat.count}</span>
            </button>
          );
        })}
      </div>

      {productsError && (
        <div className="admin-error">
          <AlertTriangle size={18} aria-hidden="true" /> {productsError}
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="admin-empty">
          {query ? `לא נמצא מוצר בשם "${searchQuery.trim()}"`
            : filter === NO_PRICE_FILTER ? 'לכל המוצרים יש מחיר'
            : filter === HIDDEN_FILTER ? 'כל המוצרים מוצגים בחנות'
            : filter === NO_SUB_FILTER ? 'לכל המוצרים יש תת-קטגוריה'
            : 'אין מוצרים בקטגוריה הזו'}
        </div>
      ) : (
        <div className="admin-product-list">
          {filteredProducts.map(product => (
            <AdminProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleStock={onToggleStock}
              onToggleActive={onToggleActive}
              onUpdatePrice={onUpdatePrice}
              onUpdateSubcategory={onUpdateSubcategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsTab;
