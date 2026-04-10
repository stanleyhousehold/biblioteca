import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HouseholdProvider } from './context/HouseholdContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Books from './pages/Books';
import Recipes from './pages/Recipes';
import Profile from './pages/Profile';
import Households, { JoinHousehold } from './pages/Households';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/recuperar-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/inventario" element={<PrivateRoute><Inventory /></PrivateRoute>} />
            <Route path="/libros" element={<PrivateRoute><Books /></PrivateRoute>} />
            <Route path="/recetas" element={<PrivateRoute><Recipes /></PrivateRoute>} />
            <Route path="/perfil" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/hogares" element={<PrivateRoute><Households /></PrivateRoute>} />
            <Route path="/unirse/:token" element={<PrivateRoute><JoinHousehold /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </HouseholdProvider>
    </AuthProvider>
  );
}
