/**
 * מוסיף כותרות אבטחה לכל תשובה: הגנה מפני ניחוש סוג תוכן,
 * הטמעה במסגרת, דליפת מפנה, והרשאות דפדפן שאינן בשימוש.
 *
 * CSP כבוי כברירת מחדל. index.html שנבנה מכיל תגית
 * <script type="application/ld+json"> לנתונים מובנים, ודפדפנים
 * חוסמים אותה תחת script-src 'self'. זה פוגע בנתוני SEO ולא
 * בתפקוד, אבל כדאי לראות את זה בדפדפן לפני שמדליקים: CSP_ENABLED=true.
 */
const config = require('../config/env');

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

/** מצרף את כותרות האבטחה לתשובה וממשיך לטיפול הבא. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  if (config.security.cspEnabled) {
    res.setHeader('Content-Security-Policy', CSP);
  }

  if (config.isProduction && config.security.hsts) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

module.exports = { securityHeaders, CSP };
