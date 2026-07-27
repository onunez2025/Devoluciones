import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, SessionConfig } from '../types';
import { storageService } from '../services/storageService';
import apiClient from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  sessionConfig: SessionConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token?: string, remember?: boolean, sessionConfig?: SessionConfig, skipSharedCookie?: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SSO_COOKIE = 'token';

// Fase 20: dominio de la cookie SSO compartida, configurable en build-time. Sin definir, el
// comportamiento es idéntico al de siempre (.siatc.cloud) -- producción real no cambia.
const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN || '.siatc.cloud';

function getCookie(name: string): string | null {
  // No usar split('; name=') aqui -- si llegan a coexistir dos cookies con el mismo nombre
  // (ej. un token viejo con Domain=.siatc.cloud junto al correcto con Domain=.qa.siatc.cloud),
  // el split genera 3+ partes y la condicion parts.length === 2 falla siempre, devolviendo
  // null aunque la cookie exista. El regex toma solo la PRIMERA coincidencia.
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function setSsoCookie(token: string) {
  const isProd = window.location.hostname.endsWith('.siatc.cloud');
  const cookieDomain = isProd ? `; domain=${COOKIE_DOMAIN}` : '';
  document.cookie = `token=${token}; path=/${cookieDomain}; max-age=${24 * 60 * 60}; SameSite=Lax; Secure=${isProd ? 'true' : 'false'}`;
}

function clearSsoCookie() {
  const isProd = window.location.hostname.endsWith('.siatc.cloud');
  const cookieDomain = isProd ? `; domain=${COOKIE_DOMAIN}` : '';
  document.cookie = `token=; path=/${cookieDomain}; max-age=0; SameSite=Lax; Secure=${isProd ? 'true' : 'false'}`;
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
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(() => {
    try { const s = localStorage.getItem('session_config'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const logout = useCallback(() => {
    const token = storageService.getToken();
    if (token) {
      // blacklistToken — el servidor invalida el JWT en Redis via POST /auth/logout
      apiClient.post('/auth/logout').catch(() => { /* token ya expirado o red caída — limpiar igual */ });
    }
    setUser(null);
    setSessionConfig(null);
    localStorage.removeItem('session_config');
    storageService.clearAll();
    clearSsoCookie();
    window.location.href = '/login';
  }, []);

  const login = useCallback((userData: User, token?: string, _remember = true, newSessionConfig?: SessionConfig, skipSharedCookie = false) => {
    if (newSessionConfig) {
      setSessionConfig(newSessionConfig);
      localStorage.setItem('session_config', JSON.stringify(newSessionConfig));
    }
    if (token) {
      storageService.setToken(token);
      // Se omite en el piloto de Casdoor (SsoLoginPage) para no interferir con sesiones
      // reales del resto del ecosistema mientras esto corre en "Devoluciones QA".
      if (!skipSharedCookie) setSsoCookie(token);
    }
    storageService.setUser(userData);
    setUser(userData);
  }, []);

  useEffect(() => {
    async function validateSession() {
      try {
        const cookieToken = getCookie(SSO_COOKIE);
        const localToken = storageService.getToken();
        let activeToken = localToken;

        if (cookieToken) {
          if (cookieToken !== localToken) {
            storageService.setToken(cookieToken);
            activeToken = cookieToken;

            const payload = decodeJwt(cookieToken);
            if (payload) {
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
            }
          }
        } else {
          if (localToken) {
            // Si el token no está en la cookie (logout global), limpiar sesión local
            storageService.clearAll();
            clearSsoCookie();
            setUser(null);
            setIsLoading(false);
            return;
          }
        }

        if (!activeToken) {
          setIsLoading(false);
          return;
        }

        // Obtener token fresco del servidor (enriquece con permisos DEV actualizados)
        const { data } = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` }
        });

        const freshToken = data.token as string;
        const freshUser: User = data.user;

        storageService.setToken(freshToken);
        storageService.setUser(freshUser);
        // No reescribir la cookie compartida si el token viene del piloto Casdoor (ssoPilot=true,
        // propagado por el servidor en /auth/me) — este useEffect corre en cada carga de página,
        // así que sin este chequeo terminaría reescribiendo la cookie igual en cada montaje.
        const freshPayload = decodeJwt(freshToken);
        if (!freshPayload?.ssoPilot) setSsoCookie(freshToken);
        setUser(freshUser);
      } catch (error) {
        console.error('Session validation error:', error);
        // Token inválido o usuario desactivado — purgar sesión
        storageService.clearAll();
        clearSsoCookie();
        setUser(null);
      } finally {
        setIsLoading(false);
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
    <AuthContext.Provider value={{ user, sessionConfig, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
