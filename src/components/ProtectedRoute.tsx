import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { storageService } from '../services/storageService';

interface ProtectedRouteProps {
  allowedRoles?: number[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const user = storageService.getUser();
  const token = storageService.getToken();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.roleId)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
