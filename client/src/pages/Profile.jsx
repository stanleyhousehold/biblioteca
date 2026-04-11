import React, { useRef, useState } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';

function IconCamera() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { currentHouseholdId, households } = useHousehold();
  const fileRef = useRef(null);

  // Photo upload state
  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [photoError, setPhotoError] = useState('');

  // Profile edit state
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Export/import state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const importFileRef = useRef(null);

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoError(''); setPhotoMsg(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const updated = await api.auth.uploadProfilePhoto(fd);
      updateUser({ photo_url: updated.photo_url });
      setPhotoMsg('Foto actualizada correctamente.');
    } catch (err) { setPhotoError(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError(''); setProfileMsg(''); setSavingProfile(true);
    try {
      const updated = await api.auth.updateProfile(profileForm);
      updateUser({ name: updated.name, email: updated.email });
      setProfileMsg('Perfil actualizado correctamente.');
    } catch (err) { setProfileError(err.message); }
    finally { setSavingProfile(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = currentHouseholdId ? { household_id: currentHouseholdId } : {};
      const data = await api.export.download(params);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stanley-log-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
    finally { setExporting(false); }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg(''); setImportError(''); setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const payload = {
        rooms: data.rooms || [],
        items: data.items || [],
        libraries: data.libraries || [],
        books: data.books || [],
        recipe_collections: data.recipe_collections || [],
        recipes: data.recipes || [],
        household_id: currentHouseholdId || undefined,
      };
      const result = await api.export.import(payload);
      const s = result.stats;
      const parts = [];
      if (s.rooms)             parts.push(`${s.rooms} habitaciones`);
      if (s.items)             parts.push(`${s.items} objetos`);
      if (s.libraries)         parts.push(`${s.libraries} colecciones de libros`);
      if (s.books)             parts.push(`${s.books} libros`);
      if (s.recipe_collections) parts.push(`${s.recipe_collections} colecciones de recetas`);
      if (s.recipes)           parts.push(`${s.recipes} recetas`);
      setImportMsg(`Importación completada: ${parts.join(', ') || 'nada importado'}.`);
    } catch (err) {
      setImportError(err.message || 'Formato de archivo no válido');
    } finally { setImporting(false); e.target.value = ''; }
  }

  const initials = user?.name?.[0]?.toUpperCase() || '?';
  const currentHousehold = households.find(h => h.id === currentHouseholdId);

  return (
    <div>
      <div className="page-header"><h1>👤 Mi perfil</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>

        {/* ── Photo + basic info ── */}
        <div className="card">
          <h2 className="section-title">Foto de perfil</h2>
          <div className="profile-avatar-section">
            <div className="profile-avatar-wrap">
              {user?.photo_url
                ? <img src={user.photo_url} alt="Foto de perfil" className="profile-avatar-img" />
                : <div className="profile-avatar-placeholder">{initials}</div>
              }
              <button className="profile-avatar-btn" onClick={() => fileRef.current?.click()} disabled={uploading} title="Cambiar foto">
                {uploading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <IconCamera />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <div className="profile-user-info">
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)' }}>{user?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>@{user?.username}</div>
            </div>
          </div>
          {photoMsg && <div className="alert alert-success" style={{ marginTop: 8 }}>{photoMsg}</div>}
          {photoError && <div className="alert alert-error" style={{ marginTop: 8 }}>{photoError}</div>}
        </div>

        {/* ── Edit name + email ── */}
        <div className="card">
          <h2 className="section-title">Datos personales</h2>
          {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
          {profileError && <div className="alert alert-error">{profileError}</div>}
          <form onSubmit={handleProfileSave}>
            <div className="field"><label>Nombre</label><input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="field">
              <label>Email <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>(para recuperar contraseña)</span></label>
              <input type="email" placeholder="tu@email.com" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* ── Export / Import ── */}
        <div className="card">
          <h2 className="section-title">Exportar e importar datos</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
            {currentHousehold
              ? <>Datos del hogar <strong>{currentHousehold.name}</strong>.</>
              : <>Datos personales (sin hogar activo).</>
            } Cambia el hogar activo en el sidebar para exportar otro.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exportando...' : '⬇️ Exportar JSON'}
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              {importing ? 'Importando...' : '⬆️ Importar JSON'}
              <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} disabled={importing} />
            </label>
          </div>

          {importMsg && <div className="alert alert-success">{importMsg}</div>}
          {importError && <div className="alert alert-error">{importError}</div>}

          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8 }}>
            La importación crea entradas nuevas sin eliminar las existentes. Las fotos locales no se incluyen en el JSON.
          </p>
        </div>

        {/* ── Account info ── */}
        <div className="card">
          <h2 className="section-title">Información de la cuenta</h2>
          <div className="profile-info">
            {[
              { label: 'Nombre de usuario', value: `@${user?.username}` },
              { label: 'Miembro desde', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
              { label: 'Hogar activo', value: currentHousehold?.name || 'Personal' },
            ].map(row => (
              <div key={row.label} className="profile-info-row">
                <span className="profile-info-label">{row.label}</span>
                <span className="profile-info-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        .section-title { font-size:15px; font-weight:800; color:var(--gray-800); margin-bottom:16px; }
        .profile-avatar-section { display:flex; align-items:center; gap:16px; margin-bottom:12px; }
        .profile-avatar-wrap { position:relative; width:72px; height:72px; flex-shrink:0; }
        .profile-avatar-img { width:72px; height:72px; border-radius:50%; object-fit:cover; border:3px solid var(--teal-100); }
        .profile-avatar-placeholder { width:72px; height:72px; border-radius:50%; background:var(--teal-100); color:var(--teal-700); display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:800; border:3px solid var(--teal-200); }
        .profile-avatar-btn { position:absolute; bottom:0; right:0; width:26px; height:26px; border-radius:50%; background:var(--teal-600); color:white; border:2px solid white; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background var(--transition); }
        .profile-avatar-btn:hover { background:var(--teal-700); }
        .profile-user-info { flex:1; }
        .profile-info { display:flex; flex-direction:column; gap:0; }
        .profile-info-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--gray-100); }
        .profile-info-row:last-child { border-bottom:none; }
        .profile-info-label { font-size:13px; font-weight:600; color:var(--gray-500); }
        .profile-info-value { font-size:13px; font-weight:600; color:var(--gray-800); }
      `}</style>
    </div>
  );
}
