function NotFound({ onNavigate }) {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <div className="not-found-icon">🔧</div>
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">הדף לא נמצא</h2>
        <p className="not-found-desc">
          נראה שהדף שחיפשת לא קיים או הוסר.<br />
          אבל יש לנו המון מוצרים שמחכים לך!
        </p>
        <div className="not-found-actions">
          <button className="not-found-btn primary" onClick={() => onNavigate('home')}>
            🏠 חזור לדף הבית
          </button>
          <button className="not-found-btn secondary" onClick={() => onNavigate('contact')}>
            📞 צור קשר
          </button>
        </div>
        <div className="not-found-info">
          <span>📍 בר כוכבא 52, פתח תקווה</span>
          <span>📞 03-9315750</span>
        </div>
      </div>
    </div>
  );
}

export default NotFound;