import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/config/UsersPage';
import RolesPage from './pages/config/RolesPage';
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

        {/* Rutas de Configuración / RBAC */}
        <Route element={<ProtectedRoute requiredPermission="USERS_VIEW" />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
        
        <Route element={<ProtectedRoute requiredPermission="ROLES_VIEW" />}>
          <Route path="/roles" element={<RolesPage />} />
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

