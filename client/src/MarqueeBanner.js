function MarqueeBanner() {
  const items = [
    '🔧 טכניק טמבור',
    '📍 בר כוכבא 52, פתח תקווה',
    '📞 03-9315750',
    '📱 050-6735040',
    '🕐 א׳-ה׳: 7:00-20:00',
    '🕐 ו׳: 7:00-15:00',
    '⭐ נוסדה 1991',
    '🤝 יחס אישי ואדיב',
    '💰 מחירים טובים',
    '🔧 עזרה טכנית מקצועית',
  ];

  // כפל הפריטים כדי שהאנימציה תיראה רציפה
  const doubled = [...items, ...items];

  return (
    <div className="marquee-banner">
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <span key={i} className="marquee-item">
            {item}
            <span className="marquee-sep">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default MarqueeBanner;