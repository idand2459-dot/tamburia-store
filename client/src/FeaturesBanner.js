function FeaturesBanner() {
  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2"/>
          <path d="M16 8h4l3 5v3h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
      title: 'משלוח לאזור המרכז',
      text: 'משלוחים לפתח תקווה, גני תקווה וקריית אונו — עד 2 ימי עסקים'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      title: '30+ שנות ניסיון',
      text: 'מאז 1991 — מומחיות, ידע מקצועי ואמינות שאפשר לסמוך עליהם'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
      title: 'איסוף עצמי',
      text: 'בר כוכבא 52, פתח תקווה • א׳-ה׳ 7:00-20:00 • ו׳ 7:00-15:00'
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
      title: 'ייעוץ טכני מקצועי',
      text: 'יחס אישי ואדיב — נשמח לעזור בכל שאלה טכנית'
    },
  ];

  return (
    <div className="features-banner">
      {features.map((f, i) => (
        <div key={i} className="feature-item">
          <div className="feature-icon">{f.icon}</div>
          <div className="feature-text">
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FeaturesBanner;