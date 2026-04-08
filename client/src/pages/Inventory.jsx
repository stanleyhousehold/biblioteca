import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/api';

// ── Icons ─────────────────────────────────────────────
function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

// ── Room Modal ────────────────────────────────────────
function RoomModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const room = await api.inventory.createRoom({ name });
      onSave(room);
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
          <h2>Nueva habitación</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre de la habitación</label>
            <input
              autoFocus
              placeholder="Ej: Salón, Cocina, Garaje..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear habitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Item Modal ────────────────────────────────────────
function ItemModal({ item, rooms, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    room_id: item?.room_id || '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(item?.photo_url || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      if (form.description) fd.append('description', form.description);
      if (form.room_id) fd.append('room_id', form.room_id);
      if (photoFile) fd.append('photo', photoFile);

      const saved = item
        ? await api.inventory.updateItem(item.id, fd)
        : await api.inventory.createItem(fd);
      onSave(saved);
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
          <h2>{item ? 'Editar objeto' : 'Añadir objeto'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre *</label>
            <input
              autoFocus
              placeholder="Nombre del objeto"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              placeholder="Descripción opcional..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Habitación</label>
            <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
              <option value="">Sin habitación</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Foto (opcional)</label>
            <div className="photo-upload">
              {photoPreview && (
                <img src={photoPreview} alt="preview" className="photo-preview" />
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                {photoPreview ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : item ? 'Guardar cambios' : 'Añadir objeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm delete ─────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirmar</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 0 }}>{message}</p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Inventory Page ───────────────────────────────
export default function Inventory() {
  const [rooms, setRooms] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // {type, id, name}
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsData, itemsData] = await Promise.all([
        api.inventory.getRooms(),
        api.inventory.getItems({ search, room_id: filterRoom }),
      ]);
      setRooms(roomsData);
      setItems(itemsData);
    } finally {
      setLoading(false);
    }
  }, [search, filterRoom]);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(debouncedSearch), 350);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  async function handleDeleteRoom(id) {
    await api.inventory.deleteRoom(id);
    loadData();
  }
  async function handleDeleteItem(id) {
    await api.inventory.deleteItem(id);
    loadData();
  }

  const filteredItems = items; // already filtered by API

  return (
    <div>
      <div className="page-header">
        <h1>📦 Inventario</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRoomModal(true)}>
            <IconPlus /> Nueva habitación
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowItemModal(true); }}>
            <IconPlus /> Añadir objeto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="inv-filters card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div className="search-bar">
          <IconSearch />
          <input
            placeholder="Buscar objetos por nombre o descripción..."
            value={debouncedSearch}
            onChange={e => setDebouncedSearch(e.target.value)}
          />
          {debouncedSearch && (
            <button className="btn btn-ghost btn-icon" style={{ padding: 2 }} onClick={() => setDebouncedSearch('')}>
              <IconX />
            </button>
          )}
        </div>
        <select
          className="room-filter"
          value={filterRoom}
          onChange={e => setFilterRoom(e.target.value)}
        >
          <option value="">Todas las habitaciones</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Rooms sidebar section */}
      <div className="inv-layout">
        <aside className="rooms-panel card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-700)' }}>Habitaciones</h3>
          </div>
          {rooms.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Sin habitaciones</p>
          ) : (
            <ul className="rooms-list">
              {rooms.map(r => (
                <li
                  key={r.id}
                  className={`room-chip${filterRoom == r.id ? ' active' : ''}`}
                  onClick={() => setFilterRoom(v => v == r.id ? '' : r.id)}
                >
                  <span>{r.name}</span>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ padding: 2, opacity: .5 }}
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'room', id: r.id, name: r.name }); }}
                    title="Eliminar habitación"
                  >
                    <IconTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Items grid */}
        <section className="items-section">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <p>No hay objetos</p>
              <span>{search ? 'Prueba otra búsqueda' : 'Añade tu primer objeto'}</span>
            </div>
          ) : (
            <div className="items-grid">
              {filteredItems.map(item => (
                <div key={item.id} className="item-card card">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} className="item-photo" />
                  ) : (
                    <div className="item-photo-placeholder">📦</div>
                  )}
                  <div className="item-body">
                    <div className="item-name">{item.name}</div>
                    {item.room_name && <span className="badge">{item.room_name}</span>}
                    {item.description && <p className="item-desc">{item.description}</p>}
                    <div className="item-meta">
                      Añadido por {item.created_by_name}
                      {item.updated_by_name && ` · Editado por ${item.updated_by_name}`}
                    </div>
                    <div className="item-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditItem(item); setShowItemModal(true); }}
                      >
                        <IconEdit /> Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red-500)' }}
                        onClick={() => setConfirmDelete({ type: 'item', id: item.id, name: item.name })}
                      >
                        <IconTrash /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {showRoomModal && (
        <RoomModal
          onClose={() => setShowRoomModal(false)}
          onSave={() => { setShowRoomModal(false); loadData(); }}
        />
      )}
      {showItemModal && (
        <ItemModal
          item={editItem}
          rooms={rooms}
          onClose={() => { setShowItemModal(false); setEditItem(null); }}
          onSave={() => { setShowItemModal(false); setEditItem(null); loadData(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (confirmDelete.type === 'room') await handleDeleteRoom(confirmDelete.id);
            else await handleDeleteItem(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}

      <style>{`
        .inv-filters {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .inv-filters .search-bar { flex: 1; max-width: none; }
        .room-filter {
          padding: 9px 12px;
          border: 1.5px solid var(--gray-200);
          border-radius: var(--radius-sm);
          font-size: 14px;
          background: white;
          color: var(--gray-700);
          cursor: pointer;
        }
        .inv-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: start;
        }
        .rooms-panel { padding: 16px; }
        .rooms-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
        .room-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: var(--gray-700);
          transition: background var(--transition);
        }
        .room-chip:hover { background: var(--gray-50); }
        .room-chip.active { background: var(--teal-50); color: var(--teal-700); }
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }
        .item-card { padding: 0; overflow: hidden; }
        .item-photo { width: 100%; height: 140px; object-fit: cover; display: block; }
        .item-photo-placeholder {
          height: 100px;
          display: flex; align-items: center; justify-content: center;
          font-size: 36px;
          background: var(--gray-50);
        }
        .item-body { padding: 12px; }
        .item-name { font-size: 15px; font-weight: 700; margin-bottom: 6px; color: var(--gray-800); }
        .item-desc { font-size: 13px; color: var(--gray-500); margin: 6px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .item-meta { font-size: 11px; color: var(--gray-400); margin-top: 8px; }
        .item-actions { display: flex; gap: 6px; margin-top: 10px; }
        .photo-upload { display: flex; align-items: center; gap: 12px; }
        .photo-preview { width: 64px; height: 64px; border-radius: var(--radius-sm); object-fit: cover; }

        @media (max-width: 700px) {
          .inv-layout { grid-template-columns: 1fr; }
          .rooms-panel { display: none; }
        }
      `}</style>
    </div>
  );
}
