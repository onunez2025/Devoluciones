import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PublicEquipmentPage from './pages/PublicEquipmentPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Rutas Privadas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>

        {/* Rutas Administrativas (Solo Administrador: rol 1) */}
        <Route element={<ProtectedRoute allowedRoles={[1]} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>

        {/* Vista Pública (Escaneo QR) */}
        <Route path="/public/equipment/:idEquipo" element={<PublicEquipmentPage />} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

