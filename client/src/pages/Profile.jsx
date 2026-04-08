import React, { useRef, useState } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setMessage('');
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('photo', file);
      const updatedUser = await api.auth.uploadProfilePhoto(fd);
      updateUser({ photo_url: updatedUser.photo_url });
      setMessage('Foto de perfil actualizada correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      // Reset input so el mismo archivo puede volver a seleccionarse
      e.target.value = '';
    }
  }

  const initials = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <div>
      <div className="page-header">
        <h1>👤 Mi perfil</h1>
      </div>

      <div className="card profile-card">
        {/* Avatar + upload */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-wrap">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="Foto de perfil" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-placeholder">{initials}</div>
            )}
            <button
              className="profile-avatar-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Cambiar foto de perfil"
            >
              {uploading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <IconCamera />}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <p className="profile-avatar-hint">Haz clic en la cámara para cambiar la foto</p>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* User info */}
        <div className="profile-info">
          <div className="profile-info-row">
            <span className="profile-info-label">Nombre</span>
            <span className="profile-info-value">{user?.name}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-info-label">Usuario</span>
            <span className="profile-info-value">@{user?.username}</span>
          </div>
          <div className="profile-info-row">
            <span className="profile-info-label">Miembro desde</span>
            <span className="profile-info-value">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .profile-card { max-width: 480px; }
        .profile-avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--gray-100);
          margin-bottom: 24px;
        }
        .profile-avatar-wrap {
          position: relative;
          width: 96px; height: 96px;
          margin-bottom: 10px;
        }
        .profile-avatar-img {
          width: 96px; height: 96px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--teal-100);
        }
        .profile-avatar-placeholder {
          width: 96px; height: 96px;
          border-radius: 50%;
          background: var(--teal-100);
          color: var(--teal-700);
          display: flex; align-items: center; justify-content: center;
          font-size: 38px; font-weight: 800;
          border: 3px solid var(--teal-200);
        }
        .profile-avatar-btn {
          position: absolute;
          bottom: 0; right: 0;
          width: 30px; height: 30px;
          border-radius: 50%;
          background: var(--teal-600);
          color: white;
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background var(--transition);
        }
        .profile-avatar-btn:hover { background: var(--teal-700); }
        .profile-avatar-btn:disabled { opacity: .6; cursor: not-allowed; }
        .profile-avatar-hint { font-size: 12px; color: var(--gray-400); }
        .profile-info { display: flex; flex-direction: column; gap: 14px; }
        .profile-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--gray-100);
        }
        .profile-info-row:last-child { border-bottom: none; padding-bottom: 0; }
        .profile-info-label { font-size: 13px; font-weight: 600; color: var(--gray-500); }
        .profile-info-value { font-size: 14px; font-weight: 600; color: var(--gray-800); }
      `}</style>
    </div>
  );
}
