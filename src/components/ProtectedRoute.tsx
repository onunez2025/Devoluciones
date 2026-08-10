import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { LottiePlayer } from './common/LottiePlayer';
import { useCargaMinima } from '../hooks/useCargaMinima';
import { useTemaOscuro } from '../hooks/useTemaOscuro';
import { COLORES_LOTTIE_OSCURO, cargarAnimacionCarga } from '../utils/lottie-carga';

interface ProtectedRouteProps {
  allowedRoles?: number[];
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, requiredPermission }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // La pantalla de carga se sostiene un minimo aunque la sesion resuelva antes:
  // sin eso aparece y desaparece en unos pocos fotogramas y se percibe como un destello.
  const mostrandoCarga = useCargaMinima(isLoading);
  const temaOscuro = useTemaOscuro();

  if (mostrandoCarga) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-40 h-40 flex items-center justify-center">
          <LottiePlayer
            src={cargarAnimacionCarga}
            colores={temaOscuro ? COLORES_LOTTIE_OSCURO : undefined}
            fallback={<div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />}
            className="w-40 h-40"
            loop
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check roles (legacy)
  if (allowedRoles && user.roleId !== undefined && !allowedRoles.includes(user.roleId)) {
    return <Navigate to="/" replace />;
  }

  // Check permissions (RBAC)
  if (requiredPermission && user.permissions) {
    const hasPermission = user.permissions.includes(requiredPermission) || user.permissions.includes('ADMIN');
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
