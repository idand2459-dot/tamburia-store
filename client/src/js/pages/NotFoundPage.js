/**
 * עמוד 404, מחובר לניתוב.
 */
import { useNavigate } from 'react-router-dom';
import NotFound from '../components/NotFound';

// 'categories' נופל על דף הבית מפני ששם רשת הקטגוריות יושבת — אין לה
// נתיב משלה, והוספת נתיב היא לא עניין של מסך ה-404.
const PATHS = {
  home: '/', categories: '/', about: '/about', contact: '/contact', returns: '/returns',
};

/** מציג את מסך ה-404 ומתרגם את הניווט שלו לכתובות. */
function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onNavigate={(page) => navigate(PATHS[page] || '/')} />;
}

export default NotFoundPage;
