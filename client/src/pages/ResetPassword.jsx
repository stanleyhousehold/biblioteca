import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    try {
      await api.auth.resetPassword({ token, password: form.password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
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
          <span className="auth-logo-icon">🔐</span>
          <h1>Nueva contraseña</h1>
          <p>Elige una contraseña segura</p>
        </div>

        {!token && (
          <div className="alert alert-error">
            Enlace inválido. <Link to="/recuperar-password">Solicita uno nuevo.</Link>
          </div>
        )}

        {done ? (
          <div className="alert alert-success">
            ¡Contraseña restablecida! Redirigiendo al inicio de sesión...
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  autoFocus
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  disabled={!token}
                />
              </div>
              <div className="field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  disabled={!token}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !token}>
                {loading ? 'Guardando...' : 'Restablecer contraseña'}
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
