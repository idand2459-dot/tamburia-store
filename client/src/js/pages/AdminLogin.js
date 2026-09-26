/**
 * מסך הכניסה לניהול. הסיסמה נבדקת בשרת ולא בקליינט.
 */
import { useState } from 'react';

/** מציג את טופס הכניסה ושולח את הסיסמה לשרת. */
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** מציג הודעת שגיאה ומנקה את שדה הסיסמה. */
  function fail(message) {
    setError(message);
    setShaking(true);
    setPassword('');
    setTimeout(() => setShaking(false), 500);
  }

  /** שולח את הטופס לשרת. */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!password || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        onLogin();
        return;
      }

      const body = await res.json().catch(() => ({}));
      fail(body.error || 'סיסמה שגויה — נסה שוב');
    } catch {
      fail('אין חיבור לשרת — נסה שוב');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className={`admin-login-box ${shaking ? 'shake' : ''}`}>
        <div className="admin-login-icon">🔐</div>
        <h1 className="admin-login-title">כניסה לניהול</h1>
        <p className="admin-login-sub">טכניק טמבור</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            className={`admin-login-input ${error ? 'error' : ''}`}
            disabled={submitting}
            autoFocus
          />
          {error && <p className="admin-login-error">{error}</p>}
          <button type="submit" className="admin-login-btn" disabled={submitting}>
            {submitting ? 'בודק…' : 'כניסה →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
