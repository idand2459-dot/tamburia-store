/**
 * עמוד 404, מחובר לניתוב.
 */
import { useNavigate } from 'react-router-dom';
import NotFound from './NotFound';

const PATHS = { home: '/', about: '/about', contact: '/contact', returns: '/returns' };

/** מציג את מסך ה-404 ומתרגם את הניווט שלו לכתובות. */
function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onNavigate={(page) => navigate(PATHS[page] || '/')} />;
}

export default NotFoundPage;
