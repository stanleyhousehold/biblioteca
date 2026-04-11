import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.forgotPassword({ username: identifier });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🔑</span>
          <h1>Recuperar contraseña</h1>
          <p>Introduce tu usuario o email</p>
        </div>

        {sent ? (
          <div>
            <div className="alert alert-success">
              Si el usuario existe y tiene un email configurado, recibirás un enlace de recuperación en breve.
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Si no ves el email, revisa la carpeta de spam. El enlace caduca en 1 hora.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Usuario o email</label>
                <input
                  autoFocus
                  placeholder="Tu nombre de usuario o email"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch" style={{ marginTop: 18 }}>
          <Link to="/login">← Volver al inicio de sesión</Link>
        </p>
      </div>

      <style>{`
        .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,var(--teal-50) 0%,var(--green-50) 100%); padding:24px; }
        .auth-box { width:100%; max-width:380px; padding:36px 32px; }
        .auth-logo { text-align:center; margin-bottom:28px; }
        .auth-logo-icon { font-size:48px; display:block; margin-bottom:8px; }
        .auth-logo h1 { font-size:22px; font-weight:800; color:var(--teal-700); margin-bottom:4px; }
        .auth-logo p { font-size:14px; color:var(--gray-500); }
        .auth-switch { text-align:center; font-size:13px; color:var(--gray-500); }
        .auth-switch a { color:var(--primary); font-weight:700; }
      `}</style>
    </div>
  );
}
