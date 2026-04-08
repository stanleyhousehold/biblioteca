import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    try {
      const { token, user } = await api.auth.register({
        name: form.name,
        username: form.username,
        password: form.password,
      });
      login(token, user);
      navigate('/');
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
          <span className="auth-logo-icon">📚</span>
          <h1>Biblioteca</h1>
          <p>Crea tu cuenta familiar</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Nombre completo</label>
            <input
              id="name"
              type="text"
              placeholder="Tu nombre"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="username">Nombre de usuario</label>
            <input
              id="username"
              type="text"
              placeholder="usuario (sin espacios)"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g,'') }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirmar contraseña</label>
            <input
              id="confirm"
              type="password"
              placeholder="Repite la contraseña"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creando cuenta...</> : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--teal-50) 0%, var(--green-50) 100%);
          padding: 24px;
        }
        .auth-box { width: 100%; max-width: 380px; padding: 36px 32px; }
        .auth-logo { text-align: center; margin-bottom: 28px; }
        .auth-logo-icon { font-size: 48px; display: block; margin-bottom: 8px; }
        .auth-logo h1 { font-size: 26px; font-weight: 800; color: var(--teal-700); margin-bottom: 4px; }
        .auth-logo p { font-size: 14px; color: var(--gray-500); }
        .auth-switch { text-align: center; margin-top: 18px; font-size: 13px; color: var(--gray-500); }
        .auth-switch a { color: var(--primary); font-weight: 700; }
        .auth-switch a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
