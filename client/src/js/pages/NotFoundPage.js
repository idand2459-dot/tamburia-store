/**
 * עמוד 404, מחובר לניתוב.
 */
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { CATEGORIES_SELECTOR } from '../utils/sections';
import { SearchX, Home, LayoutGrid } from 'lucide-react';
import { ADDRESS, PHONES } from '../utils/storeInfo';

const PATHS = { home: '/', categories: '/', about: '/about', contact: '/contact', returns: '/returns' };

/* לקטגוריות אין נתיב משלהן — הרשת היא מקטע בעמוד הבית — ולכן הכפתור
   מנווט לשם ומבקש בדרך גלילה אל המקטע. אותו המקטע שכפתור הכרזה גולל
   אליו; ההבדל היחיד הוא שכאן העמוד עוד לא קיים ברגע הלחיצה, ולכן
   הבקשה נוסעת ב-state של הניווט ו-HomePage הוא שמבצע אותה. */
const SCROLL_TARGETS = { categories: CATEGORIES_SELECTOR };

/** מציג את מסך ה-404 ומתרגם את הניווט שלו לכתובות. */
function NotFoundPage() {
  const navigate = useNavigate();
  usePageTitle('העמוד לא נמצא');

  /** מנווט לעמוד המבוקש, ואם הוא מקטע — מבקש גם את הגלילה אליו. */
  function handleNavigate(page) {
    const target = SCROLL_TARGETS[page];
    navigate(PATHS[page] || '/', target ? { state: { scrollTo: target } } : undefined);
  }

  return <NotFound onNavigate={handleNavigate} />;
}

/** מציג את עמוד השגיאה 404. */
function NotFound({ onNavigate }) {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <span className="not-found-icon"><SearchX size={34} strokeWidth={1.75} aria-hidden="true" /></span>
        {/* האפס האמצעי באדום — זה כל הקישוט שהמספר צריך. aria-hidden
            כי "404" מנוקד לשלוש ספרות נפרדות אינו מה שרוצים לשמוע,
            והכותרת שמתחתיו אומרת את הדבר עצמו. */}
        <p className="not-found-code" aria-hidden="true">
          4<span className="not-found-code-accent">0</span>4
        </p>
        <h1 className="not-found-title">העמוד לא נמצא</h1>
        <p className="not-found-desc">
          הקישור שהגעתם דרכו כבר לא מוביל לשום מקום — אבל כל השאר עדיין כאן.
        </p>
        <div className="not-found-actions">
          <button className="not-found-btn not-found-btn--primary" onClick={() => onNavigate('home')}>
            <Home size={18} aria-hidden="true" /> לדף הבית
          </button>
          <button className="not-found-btn not-found-btn--outline" onClick={() => onNavigate('categories')}>
            <LayoutGrid size={18} aria-hidden="true" /> לקטגוריות
          </button>
        </div>
        <p className="not-found-info">
          {ADDRESS.full} · {PHONES.store.display}
        </p>
      </div>
    </div>
  );
}

export default NotFoundPage;
