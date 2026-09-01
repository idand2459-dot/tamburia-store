const config = require('../config/env');

/**
 * מדיניות תוכן (CSP).
 *
 * 'unsafe-inline' ב-style-src נדרש: React מזריק סגנונות inline,
 * ובלעדיו העיצוב נשבר. ב-script-src הוא לא נדרש, ולכן לא ניתן.
 *
 * data: ו-blob: ב-img-src נדרשים לתמונות ממוזערות ולתצוגה מקדימה
 * של קבצים שהמשתמש בוחר לפני ההעלאה.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

/**
 * כותרות אבטחה בסיסיות לכל תשובה.
 *
 * CSP אינו דלוק כברירת מחדל: ב-index.html שנבנה יש תגית
 * <script type="application/ld+json"> לנתונים מובנים, ודפדפנים
 * חוסמים אותה תחת script-src 'self'. זה עולה רק בנתוני SEO
 * ולא בתפקוד, אבל זה שינוי שכדאי לראות בדפדפן לפני שמדליקים —
 * הדלקה: CSP_ENABLED=true.
 */
function securityHeaders(req, res, next) {
  // הדפדפן לא ינחש סוג תוכן — חוסם קובץ שהועלה מלהתפרש כ-HTML
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // הגנת clickjacking. frame-ancestors ב-CSP מחליף את זה בדפדפנים חדשים,
  // והכותרת נשארת בשביל הישנים
  res.setHeader('X-Frame-Options', 'DENY');

  // לא מדליפים את כתובת העמוד לאתרים חיצוניים
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // אין שימוש בהרשאות האלה באתר
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  if (config.security.cspEnabled) {
    res.setHeader('Content-Security-Policy', CSP);
  }

  // HSTS רק כשבאמת מגישים ב-HTTPS — בלוקאלהוסט הוא היה נועל את הדפדפן
  if (config.isProduction && config.security.hsts) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

module.exports = { securityHeaders, CSP };
