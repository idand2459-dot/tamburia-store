import { useState } from 'react';

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (password === 'Anri3233') {
      onLogin();
    } else {
      setError(true);
      setShaking(true);
      setPassword('');
      setTimeout(() => setShaking(false), 500);
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
            onChange={e => { setPassword(e.target.value); setError(false); }}
            className={`admin-login-input ${error ? 'error' : ''}`}
            autoFocus
          />
          {error && <p className="admin-login-error">סיסמה שגויה — נסה שוב</p>}
          <button type="submit" className="admin-login-btn">כניסה →</button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;