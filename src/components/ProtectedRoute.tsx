import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { storageService } from '../services/storageService';

interface ProtectedRouteProps {
  allowedRoles?: number[];
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, requiredPermission }) => {
  const user = storageService.getUser();
  const token = storageService.getToken();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check roles (legacy)
  if (allowedRoles && !allowedRoles.includes(user.roleId)) {
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
