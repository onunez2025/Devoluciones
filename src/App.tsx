import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import SsoLoginPage from './pages/SsoLoginPage';
import SsoStatusPage from './pages/SsoStatusPage';
import DashboardPage from './pages/DashboardPage';
import PublicEquipmentPage from './pages/PublicEquipmentPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sso-login" element={<SsoLoginPage />} />
          <Route path="/sso-status" element={<SsoStatusPage />} />

          {/* Rutas Privadas — toda consulta de datos, incluida la de historial de equipo
              (antes "pública", ahora requiere sesión iniciada sin excepción), vive aquí. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/public/equipment/:idEquipo" element={<PublicEquipmentPage />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
          </Route>

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
