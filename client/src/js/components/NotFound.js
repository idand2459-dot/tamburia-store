import { SearchX, Home, Phone, MapPin } from 'lucide-react';

/** מציג את עמוד השגיאה 404. */
function NotFound({ onNavigate }) {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <div className="not-found-icon"><SearchX size={64} aria-hidden="true" /></div>
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">הדף לא נמצא</h2>
        <p className="not-found-desc">
          נראה שהדף שחיפשת לא קיים או הוסר.<br />
          אבל יש לנו המון מוצרים שמחכים לך!
        </p>
        <div className="not-found-actions">
          <button className="not-found-btn primary" onClick={() => onNavigate('home')}>
            <Home size={18} aria-hidden="true" /> חזור לדף הבית
          </button>
          <button className="not-found-btn secondary" onClick={() => onNavigate('contact')}>
            <Phone size={18} aria-hidden="true" /> צור קשר
          </button>
        </div>
        <div className="not-found-info">
          <span><MapPin size={16} aria-hidden="true" /> בר כוכבא 52, פתח תקווה</span>
          <span><Phone size={16} aria-hidden="true" /> 03-9315750</span>
        </div>
      </div>
    </div>
  );
}

export default NotFound;