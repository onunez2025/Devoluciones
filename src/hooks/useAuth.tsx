import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../types';
import { storageService } from '../services/storageService';
import apiClient from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token?: string, remember?: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SSO_COOKIE = 'token';
const SSO_DOMAIN = '.siatc.cloud';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setSsoCookie(token: string) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const domainPart = isLocalhost ? '' : `; domain=${SSO_DOMAIN}`;
  const securePart = isLocalhost ? '' : '; Secure';
  document.cookie = `${SSO_COOKIE}=${encodeURIComponent(token)}; path=/${domainPart}; SameSite=Lax${securePart}`;
}

function clearSsoCookie() {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const domainPart = isLocalhost ? '' : `; domain=${SSO_DOMAIN}`;
  document.cookie = `${SSO_COOKIE}=; path=/${domainPart}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function decodeJwt(token: string): any | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearInactivityTimer();
    storageService.clearAll();
    clearSsoCookie();
    setUser(null);
    window.location.href = '/login';
  }, [clearInactivityTimer]);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimer.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
  }, [clearInactivityTimer, logout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
  }, [resetInactivityTimer]);

  const login = useCallback((userData: User, token?: string, _remember = true) => {
    if (token) {
      storageService.setToken(token);
      setSsoCookie(token);
    }
    storageService.setUser(userData);
    setUser(userData);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    async function validateSession() {
      // 1. Buscar token: localStorage → cookie SSO
      let token = storageService.getToken();
      let fromCookie = false;

      if (!token) {
        const cookieToken = getCookie(SSO_COOKIE);
        if (cookieToken) {
          token = cookieToken;
          fromCookie = true;
        }
      }

      if (!token) {
        setIsLoading(false);
        return;
      }

      // 2. Verificar que el token no haya expirado
      const payload = decodeJwt(token);
      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        storageService.clearAll();
        clearSsoCookie();
        setIsLoading(false);
        return;
      }

      // Pre-hidratar el usuario desde el JWT inmediatamente para evitar parpadeos y retrasos en la UI
      const preHydratedUser: User = {
        id: payload.id as string,
        username: payload.username as string,
        fullName: (payload.full_name as string) || (payload.fullName as string) || '',
        role: (payload.role_name as string) || (payload.role as string) || '',
        role_name: (payload.role_name as string) || (payload.role as string) || '',
        permissions: (payload.permissions as string[]) || (payload.perms as string[]) || [],
        apps: (payload.apps as string) || ''
      };
      setUser(preHydratedUser);
      storageService.setUser(preHydratedUser);

      // 3. Si viene de cookie SSO, sincronizar localStorage y obtener token fresco
      if (fromCookie) {
        storageService.setToken(token);
      }

      // 4. Obtener token fresco del servidor (enriquece con permisos DEV actualizados)
      try {
        const { data } = await apiClient.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const freshToken = data.token as string;
        const freshUser: User = data.user;

        storageService.setToken(freshToken);
        storageService.setUser(freshUser);
        setSsoCookie(freshToken);
        setUser(freshUser);
      } catch {
        // Token inválido o usuario desactivado — purgar sesión
        storageService.clearAll();
        clearSsoCookie();
      } finally {
        setIsLoading(false);
        resetInactivityTimer();
      }
    }

    validateSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    const roleName = (user.role || user.role_name || '').trim().toLowerCase();
    if (roleName === 'administrador' || roleName === 'admin' || roleName === 'console.administrador') return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission) || user.permissions.includes('ADMIN');
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
