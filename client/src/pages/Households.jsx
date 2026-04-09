import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/api';
import { useHousehold } from '../context/HouseholdContext';
import { useAuth } from '../context/AuthContext';

const EMOJI_CATEGORIES = [
  { label: 'Hogares',     emojis: ['🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏰','🏯','🏛️','⛪','🕌','🛖'] },
  { label: 'Naturaleza',  emojis: ['🌲','🌳','🌴','🌊','🏖️','🏕️','⛰️','🏔️','🌻','🌸','🌈','❄️','☀️','🌙'] },
  { label: 'Hogar',       emojis: ['🛋️','🪴','🕯️','🛏️','🚪','🪟'] },
  { label: 'Animales',    emojis: ['🐶','🐱','🐰','🦊','🐻','🐼','🐨'] },
  { label: 'Comida',      emojis: ['🍕','🍔','🌮','🍜','🍣','🎂'] },
  { label: 'Actividades', emojis: ['⚽','🎮','🎨','🎵','🎬','📚','🎭'] },
  { label: 'Otros',       emojis: ['❤️','⭐','🌟','💫','🔑','🏆','🎉'] },
];

function IconX() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconCopy() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 32 }}>{value}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)}>
          {open ? 'Cerrar' : 'Cambiar icono'}
        </button>
      </div>
      {open && (
        <div style={{
          marginTop: 10, padding: 12,
          background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {EMOJI_CATEGORIES.map(cat => (
            <div key={cat.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {cat.emojis.map(e => (
                  <button
                    key={e}
                    type="button"
                    style={{
                      fontSize: 22, padding: '4px 5px', border: '2px solid',
                      borderColor: e === value ? 'var(--teal-500)' : 'transparent',
                      borderRadius: 6, background: e === value ? 'var(--teal-50)' : 'none',
                      cursor: 'pointer', lineHeight: 1,
                    }}
                    onClick={() => { onChange(e); setOpen(false); }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const h = await api.households.create({ name, emoji });
      onCreated(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nuevo hogar</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Icono del hogar</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div className="field">
            <label>Nombre del hogar</label>
            <input autoFocus placeholder="Ej: Casa de los Stanley" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear hogar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonalDetail() {
  const { currentHouseholdId, switchHousehold, personalEmoji, setPersonalEmoji } = useHousehold();
  const isActive = !currentHouseholdId;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{personalEmoji}</span>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Personal</h2>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>Tu espacio personal sin hogar compartido</p>
        </div>
      </div>

      <div className="field">
        <label style={{ fontSize: 13, fontWeight: 700 }}>Icono</label>
        <EmojiPicker value={personalEmoji} onChange={setPersonalEmoji} />
      </div>

      {!isActive && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => switchHousehold(null)}>
          Cambiar a Personal
        </button>
      )}
      {isActive && (
        <p style={{ fontSize: 12, color: 'var(--teal-700)', fontWeight: 600, marginTop: 8 }}>✓ Hogar activo actualmente</p>
      )}
    </div>
  );
}

function HouseholdDetail({ householdId }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('🏠');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.households.get(householdId).then(d => {
      setDetail(d);
      setEditName(d.name);
      setEditEmoji(d.emoji || '🏠');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [householdId]);

  async function generateInvite() {
    try {
      const { invite_url } = await api.households.invite(householdId);
      setInviteUrl(invite_url);
    } catch (err) { alert(err.message); }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function removeMember(memberId) {
    if (!confirm('¿Eliminar este miembro del hogar?')) return;
    try {
      await api.households.removeMember(householdId, memberId);
      setDetail(d => ({ ...d, members: d.members.filter(m => m.id !== memberId) }));
    } catch (err) { alert(err.message); }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.households.update(householdId, { name: editName, emoji: editEmoji });
      setDetail(d => ({ ...d, name: updated.name, emoji: updated.emoji }));
      setEditOpen(false);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>;
  if (!detail) return null;

  const amOwner = detail.members?.find(m => m.id === user?.id)?.role === 'owner';

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{detail.emoji || '🏠'}</span>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>{detail.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {amOwner && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(o => !o)}>
              <IconEdit /> Editar
            </button>
          )}
          <span className="badge">{detail.members?.length} miembro{detail.members?.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {editOpen && amOwner && (
        <form onSubmit={handleSaveEdit} style={{ marginBottom: 20, padding: 14, background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
          <div className="field">
            <label style={{ fontSize: 13 }}>Icono</label>
            <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
          </div>
          <div className="field">
            <label style={{ fontSize: 13 }}>Nombre</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Miembros</h3>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {detail.members?.map(m => (
          <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {m.photo_url
              ? <img src={m.photo_url} alt={m.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-100)', color: 'var(--teal-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{m.name[0]?.toUpperCase()}</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name} <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>@{m.username}</span></div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{m.role === 'owner' ? 'Propietario' : 'Miembro'}</div>
            </div>
            {amOwner && m.id !== user?.id && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => removeMember(m.id)}>Eliminar</button>
            )}
          </li>
        ))}
      </ul>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Invitar miembros</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={generateInvite}>Generar enlace de invitación</button>
        {inviteUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 10px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inviteUrl}</span>
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={copyInvite} title="Copiar"><IconCopy /></button>
            {copied && <span style={{ fontSize: 12, color: 'var(--green-600)', whiteSpace: 'nowrap' }}>¡Copiado!</span>}
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>El enlace caduca en 7 días.</p>
    </div>
  );
}

// ── Join via token ────────────────────────────────────
export function JoinHousehold() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { reloadHouseholds, switchHousehold } = useHousehold();
  const [state, setState] = useState('joining');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.households.join(token)
      .then(res => {
        setMessage(res.message);
        setState('success');
        reloadHouseholds();
        switchHousehold(res.household.id);
      })
      .catch(err => {
        setMessage(err.message);
        setState('error');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-box card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
        {state === 'joining' && <><span className="spinner" /><p style={{ marginTop: 12 }}>Uniéndote al hogar...</p></>}
        {state === 'success' && (
          <>
            <div className="alert alert-success">{message}</div>
            <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate('/')}>Ir al hogar</button>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="alert alert-error">{message}</div>
            <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate('/')}>Volver al inicio</button>
          </>
        )}
      </div>
      <style>{`
        .auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,var(--teal-50) 0%,var(--green-50) 100%); padding:24px; }
        .auth-box { width:100%; max-width:380px; padding:36px 32px; }
      `}</style>
    </div>
  );
}

// ── Main Households Page ──────────────────────────────
export default function Households() {
  const { households, currentHouseholdId, switchHousehold, reloadHouseholds, personalEmoji } = useHousehold();
  const [showCreate, setShowCreate] = useState(false);
  // Default to 'personal' so the Personal panel is shown on first visit
  const [selectedId, setSelectedId] = useState(currentHouseholdId || 'personal');

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este hogar? Se perderán las habitaciones y colecciones asociadas.')) return;
    try {
      await api.households.delete(id);
      if (currentHouseholdId === id) switchHousehold(null);
      reloadHouseholds();
      setSelectedId('personal');
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🏠 Hogares</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Nuevo hogar</button>
      </div>

      <div className="households-layout">
        {/* List */}
        <aside className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Mis hogares</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Personal (always first) */}
            <li
              className={`household-chip${selectedId === 'personal' ? ' active' : ''}`}
              onClick={() => setSelectedId('personal')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{personalEmoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Personal</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Espacio propio</div>
                </div>
              </div>
              {!currentHouseholdId && <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>Activo</span>}
            </li>

            {households.map(h => (
              <li
                key={h.id}
                className={`household-chip${selectedId === h.id ? ' active' : ''}`}
                onClick={() => setSelectedId(h.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{h.emoji || '🏠'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{h.role === 'owner' ? 'Propietario' : 'Miembro'}</div>
                  </div>
                </div>
                {currentHouseholdId === h.id && <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>Activo</span>}
              </li>
            ))}
          </ul>
        </aside>

        {/* Detail */}
        <div>
          {selectedId === 'personal' && <PersonalDetail />}

          {selectedId !== 'personal' && selectedId && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {currentHouseholdId === selectedId ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => switchHousehold(null)}>Desactivar hogar</button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => switchHousehold(selectedId)}>Cambiar a este hogar</button>
                )}
                {households.find(h => h.id === selectedId)?.role === 'owner' && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => handleDelete(selectedId)}>
                    Eliminar hogar
                  </button>
                )}
              </div>
              <HouseholdDetail householdId={selectedId} />
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={h => {
            reloadHouseholds();
            switchHousehold(h.id);
            setSelectedId(h.id);
            setShowCreate(false);
          }}
        />
      )}

      <style>{`
        .households-layout { display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
        .household-chip { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:var(--radius-sm); cursor:pointer; transition:background var(--transition); }
        .household-chip:hover { background:var(--gray-50); }
        .household-chip.active { background:var(--teal-50); color:var(--teal-700); }
        @media(max-width:700px) { .households-layout { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
