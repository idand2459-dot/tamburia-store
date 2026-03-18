function Footer({ onNavigate }) {
  const categories = [
    { id: 'painting', label: 'מוצרי צביעה' },
    { id: 'tools', label: 'כלי עבודה' },
    { id: 'plumbing', label: 'אינסטלציה' },
    { id: 'faucets', label: 'ברזים' },
    { id: 'locks', label: 'צילינדרים ומנעולים' },
    { id: 'adhesives', label: 'דבקים' },
    { id: 'cleaning', label: 'ניקיון' },
    { id: 'garden', label: 'גינה' },
    { id: 'bathroom', label: 'מוצרי אמבטיה' },
    { id: 'kitchen', label: 'מוצרי מטבח' },
  ];

  const pages = [
    { key: 'home', label: 'דף הבית' },
    { key: 'about', label: 'אודות' },
    { key: 'contact', label: 'צור קשר' },
    { key: 'returns', label: 'מדיניות החזרים' },
  ];

  return (
    <footer className="site-footer">
      <div className="footer-main">

        {/* עמוד 1 — אודות */}
        <div className="footer-col">
          <h3 className="footer-logo">🔧 טכניק טמבור</h3>
          <p className="footer-about-text">
            חנות מקצועית לכלי עבודה, חומרי בניין וצבעים בפתח תקווה.<br />
            מאז 1991 — יחס אישי, עזרה טכנית ומחירים טובים.
          </p>
          <a
            href="https://wa.me/972506735040?text=שלום, אני מעוניין במוצר מהאתר שלכם"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-whatsapp-btn"
          >
            <span>💬</span> שלח הודעה בוואטסאפ
          </a>
        </div>

        {/* עמוד 2 — מפת האתר */}
        <div className="footer-col">
          <h4 className="footer-col-title">מפת האתר</h4>
          <ul className="footer-links">
            {pages.map(p => (
              <li key={p.key}>
                <button onClick={() => onNavigate(p.key)} className="footer-link">
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* עמוד 3 — קטגוריות */}
        <div className="footer-col">
          <h4 className="footer-col-title">קטגוריות</h4>
          <ul className="footer-links footer-links-2col">
            {categories.map(cat => (
              <li key={cat.id}>
                <button onClick={() => onNavigate('home')} className="footer-link">
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* עמוד 4 — צור קשר */}
        <div className="footer-col">
          <h4 className="footer-col-title">צור קשר</h4>
          <ul className="footer-contact-list">
            <li>
              <span className="footer-contact-icon">📍</span>
              <span>בר כוכבא 52, פתח תקווה</span>
            </li>
            <li>
              <span className="footer-contact-icon">📞</span>
              <a href="tel:039315750" className="footer-contact-link">03-9315750</a>
            </li>
            <li>
              <span className="footer-contact-icon">📱</span>
              <a href="tel:0506735040" className="footer-contact-link">050-6735040</a>
            </li>
            <li>
              <span className="footer-contact-icon">🕐</span>
              <span>א׳-ה׳: 7:00–20:00</span>
            </li>
            <li>
              <span className="footer-contact-icon">🕐</span>
              <span>ו׳: 7:00–15:00</span>
            </li>
          </ul>
        </div>

      </div>

      {/* תחתית */}
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} טכניק טמבור — כל הזכויות שמורות</span>
        <span className="footer-bottom-sep">|</span>
        <button onClick={() => onNavigate('returns')} className="footer-bottom-link">מדיניות החזרים</button>
      </div>
    </footer>
  );
}

export default Footer;