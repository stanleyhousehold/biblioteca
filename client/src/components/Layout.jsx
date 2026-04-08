import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navItems = [
    { to: '/', label: 'Inicio', icon: <IconHome /> },
    { to: '/inventario', label: 'Inventario', icon: <IconBox /> },
    { to: '/libros', label: 'Libros', icon: <IconBook /> },
  ];

  return (
    <div className="layout">
      {/* Sidebar (desktop) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">📚</span>
          <span className="sidebar-title">Biblioteca</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-username">@{user?.username}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={handleLogout} title="Cerrar sesión">
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" onClick={() => setMenuOpen(o => !o)}>
          <IconMenu />
        </button>
        <span className="topbar-title">📚 Biblioteca</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={handleLogout} title="Cerrar sesión">
          <IconLogout />
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="sidebar-brand">
              <span className="sidebar-logo">📚</span>
              <span className="sidebar-title">Biblioteca</span>
            </div>
            <nav className="sidebar-nav">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-footer">
              <div className="user-info">
                <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
                <div>
                  <div className="user-name">{user?.name}</div>
                  <div className="user-username">@{user?.username}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="content-inner">
          {children}
        </div>
      </main>

      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px;
          background: white;
          border-right: 1.5px solid var(--gray-100);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 10;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 18px 16px;
          border-bottom: 1px solid var(--gray-100);
        }
        .sidebar-logo { font-size: 26px; }
        .sidebar-title { font-size: 18px; font-weight: 800; color: var(--teal-700); }
        .sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          color: var(--gray-600);
          transition: background var(--transition), color var(--transition);
        }
        .nav-item:hover { background: var(--gray-50); color: var(--gray-800); }
        .nav-item.active { background: var(--teal-50); color: var(--teal-700); }
        .nav-item.active svg { color: var(--teal-600); }
        .sidebar-footer {
          padding: 14px;
          border-top: 1px solid var(--gray-100);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .user-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
        .user-avatar {
          width: 32px; height: 32px;
          background: var(--teal-100);
          color: var(--teal-700);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800;
          flex-shrink: 0;
        }
        .user-name { font-size: 13px; font-weight: 700; color: var(--gray-800); }
        .user-username { font-size: 11px; color: var(--gray-400); }

        /* ── Main ── */
        .main-content {
          margin-left: 220px;
          flex: 1;
          min-height: 100vh;
        }
        .content-inner {
          padding: 28px 32px;
          max-width: 1100px;
        }

        /* ── Topbar (mobile) ── */
        .topbar {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 52px;
          background: white;
          border-bottom: 1.5px solid var(--gray-100);
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          z-index: 20;
        }
        .topbar-title { font-size: 16px; font-weight: 800; color: var(--teal-700); }

        /* ── Mobile drawer ── */
        .mobile-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.4);
          z-index: 30;
        }
        .mobile-drawer {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 240px;
          background: white;
          display: flex;
          flex-direction: column;
          animation: slideRight .2s ease;
        }
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: none; } }

        @media (max-width: 700px) {
          .sidebar { display: none; }
          .topbar { display: flex; }
          .main-content { margin-left: 0; padding-top: 52px; }
          .content-inner { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
