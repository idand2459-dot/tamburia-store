/**
 * עמוד 404, מחובר לניתוב.
 */
import { useNavigate } from 'react-router-dom';
import NotFound from '../components/NotFound';
import { usePageTitle } from '../hooks/usePageTitle';
import { CATEGORIES_SELECTOR } from '../utils/sections';

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

export default NotFoundPage;
