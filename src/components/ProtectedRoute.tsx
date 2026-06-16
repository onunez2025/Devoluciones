import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  allowedRoles?: number[];
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, requiredPermission }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
