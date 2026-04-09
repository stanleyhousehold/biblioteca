import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { householdParams, currentHousehold, personalEmoji } = useHousehold();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setStats(null);
    Promise.all([
      api.inventory.getRooms(householdParams),
      api.inventory.getItems(householdParams),
      api.books.getLibraries(householdParams),
      api.books.getBooks(householdParams),
    ]).then(([rooms, items, libraries, books]) => {
      setStats({ rooms: rooms.length, items: items.length, libraries: libraries.length, books: books.length });
    }).catch(() => {});
  }, [householdParams]);

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
          <Link to="/inventario" className="btn btn-secondary">🔍 Buscar en inventario</Link>
        </div>
      </div>

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
      `}</style>
    </div>
  );
}
