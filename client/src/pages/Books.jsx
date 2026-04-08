import React, { useEffect, useState, useCallback, useRef } from 'react';
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
function IconBarcode() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9H2V5.5A2.5 2.5 0 0 1 4.5 3H8"/><path d="M16 3h3.5A2.5 2.5 0 0 1 22 5.5V9h-1"/><path d="M3 15H2v3.5A2.5 2.5 0 0 0 4.5 21H8"/><path d="M16 21h3.5a2.5 2.5 0 0 0 2.5-2.5V15h-1"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="14" y1="8" x2="14" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="8" y1="8" x2="8" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>;
}

// ── Library Modal ─────────────────────────────────────
function LibraryModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const lib = await api.books.createLibrary({ name });
      onSave(lib);
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
          <h2>Nueva biblioteca</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input
              autoFocus
              placeholder="Ej: Salón, Habitación, Kindle..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear biblioteca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Book Modal (add / edit) ───────────────────────────
function BookModal({ book, libraries, onClose, onSave }) {
  const EMPTY = {
    isbn: '', title: '', author: '', year: '', cover_url: '', library_id: '',
  };
  const [form, setForm] = useState(book ? {
    isbn: book.isbn || '',
    title: book.title || '',
    author: book.author || '',
    year: book.year || '',
    cover_url: book.cover_url || '',
    library_id: book.library_id || '',
  } : EMPTY);
  const [isbnInput, setIsbnInput] = useState(book?.isbn || '');
  const [fetchingIsbn, setFetchingIsbn] = useState(false);
  const [isbnMsg, setIsbnMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isbnRef = useRef(null);

  // ISBN scanner: detect rapid keyboard input followed by Enter
  // When the input receives an Enter key and has 10 or 13 digits, trigger lookup
  async function handleIsbnKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = isbnInput.replace(/[^0-9X]/gi, '');
      if (clean.length === 10 || clean.length === 13) {
        await lookupIsbn(clean);
      }
    }
  }

  async function lookupIsbn(isbn) {
    setFetchingIsbn(true);
    setIsbnMsg('');
    try {
      const data = await api.books.lookupIsbn(isbn);
      setForm(f => ({
        ...f,
        isbn: data.isbn,
        title: data.title || f.title,
        author: data.author || f.author,
        year: data.year || f.year,
        cover_url: data.cover_url || f.cover_url,
      }));
      setIsbnInput(data.isbn);
      setIsbnMsg('✓ Datos cargados de Open Library');
    } catch {
      setIsbnMsg('No se encontró el ISBN en Open Library. Rellena los datos manualmente.');
    } finally {
      setFetchingIsbn(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, isbn: isbnInput || form.isbn };
      const saved = book
        ? await api.books.updateBook(book.id, payload)
        : await api.books.createBook(payload);
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{book ? 'Editar libro' : 'Añadir libro'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* ISBN + scanner */}
          <div className="isbn-row">
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>
                <IconBarcode style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                ISBN (escanea o escribe y pulsa Enter)
              </label>
              <input
                ref={isbnRef}
                placeholder="Escanea con el lector o escribe el ISBN..."
                value={isbnInput}
                onChange={e => setIsbnInput(e.target.value)}
                onKeyDown={handleIsbnKeyDown}
                autoFocus={!book}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary isbn-lookup-btn"
              onClick={() => lookupIsbn(isbnInput.replace(/[^0-9X]/gi, ''))}
              disabled={fetchingIsbn || isbnInput.replace(/[^0-9X]/gi,'').length < 10}
              title="Buscar en Open Library"
            >
              {fetchingIsbn ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🔍'}
            </button>
          </div>
          {isbnMsg && (
            <p style={{ fontSize: 12, color: isbnMsg.startsWith('✓') ? 'var(--green-700)' : 'var(--amber-600)', marginBottom: 12, marginTop: 4 }}>
              {isbnMsg}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
            <div className="field">
              <label>Título *</label>
              <input
                placeholder="Título del libro"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Autor</label>
              <input
                placeholder="Nombre del autor"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Año</label>
                <input
                  placeholder="Ej: 2023"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Biblioteca</label>
                <select
                  value={form.library_id}
                  onChange={e => setForm(f => ({ ...f, library_id: e.target.value }))}
                >
                  <option value="">Sin biblioteca</option>
                  {libraries.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>URL de portada</label>
              <input
                placeholder="https://... (se rellena automáticamente con ISBN)"
                value={form.cover_url}
                onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))}
              />
            </div>
            {form.cover_url && (
              <div style={{ marginBottom: 14 }}>
                <img src={form.cover_url} alt="portada" style={{ height: 80, borderRadius: 6, objectFit: 'cover' }} />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : book ? 'Guardar cambios' : 'Añadir libro'}
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
        <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{message}</p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Books Page ───────────────────────────────────
export default function Books() {
  const [libraries, setLibraries] = useState([]);
  const [books, setBooks] = useState([]);
  const [filterLibrary, setFilterLibrary] = useState('');
  const [showLibModal, setShowLibModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(debouncedSearch), 350);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [libsData, booksData] = await Promise.all([
        api.books.getLibraries(),
        api.books.getBooks({ search, library_id: filterLibrary }),
      ]);
      setLibraries(libsData);
      setBooks(booksData);
    } finally {
      setLoading(false);
    }
  }, [search, filterLibrary]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDeleteLib(id) {
    await api.books.deleteLibrary(id);
    loadData();
  }
  async function handleDeleteBook(id) {
    await api.books.deleteBook(id);
    loadData();
  }

  return (
    <div>
      <div className="page-header">
        <h1>📚 Biblioteca</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowLibModal(true)}>
            <IconPlus /> Nueva biblioteca
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditBook(null); setShowBookModal(true); }}>
            <IconPlus /> Añadir libro
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="books-filters card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div className="search-bar">
          <IconSearch />
          <input
            placeholder="Buscar por título o autor..."
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
          className="lib-filter"
          value={filterLibrary}
          onChange={e => setFilterLibrary(e.target.value)}
        >
          <option value="">Todas las bibliotecas</option>
          {libraries.map(l => <option key={l.id} value={l.id}>{l.name} ({l.book_count})</option>)}
        </select>
      </div>

      <div className="books-layout">
        {/* Libraries panel */}
        <aside className="libs-panel card">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-700)', marginBottom: 12 }}>Colecciones</h3>
          {libraries.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Sin colecciones</p>
          ) : (
            <ul className="libs-list">
              {libraries.map(l => (
                <li
                  key={l.id}
                  className={`lib-chip${filterLibrary == l.id ? ' active' : ''}`}
                  onClick={() => setFilterLibrary(v => v == l.id ? '' : l.id)}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{l.book_count} libros</div>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ padding: 2, opacity: .5 }}
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'lib', id: l.id, name: l.name }); }}
                  >
                    <IconTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Books grid */}
        <section className="books-section">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : books.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <p>No hay libros</p>
              <span>{search ? 'Prueba otra búsqueda' : 'Añade tu primer libro o escanea un ISBN'}</span>
            </div>
          ) : (
            <div className="books-grid">
              {books.map(book => (
                <div key={book.id} className="book-card card">
                  <div className="book-cover-wrap">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="book-cover" />
                    ) : (
                      <div className="book-cover-placeholder">📖</div>
                    )}
                  </div>
                  <div className="book-body">
                    <div className="book-title" title={book.title}>{book.title}</div>
                    {book.author && <div className="book-author">{book.author}</div>}
                    <div className="book-meta-row">
                      {book.year && <span className="badge" style={{ background: 'var(--yellow-100)', color: 'var(--amber-600)' }}>{book.year}</span>}
                      {book.library_name && <span className="badge">{book.library_name}</span>}
                    </div>
                    {book.isbn && <div className="book-isbn">ISBN: {book.isbn}</div>}
                    <div className="book-meta">Añadido por {book.created_by_name}</div>
                    <div className="book-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditBook(book); setShowBookModal(true); }}
                      >
                        <IconEdit /> Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red-500)' }}
                        onClick={() => setConfirmDelete({ type: 'book', id: book.id, name: book.title })}
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
      {showLibModal && (
        <LibraryModal
          onClose={() => setShowLibModal(false)}
          onSave={() => { setShowLibModal(false); loadData(); }}
        />
      )}
      {showBookModal && (
        <BookModal
          book={editBook}
          libraries={libraries}
          onClose={() => { setShowBookModal(false); setEditBook(null); }}
          onSave={() => { setShowBookModal(false); setEditBook(null); loadData(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (confirmDelete.type === 'lib') await handleDeleteLib(confirmDelete.id);
            else await handleDeleteBook(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}

      <style>{`
        .books-filters {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .books-filters .search-bar { flex: 1; max-width: none; }
        .lib-filter {
          padding: 9px 12px;
          border: 1.5px solid var(--gray-200);
          border-radius: var(--radius-sm);
          font-size: 14px;
          background: white;
          color: var(--gray-700);
          cursor: pointer;
        }
        .books-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: start;
        }
        .libs-panel { padding: 16px; }
        .libs-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
        .lib-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          cursor: pointer;
          color: var(--gray-700);
          transition: background var(--transition);
        }
        .lib-chip:hover { background: var(--gray-50); }
        .lib-chip.active { background: var(--amber-50); color: var(--amber-700); }

        .books-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }
        .book-card { padding: 0; overflow: hidden; }
        .book-cover-wrap { background: var(--gray-100); }
        .book-cover { width: 100%; height: 180px; object-fit: cover; display: block; }
        .book-cover-placeholder {
          height: 120px;
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          background: linear-gradient(135deg, var(--amber-50) 0%, var(--yellow-100) 100%);
        }
        .book-body { padding: 12px; }
        .book-title {
          font-size: 14px; font-weight: 700; color: var(--gray-800);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; margin-bottom: 4px; line-height: 1.3;
        }
        .book-author { font-size: 12px; color: var(--gray-500); margin-bottom: 6px; }
        .book-meta-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
        .book-isbn { font-size: 11px; color: var(--gray-400); font-family: monospace; margin-bottom: 4px; }
        .book-meta { font-size: 11px; color: var(--gray-400); }
        .book-actions { display: flex; gap: 4px; margin-top: 8px; }

        .isbn-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 14px; }
        .isbn-lookup-btn { height: 38px; padding: 0 12px; flex-shrink: 0; align-self: flex-end; }

        @media (max-width: 700px) {
          .books-layout { grid-template-columns: 1fr; }
          .libs-panel { display: none; }
          .books-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        }
      `}</style>
    </div>
  );
}
