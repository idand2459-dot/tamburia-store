/**
 * שומר הסף של אזור הניהול: /admin/:tab
 *
 * הלשוניות הן נתיבים ולא query params, כדי שלכל לשונית תהיה כתובת
 * אמיתית — אפשר לשלוח קישור ל-/admin/orders, וכפתור "חזור" בדפדפן
 * עובר בין לשוניות כמו שמשתמש מצפה.
 *
 * ההגנה: קודם נשאלת /api/auth/me, ורק אם היא מאשרת מורכב Admin.
 * מי שאינו מחובר מקבל את מסך ההתחברות, ולא משנה לאיזו לשונית הוא
 * כיוון — הרכיב שמביא נתונים לא עולה בכלל, ולכן אין בקשה שיכולה
 * להחזיר משהו. בנוסף כל נתיבי הניהול ב-API מוגנים בשרת ב-requireAdmin,
 * כך שגם אם המסך היה נחשף, הנתונים לא.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import Admin from '../pages/admin/Admin';
import AdminLogin from '../pages/AdminLogin';
import { ADMIN_TAB_IDS } from '../pages/admin/adminConstants';
import { isLoggedIn, logout } from '../services/authService';

/** מציג את אזור הניהול למי שמחובר, ומסך התחברות לכל השאר. */
function AdminRoute() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const [auth, setAuth] = useState('checking'); // checking | out | in

  useEffect(() => {
    let cancelled = false;
    isLoggedIn().then((ok) => { if (!cancelled) setAuth(ok ? 'in' : 'out'); });
    return () => { cancelled = true; };
  }, []);

  /** מנתק ומחזיר לחנות. */
  async function handleLogout() {
    await logout();
    setAuth('out');
    navigate('/');
  }

  /* ברירת המחדל היא הזמנות ולא סטטיסטיקות: זה מה שפותחים את המסך
     בשבילו, וסיכום המספרים הוא מה שמסתכלים עליו פעם ביום. */
  if (!ADMIN_TAB_IDS.includes(tab)) return <Navigate to="/admin/orders" replace />;

  // בזמן הבדיקה לא מציגים כלום — לא את המסך ולא את הטופס — כדי
  // שלא תהבהב התחברות למי שכבר מחובר.
  if (auth === 'checking') return <div className="admin-login-page" />;

  if (auth === 'out') return <AdminLogin onLogin={() => setAuth('in')} />;

  return (
    <Admin
      tab={tab}
      onTabChange={(next, search = '') => navigate(`/admin/${next}${search}`)}
      onBack={handleLogout}
      onExpired={() => setAuth('out')}
    />
  );
}

export default AdminRoute;
