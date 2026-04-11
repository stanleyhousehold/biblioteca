import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days !== 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} semana${weeks !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months !== 1 ? 'es' : ''}`;
  const years = Math.floor(days / 365);
  return `hace ${years} año${years !== 1 ? 's' : ''}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentHouseholdId, currentHousehold, personalEmoji } = useHousehold();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const params = currentHouseholdId ? { household_id: currentHouseholdId } : {};
    setStats(null);
    setRecent([]);
    Promise.all([
      api.inventory.getRooms(params),
      api.inventory.getItems(params),
      api.books.getLibraries(params),
      api.books.getBooks(params),
      api.recipes.getCollections(params),
      api.recipes.getRecipes(params),
      api.recent.get(params),
    ]).then(([rooms, items, libraries, books, recipeCollections, recipes, recentData]) => {
      setStats({
        rooms: rooms.length, items: items.length,
        libraries: libraries.length, books: books.length,
        recipeCollections: recipeCollections.length, recipes: recipes.length,
      });
      setRecent(recentData);
    }).catch(() => {});
  }, [currentHouseholdId]);

  const cards = [
    {
      to: '/inventario',
      emoji: '📦',
      label: 'Habitaciones',
      value: stats?.rooms ?? '—',
      sublabel: `${stats?.items ?? '—'} objetos`,
      color: 'var(--teal-600)',
      bg: 'var(--teal-50)',
    },
    {
      to: '/libros',
      emoji: '📚',
      label: 'Bibliotecas',
      value: stats?.libraries ?? '—',
      sublabel: `${stats?.books ?? '—'} libros`,
      color: 'var(--amber-600)',
      bg: 'var(--amber-50)',
    },
    {
      to: '/recetas',
      emoji: '🍳',
      label: 'Recetas',
      value: stats?.recipeCollections ?? '—',
      sublabel: `${stats?.recipes ?? '—'} recetas`,
      color: 'var(--green-700)',
      bg: 'var(--green-50)',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 4 }}>
          Bienvenido, {user?.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
          {currentHousehold
            ? `Viendo: ${currentHousehold.emoji || '🏠'} ${currentHousehold.name}`
            : `Viendo: ${personalEmoji} Personal`}
        </p>
      </div>

      <div className="dashboard-grid">
        {cards.map(card => (
          <Link key={card.to} to={card.to} className="dash-card card">
            <div className="dash-card-icon" style={{ background: card.bg, color: card.color }}>
              {card.emoji}
            </div>
            <div className="dash-card-content">
              <div className="dash-card-label">{card.label}</div>
              <div className="dash-card-value" style={{ color: card.color }}>{card.value}</div>
              <div className="dash-card-sub">{card.sublabel}</div>
            </div>
            <div className="dash-card-arrow">→</div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--gray-700)' }}>Accesos rápidos</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/inventario" className="btn btn-secondary">📦 Añadir objeto</Link>
          <Link to="/libros" className="btn btn-secondary">📖 Añadir libro</Link>
          <Link to="/recetas" className="btn btn-secondary">🍳 Añadir receta</Link>
          <Link to="/inventario" className="btn btn-secondary">🔍 Buscar en inventario</Link>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--gray-700)' }}>
            Añadido recientemente
          </h2>
          <div className="recent-list">
            {recent.map(item => (
              <Link
                key={`${item.type}-${item.id}`}
                to={item.type === 'book' ? '/libros' : item.type === 'recipe' ? '/recetas' : '/inventario'}
                className="recent-item"
              >
                <div className="recent-thumb">
                  {item.image
                    ? <img src={item.image} alt={item.name} />
                    : <span>{item.type === 'book' ? '📖' : item.type === 'recipe' ? '🍳' : '📦'}</span>
                  }
                </div>
                <div className="recent-body">
                  <div className="recent-name">{item.name}</div>
                  <div className="recent-meta">
                    <span className={`badge ${item.type === 'book' ? 'recent-badge-book' : item.type === 'recipe' ? 'recent-badge-recipe' : 'recent-badge-item'}`}>
                      {item.type === 'book' ? 'Libro' : item.type === 'recipe' ? 'Receta' : 'Objeto'}
                    </span>
                    {item.group_name && (
                      <span className="recent-group">{item.group_name}</span>
                    )}
                  </div>
                </div>
                <div className="recent-time">{timeAgo(item.created_at)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .dash-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          cursor: pointer;
          transition: box-shadow var(--transition), transform var(--transition);
          text-decoration: none;
          color: inherit;
        }
        .dash-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .dash-card-icon {
          width: 52px; height: 52px;
          border-radius: var(--radius);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px;
          flex-shrink: 0;
        }
        .dash-card-content { flex: 1; }
        .dash-card-label { font-size: 12px; color: var(--gray-500); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
        .dash-card-value { font-size: 32px; font-weight: 800; line-height: 1.1; margin: 2px 0; }
        .dash-card-sub { font-size: 13px; color: var(--gray-400); }
        .dash-card-arrow { font-size: 20px; color: var(--gray-300); }

        .recent-list { display: flex; flex-direction: column; gap: 2px; }
        .recent-item {
          display: flex; align-items: center; gap: 12px; padding: 8px 6px;
          border-radius: var(--radius-sm); text-decoration: none; color: inherit;
          transition: background var(--transition);
        }
        .recent-item:hover { background: var(--gray-50); }
        .recent-thumb {
          width: 46px; height: 46px; border-radius: 6px; overflow: hidden; flex-shrink: 0;
          background: var(--gray-100); display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .recent-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .recent-body { flex: 1; min-width: 0; }
        .recent-name {
          font-size: 13px; font-weight: 700; color: var(--gray-800);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;
        }
        .recent-meta { display: flex; align-items: center; gap: 5px; }
        .recent-badge-book   { background: var(--amber-50); color: var(--amber-700);  font-size: 10px; padding: 1px 6px; }
        .recent-badge-item   { background: var(--teal-50);  color: var(--teal-700);   font-size: 10px; padding: 1px 6px; }
        .recent-badge-recipe { background: var(--green-50); color: var(--green-700);  font-size: 10px; padding: 1px 6px; }
        .recent-group { font-size: 11px; color: var(--gray-400); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .recent-time { font-size: 11px; color: var(--gray-400); flex-shrink: 0; white-space: nowrap; padding-left: 4px; }
      `}</style>
    </div>
  );
}
