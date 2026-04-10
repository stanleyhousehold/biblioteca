import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/api';
import { useHousehold } from '../context/HouseholdContext';

function IconPlus()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>; }
function IconSearch(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

function diffStyle(d) {
  if (d === 'Fácil')  return { background: 'var(--green-50)',  color: 'var(--green-700)' };
  if (d === 'Media')  return { background: 'var(--amber-50)',  color: 'var(--amber-700)' };
  if (d === 'Difícil') return { background: 'var(--red-50)',   color: 'var(--red-600)'   };
  return {};
}

// ── Confirm ──────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Confirmar</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button></div>
        <p style={{ fontSize: 14, color: 'var(--gray-600)' }}>{message}</p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Collection modal ─────────────────────────────────────
function CollectionModal({ collection, householdId, onClose, onSave }) {
  const [name, setName] = useState(collection?.name || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = collection
        ? await api.recipes.updateCollection(collection.id, { name })
        : await api.recipes.createCollection({ name, household_id: householdId || undefined });
      onSave(saved);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{collection ? 'Renombrar colección' : 'Nueva colección'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input autoFocus placeholder="Ej: Postres, Arroces, Navidad…" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando…' : collection ? 'Guardar' : 'Crear colección'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Recipe modal (add / edit) ────────────────────────────
function RecipeModal({ recipe, collections, householdId, onClose, onSave }) {
  const EMPTY = { name: '', description: '', collection_id: '', prep_time: '', cook_time: '', servings: '', difficulty: '' };
  const [form, setForm] = useState(recipe ? {
    name: recipe.name || '', description: recipe.description || '',
    collection_id: recipe.collection_id || '', prep_time: recipe.prep_time || '',
    cook_time: recipe.cook_time || '', servings: recipe.servings || '', difficulty: recipe.difficulty || '',
  } : EMPTY);
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.length ? recipe.ingredients : ['']
  );
  const [steps, setSteps] = useState(
    recipe?.steps?.length ? recipe.steps : ['']
  );
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(recipe?.photo_url || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const addIng = () => setIngredients(p => [...p, '']);
  const removeIng = i => setIngredients(p => p.filter((_, idx) => idx !== i));
  const updateIng = (i, v) => setIngredients(p => p.map((x, idx) => idx === i ? v : x));

  const addStep = () => setSteps(p => [...p, '']);
  const removeStep = i => setSteps(p => p.filter((_, idx) => idx !== i));
  const updateStep = (i, v) => setSteps(p => p.map((x, idx) => idx === i ? v : x));

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      if (form.description)   fd.append('description', form.description);
      if (form.collection_id) fd.append('collection_id', form.collection_id);
      if (householdId)        fd.append('household_id', householdId);
      if (form.prep_time)     fd.append('prep_time', form.prep_time);
      if (form.cook_time)     fd.append('cook_time', form.cook_time);
      if (form.servings)      fd.append('servings', form.servings);
      if (form.difficulty)    fd.append('difficulty', form.difficulty);
      fd.append('ingredients', JSON.stringify(ingredients.filter(i => i.trim())));
      fd.append('steps', JSON.stringify(steps.filter(s => s.trim())));
      if (photoFile) fd.append('photo', photoFile);

      const saved = recipe
        ? await api.recipes.updateRecipe(recipe.id, fd)
        : await api.recipes.createRecipe(fd);
      onSave(saved);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recipe-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{recipe ? 'Editar receta' : 'Nueva receta'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 110px)', paddingRight: 4 }}>
          <div className="field">
            <label>Nombre *</label>
            <input autoFocus placeholder="Nombre de la receta" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          <div className="field">
            <label>Descripción</label>
            <textarea placeholder="Breve descripción…" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} style={{ resize: 'vertical', minHeight: 56 }} />
          </div>

          {/* Photo */}
          <div className="field">
            <label>Foto</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {photoPreview && (
                <img src={photoPreview} alt="preview"
                  style={{ height: 64, width: 88, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--gray-200)' }} />
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                {photoFile ? 'Cambiar foto' : photoPreview ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Prep. (min)</label>
              <input type="number" min={0} placeholder="15" value={form.prep_time}
                onChange={e => setForm(f => ({ ...f, prep_time: e.target.value }))} />
            </div>
            <div className="field">
              <label>Cocción (min)</label>
              <input type="number" min={0} placeholder="30" value={form.cook_time}
                onChange={e => setForm(f => ({ ...f, cook_time: e.target.value }))} />
            </div>
            <div className="field">
              <label>Comensales</label>
              <input type="number" min={1} placeholder="4" value={form.servings}
                onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
            </div>
            <div className="field">
              <label>Dificultad</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                <option value="">—</option>
                <option value="Fácil">Fácil</option>
                <option value="Media">Media</option>
                <option value="Difícil">Difícil</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Colección</label>
            <select value={form.collection_id} onChange={e => setForm(f => ({ ...f, collection_id: e.target.value }))}>
              <option value="">Sin colección</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Ingredients */}
          <div className="field">
            <label>Ingredientes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input placeholder={`Ingrediente ${i + 1}`} value={ing}
                    onChange={e => updateIng(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIng(); } }}
                    style={{ flex: 1 }} />
                  {ingredients.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeIng(i)}><IconX /></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addIng} style={{ alignSelf: 'flex-start' }}>
                + Añadir ingrediente
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="field">
            <label>Pasos</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--teal-600)', minWidth: 20, paddingTop: 9 }}>{i + 1}.</span>
                  <textarea placeholder={`Paso ${i + 1}…`} value={step} onChange={e => updateStep(i, e.target.value)}
                    rows={2} style={{ flex: 1, resize: 'vertical', minHeight: 52 }} />
                  {steps.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeStep(i)} style={{ marginTop: 4 }}><IconX /></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addStep} style={{ alignSelf: 'flex-start' }}>
                + Añadir paso
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : recipe ? 'Guardar cambios' : 'Crear receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Recipe detail (read-only) ────────────────────────────
function RecipeDetail({ recipe, onClose, onEdit, onDelete }) {
  const total = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const ings  = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(Boolean) : [];
  const stps  = Array.isArray(recipe.steps)       ? recipe.steps.filter(Boolean) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recipe-detail-modal" onClick={e => e.stopPropagation()}>
        {recipe.photo_url && (
          <div style={{ margin: '-24px -28px 20px', borderRadius: '10px 10px 0 0', overflow: 'hidden', height: 220, flexShrink: 0 }}>
            <img src={recipe.photo_url} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <div className="modal-header">
          <h2 style={{ fontSize: 19 }}>{recipe.name}</h2>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={onEdit}><IconEdit /> Editar</button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {recipe.difficulty && <span className="badge" style={diffStyle(recipe.difficulty)}>{recipe.difficulty}</span>}
            {recipe.prep_time  && <span className="badge">🥄 Prep: {recipe.prep_time} min</span>}
            {recipe.cook_time  && <span className="badge">🔥 Cocción: {recipe.cook_time} min</span>}
            {total > 0         && <span className="badge" style={{ background: 'var(--teal-50)', color: 'var(--teal-700)' }}>⏱ Total: {total} min</span>}
            {recipe.servings   && <span className="badge">👥 {recipe.servings} comensales</span>}
            {recipe.collection_name && <span className="badge">📁 {recipe.collection_name}</span>}
          </div>

          {recipe.description && (
            <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.65 }}>{recipe.description}</p>
          )}

          {ings.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Ingredientes</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ings.map((ing, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--gray-700)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal-400)', flexShrink: 0 }} />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Preparación</h3>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {stps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.65 }}>
                    <span style={{ fontWeight: 800, color: 'var(--teal-600)', fontSize: 15, minWidth: 22, flexShrink: 0 }}>{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Añadida por {recipe.created_by_name}</span>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={onDelete}>
              <IconTrash /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export default function Recipes() {
  const { currentHouseholdId } = useHousehold();
  const [collections, setCollections] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [filterCollection, setFilterCollection] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [search, setSearch] = useState('');
  const [showColModal, setShowColModal] = useState(false);
  const [editCollection, setEditCollection] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);
  const [viewRecipe, setViewRecipe] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(debouncedSearch), 350);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const hParams = currentHouseholdId ? { household_id: currentHouseholdId } : {};
    try {
      const [colsData, recipesData] = await Promise.all([
        api.recipes.getCollections(hParams),
        api.recipes.getRecipes({ ...hParams, search, collection_id: filterCollection }),
      ]);
      setCollections(colsData);
      setRecipes(recipesData);
    } finally { setLoading(false); }
  }, [currentHouseholdId, search, filterCollection]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setFilterDifficulty(''); }, [currentHouseholdId, filterCollection]);

  const availableDifficulties = [...new Set(recipes.map(r => r.difficulty).filter(Boolean))];
  const displayed = filterDifficulty ? recipes.filter(r => r.difficulty === filterDifficulty) : recipes;

  async function handleDeleteCol(id)    { await api.recipes.deleteCollection(id); setFilterCollection(''); loadData(); }
  async function handleDeleteRecipe(id) { await api.recipes.deleteRecipe(id); loadData(); }

  return (
    <div>
      <div className="page-header">
        <h1>🍳 Recetas</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditCollection(null); setShowColModal(true); }}>
            <IconPlus /> Nueva colección
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditRecipe(null); setShowRecipeModal(true); }}>
            <IconPlus /> Añadir receta
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="books-filters card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div className="search-bar">
          <IconSearch />
          <input placeholder="Buscar por nombre o ingrediente…" value={debouncedSearch}
            onChange={e => setDebouncedSearch(e.target.value)} />
          {debouncedSearch && (
            <button className="btn btn-ghost btn-icon" style={{ padding: 2 }} onClick={() => setDebouncedSearch('')}><IconX /></button>
          )}
        </div>
        <select className="lib-filter" value={filterCollection} onChange={e => setFilterCollection(e.target.value)}>
          <option value="">Todas las colecciones</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.recipe_count})</option>)}
        </select>
        {availableDifficulties.length > 1 && (
          <select className="lib-filter" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="">Todas las dificultades</option>
            {availableDifficulties.map(d => <option key={d} value={d} style={diffStyle(d)}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="books-layout">
        {/* Collections sidebar */}
        <aside className="libs-panel card">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-700)', marginBottom: 12 }}>Colecciones</h3>
          {collections.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Sin colecciones</p>
            : (
              <ul className="libs-list">
                {collections.map(c => (
                  <li key={c.id} className={`lib-chip${filterCollection == c.id ? ' active' : ''}`}
                    onClick={() => setFilterCollection(v => v == c.id ? '' : c.id)}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{c.recipe_count} recetas</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon" style={{ padding: 2, opacity: .6 }}
                        onClick={e => { e.stopPropagation(); setEditCollection(c); setShowColModal(true); }} title="Renombrar">
                        <IconEdit />
                      </button>
                      <button className="btn btn-ghost btn-icon" style={{ padding: 2, opacity: .5 }}
                        onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'col', id: c.id, name: c.name }); }} title="Eliminar">
                        <IconTrash />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </aside>

        {/* Recipes grid */}
        <section className="books-section">
          {loading
            ? <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
            : displayed.length === 0
              ? (
                <div className="empty-state">
                  <span style={{ fontSize: 48 }}>🍳</span>
                  <p>No hay recetas</p>
                  <span>
                    {debouncedSearch    ? 'Prueba otra búsqueda'
                    : filterDifficulty ? `Sin recetas de dificultad "${filterDifficulty}"`
                    :                    'Añade tu primera receta'}
                  </span>
                </div>
              )
              : (
                <div className="recipes-grid">
                  {displayed.map(recipe => (
                    <div key={recipe.id} className="recipe-card card" onClick={() => setViewRecipe(recipe)}>
                      <div className="recipe-photo">
                        {recipe.photo_url
                          ? <img src={recipe.photo_url} alt={recipe.name} />
                          : <div className="recipe-photo-placeholder">🍳</div>
                        }
                        {recipe.difficulty && (
                          <span className="recipe-diff-badge" style={diffStyle(recipe.difficulty)}>
                            {recipe.difficulty}
                          </span>
                        )}
                      </div>
                      <div className="recipe-body">
                        <div className="recipe-name" title={recipe.name}>{recipe.name}</div>
                        {recipe.description && (
                          <div className="recipe-desc">{recipe.description}</div>
                        )}
                        <div className="book-meta-row" style={{ marginTop: 6 }}>
                          {(recipe.prep_time || recipe.cook_time) && (
                            <span className="badge">⏱ {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</span>
                          )}
                          {recipe.servings && <span className="badge">👥 {recipe.servings}</span>}
                          {recipe.collection_name && <span className="badge">{recipe.collection_name}</span>}
                        </div>
                        <div className="book-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditRecipe(recipe); setShowRecipeModal(true); }}>
                            <IconEdit /> Editar
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }}
                            onClick={() => setConfirmDelete({ type: 'recipe', id: recipe.id, name: recipe.name })}>
                            <IconTrash /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </section>
      </div>

      {/* Modals */}
      {showColModal && (
        <CollectionModal collection={editCollection} householdId={currentHouseholdId}
          onClose={() => { setShowColModal(false); setEditCollection(null); }}
          onSave={() => { setShowColModal(false); setEditCollection(null); loadData(); }} />
      )}
      {showRecipeModal && (
        <RecipeModal recipe={editRecipe} collections={collections} householdId={currentHouseholdId}
          onClose={() => { setShowRecipeModal(false); setEditRecipe(null); }}
          onSave={() => { setShowRecipeModal(false); setEditRecipe(null); loadData(); }} />
      )}
      {viewRecipe && (
        <RecipeDetail recipe={viewRecipe}
          onClose={() => setViewRecipe(null)}
          onEdit={() => { setEditRecipe(viewRecipe); setViewRecipe(null); setShowRecipeModal(true); }}
          onDelete={() => { setConfirmDelete({ type: 'recipe', id: viewRecipe.id, name: viewRecipe.name }); setViewRecipe(null); }} />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar "${confirmDelete.name}"?`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (confirmDelete.type === 'col') await handleDeleteCol(confirmDelete.id);
            else await handleDeleteRecipe(confirmDelete.id);
            setConfirmDelete(null);
          }} />
      )}

      <style>{`
        .recipes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
        .recipe-card { padding: 0; overflow: hidden; cursor: pointer; transition: box-shadow var(--transition), transform var(--transition); }
        .recipe-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .recipe-photo { position: relative; background: var(--gray-100); }
        .recipe-photo img { width: 100%; height: 180px; object-fit: cover; display: block; }
        .recipe-photo-placeholder { height: 130px; display: flex; align-items: center; justify-content: center; font-size: 44px; background: linear-gradient(135deg, var(--green-50) 0%, var(--teal-50) 100%); }
        .recipe-diff-badge { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; }
        .recipe-body { padding: 10px 12px; }
        .recipe-name { font-size: 14px; font-weight: 800; color: var(--gray-800); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; margin-bottom: 3px; }
        .recipe-desc { font-size: 12px; color: var(--gray-500); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
        .recipe-form-modal { max-width: 600px; max-height: 90vh; overflow: hidden; }
        .recipe-detail-modal { max-width: 620px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
        @media(max-width: 700px) { .recipes-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
      `}</style>
    </div>
  );
}
