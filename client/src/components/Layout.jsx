import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import InstallBanner from './InstallBanner';

function IconHome() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconBox() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconBook() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>; }
function IconHouse() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><circle cx="19" cy="8" r="3" fill="currentColor" stroke="none"/></svg>; }
function IconLogout() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function IconMenu() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }

function UserAvatar({ user, size = 30 }) {
  if (user?.photo_url) {
    return <img src={user.photo_url} alt={user.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--teal-100)' }} />;
  }
  return (
    <div className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.43 }}>
      {user?.name?.[0]?.toUpperCase()}
    </div>
  );
}

function HouseholdSwitcher() {
  const { households, currentHousehold, currentHouseholdId, switchHousehold } = useHousehold();

  if (households.length === 0) return null;

  return (
    <div className="household-switcher">
      <select
        value={currentHouseholdId || ''}
        onChange={e => switchHousehold(e.target.value ? Number(e.target.value) : null)}
        title="Cambiar hogar activo"
      >
        <option value="">🏠 Personal</option>
        {households.map(h => (
          <option key={h.id} value={h.id}>🏠 {h.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  const navItems = [
    { to: '/', label: 'Inicio', icon: <IconHome /> },
    { to: '/inventario', label: 'Inventario', icon: <IconBox /> },
    { to: '/libros', label: 'Libros', icon: <IconBook /> },
    { to: '/hogares', label: 'Hogares', icon: <IconHouse /> },
  ];

  const SidebarContent = ({ onClose }) => (
    <>
      <div className="sidebar-brand">
        <span className="sidebar-logo">📚</span>
        <span className="sidebar-title">Biblioteca</span>
      </div>

      <HouseholdSwitcher />

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            {item.icon}{item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/perfil" onClick={onClose}
          className={({ isActive }) => `user-info-link${isActive ? ' active' : ''}`}
          title="Ver perfil">
          <UserAvatar user={user} size={30} />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div className="user-name">{user?.name}</div>
            <div className="user-username">@{user?.username}</div>
          </div>
        </NavLink>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={handleLogout} title="Cerrar sesión">
          <IconLogout />
        </button>
      </div>
    </>
  );

  return (
    <div className="layout">
      {/* Sidebar desktop */}
      <aside className="sidebar">
        <SidebarContent onClose={undefined} />
      </aside>

      {/* Mobile topbar */}
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" onClick={() => setMenuOpen(o => !o)}><IconMenu /></button>
        <span className="topbar-title">📚 Biblioteca</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={handleLogout} title="Cerrar sesión"><IconLogout /></button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-drawer sidebar" onClick={e => e.stopPropagation()}>
            <SidebarContent onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="main-content">
        {offline && (
          <div className="offline-notice">
            <span>⚡</span> Sin conexión — mostrando datos en caché
          </div>
        )}
        <div className="content-inner">{children}</div>
      </main>

      <InstallBanner />

      <style>{`
        .layout { display:flex; min-height:100vh; }

        .sidebar {
          width:224px; background:white; border-right:1.5px solid var(--gray-100);
          display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:10;
        }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:18px 16px 14px; border-bottom:1px solid var(--gray-100); }
        .sidebar-logo { font-size:24px; }
        .sidebar-title { font-size:17px; font-weight:800; color:var(--teal-700); }

        .household-switcher { padding:8px 10px; border-bottom:1px solid var(--gray-100); }
        .household-switcher select {
          width:100%; padding:6px 8px; border:1.5px solid var(--gray-200);
          border-radius:var(--radius-sm); font-size:12px; font-weight:600;
          background:var(--gray-50); color:var(--gray-700); cursor:pointer;
        }
        .household-switcher select:focus { outline:none; border-color:var(--primary); }

        .sidebar-nav { flex:1; padding:10px 8px; display:flex; flex-direction:column; gap:2px; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; color:var(--gray-600); transition:background var(--transition), color var(--transition); text-decoration:none; }
        .nav-item:hover { background:var(--gray-50); color:var(--gray-800); }
        .nav-item.active { background:var(--teal-50); color:var(--teal-700); }

        .sidebar-footer { padding:10px 12px; border-top:1px solid var(--gray-100); display:flex; align-items:center; justify-content:space-between; gap:6px; }
        .user-info-link { display:flex; align-items:center; gap:8px; flex:1; overflow:hidden; padding:5px 6px; border-radius:var(--radius-sm); text-decoration:none; color:inherit; transition:background var(--transition); }
        .user-info-link:hover { background:var(--gray-50); }
        .user-info-link.active { background:var(--teal-50); }
        .user-avatar { background:var(--teal-100); color:var(--teal-700); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0; }
        .user-name { font-size:12px; font-weight:700; color:var(--gray-800); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-username { font-size:10px; color:var(--gray-400); }

        .main-content { margin-left:224px; flex:1; min-height:100vh; }
        .content-inner { padding:26px 30px; max-width:1100px; }

        .offline-notice { background:var(--amber-50); border-bottom:1px solid var(--yellow-100); color:var(--amber-600); font-size:13px; font-weight:600; padding:8px 30px; display:flex; align-items:center; gap:6px; }

        .topbar { display:none; position:fixed; top:0; left:0; right:0; height:52px; background:white; border-bottom:1.5px solid var(--gray-100); align-items:center; justify-content:space-between; padding:0 12px; z-index:20; }
        .topbar-title { font-size:16px; font-weight:800; color:var(--teal-700); }

        .mobile-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:30; }
        .mobile-drawer { position:absolute; top:0; left:0; bottom:0; width:240px; animation:slideRight .2s ease; }
        @keyframes slideRight { from { transform:translateX(-100%); } to { transform:none; } }

        @media(max-width:700px) {
          .sidebar { display:none; }
          .topbar { display:flex; }
          .main-content { margin-left:0; padding-top:52px; }
          .content-inner { padding:14px; }
        }
      `}</style>
    </div>
  );
}
